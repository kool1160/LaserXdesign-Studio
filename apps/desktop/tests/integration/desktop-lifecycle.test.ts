import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { parseProject } from "@laserx/project-format";
import { afterEach, describe, expect, it } from "vitest";

import {
  DesktopController,
  type DesktopDialogs,
  type UnsavedChoice,
} from "../../electron/desktop-controller.js";

const temporaryDirectories: string[] = [];
const controllers: DesktopController[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "laserx-lifecycle-"));
  temporaryDirectories.push(directory);
  return directory;
}

function dialogs(
  projectPath: string,
  unsavedChoice: UnsavedChoice = "discard",
): DesktopDialogs {
  return {
    chooseOpenProject: () => Promise.resolve(projectPath),
    chooseSaveProject: () => Promise.resolve(projectPath),
    confirmUnsavedChanges: () => Promise.resolve(unsavedChoice),
  };
}

function makeController(
  userDataPath: string,
  desktopDialogs: DesktopDialogs,
  autosaveIntervalMs = 30_000,
): DesktopController {
  const controller = new DesktopController({
    userDataPath,
    dialogs: desktopDialogs,
    onStateChanged: () => undefined,
    autosaveIntervalMs,
  });
  controllers.push(controller);
  return controller;
}

async function waitFor(
  assertion: () => Promise<void>,
  timeoutMs = 2_000,
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      await assertion();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  await assertion();
}

afterEach(async () => {
  for (const controller of controllers.splice(0)) {
    controller.stop();
  }
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("desktop project lifecycle", () => {
  it("saves, lists, and reopens a project with identity and settings", async () => {
    const directory = await temporaryDirectory();
    const projectPath = join(directory, "project.laserx");
    const controller = makeController(
      join(directory, "user-data"),
      dialogs(projectPath),
    );
    await controller.initialize();
    const originalId = controller.state.project.id;

    await controller.createDocument({
      width: 24,
      height: 12,
      inputUnit: "inches",
    });
    await controller.setViewportPreferences({
      gridSpacingMm: 12.7,
      snappingEnabled: true,
    });
    expect(controller.state.dirty).toBe(true);
    await controller.saveProjectAs();
    expect(controller.state.dirty).toBe(false);
    expect(controller.state.recentProjects[0]?.filePath).toBe(projectPath);

    await controller.newProject();
    expect(controller.state.project.id).not.toBe(originalId);
    await controller.openRecent(projectPath);

    expect(controller.state.project.id).toBe(originalId);
    expect(controller.state.project.document.dimensions).toEqual({
      widthMm: 609.6,
      heightMm: 304.8,
    });
    expect(
      controller.state.project.document.settings.viewport,
    ).toMatchObject({
      gridSpacingMm: 12.7,
      snapping: { enabled: true },
    });
    expect(controller.state.dirty).toBe(false);
  });

  it("cancels closing when dirty-state protection says cancel", async () => {
    const directory = await temporaryDirectory();
    const projectPath = join(directory, "project.laserx");
    const controller = makeController(
      join(directory, "user-data"),
      dialogs(projectPath, "cancel"),
    );
    await controller.initialize();
    await controller.setDisplayUnit("inches");

    await expect(controller.confirmClose()).resolves.toBe(false);
    expect(controller.state.dirty).toBe(true);
  });

  it("removes autosave when the user explicitly discards dirty close", async () => {
    const directory = await temporaryDirectory();
    const projectPath = join(directory, "project.laserx");
    const userDataPath = join(directory, "user-data");
    const controller = makeController(
      userDataPath,
      dialogs(projectPath, "discard"),
      20,
    );
    await controller.initialize();
    await controller.setDisplayUnit("inches");
    const recoveryPath = join(
      userDataPath,
      "recovery",
      "active.laserx.autosave",
    );
    await waitFor(async () => {
      expect((await readFile(recoveryPath, "utf8")).length).toBeGreaterThan(0);
    });

    await expect(controller.confirmClose()).resolves.toBe(true);
    await expect(readFile(recoveryPath, "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("recovers interrupted work without overwriting the original", async () => {
    const directory = await temporaryDirectory();
    const projectPath = join(directory, "project.laserx");
    const userDataPath = join(directory, "user-data");
    const first = makeController(
      userDataPath,
      dialogs(projectPath),
      20,
    );
    await first.initialize();
    await first.saveProjectAs();
    await first.setDisplayUnit("inches");

    const recoveryPath = join(
      userDataPath,
      "recovery",
      "active.laserx.autosave",
    );
    await waitFor(async () => {
      expect((await readFile(recoveryPath, "utf8")).length).toBeGreaterThan(0);
    });
    first.stop();

    const original = parseProject(await readFile(projectPath, "utf8"));
    expect(original.document.settings.displayUnit).toBe("millimeters");

    const second = makeController(userDataPath, dialogs(projectPath));
    await second.initialize();
    expect(second.state.recovery).not.toBeNull();
    await second.resolveRecovery({ action: "recover" });

    expect(
      second.state.project.document.settings.displayUnit,
    ).toBe("inches");
    expect(second.state.filePath).toBe(projectPath);
    expect(second.state.dirty).toBe(true);
    expect(second.state.recovered).toBe(true);
    const originalAfterRecovery = parseProject(
      await readFile(projectPath, "utf8"),
    );
    expect(originalAfterRecovery.document.settings.displayUnit).toBe(
      "millimeters",
    );
  });
});
