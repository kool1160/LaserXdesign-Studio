import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createBlankProject, type LaserxProject } from "@laserx/domain";
import { afterEach, describe, expect, it } from "vitest";

import {
  DesktopController,
  type DesktopDialogs,
} from "../../electron/desktop-controller.js";

const temporaryDirectories: string[] = [];
const controllers: DesktopController[] = [];

function pngBase64(): string {
  const bytes = new Uint8Array(128);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  return Buffer.from(bytes).toString("base64");
}

function project(): LaserxProject {
  return createBlankProject({
    id: "aaaaaaaa-0000-4000-8000-000000000001",
    documentId: "aaaaaaaa-0000-4000-8000-000000000002",
    now: "2026-08-05T12:00:00.000Z",
    width: 200,
    height: 100,
  });
}

async function desktop(
  choosePreviewCapturePath: (suggested: string) => Promise<string | null>,
): Promise<{ controller: DesktopController; directory: string }> {
  const directory = await mkdtemp(join(tmpdir(), "laserx-capture-ipc-"));
  temporaryDirectories.push(directory);
  const dialogs: DesktopDialogs = {
    chooseOpenProject: () => Promise.resolve(join(directory, "p.laserx")),
    chooseSaveProject: () => Promise.resolve(null),
    confirmUnsavedChanges: () => Promise.resolve("discard"),
    choosePreviewCapturePath,
  };
  const controller = new DesktopController({
    userDataPath: directory,
    dialogs,
    onStateChanged: () => undefined,
    projectStorage: {
      read: () => Promise.resolve(project()),
      write: () => Promise.resolve(),
    },
  });
  controllers.push(controller);
  await controller.initialize();
  await controller.openProject();
  return { controller, directory };
}

afterEach(async () => {
  for (const controller of controllers.splice(0)) controller.stop();
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("privileged physical preview capture save", () => {
  it("writes the capture to the chosen path and reports it as saved", async () => {
    const { controller, directory } = await desktop((suggested) =>
      Promise.resolve(join(directory, suggested)),
    );

    const result = await controller.savePhysicalPreviewCapture({
      filename: "laserx-preview-fixture-front-assembled.png",
      pngBase64: pngBase64(),
      overwrite: true,
    });

    expect(result).toMatchObject({ ok: true });
    expect(controller.state.physicalPreview.capture).toMatchObject({
      status: "saved",
      byteLength: 128,
      error: null,
    });
    const written = await readFile(
      join(directory, "laserx-preview-fixture-front-assembled.png"),
    );
    expect(written.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  });

  it("treats a canceled save dialog as a clean no-op that writes nothing", async () => {
    const { controller, directory } = await desktop(() => Promise.resolve(null));

    const result = await controller.savePhysicalPreviewCapture({
      filename: "laserx-preview-fixture-front-assembled.png",
      pngBase64: pngBase64(),
      overwrite: true,
    });

    expect(result).toMatchObject({ ok: true });
    expect(controller.state.physicalPreview.capture).toMatchObject({
      status: "canceled",
      targetPath: null,
      error: null,
    });
    expect(await readdir(directory)).not.toContain(
      "laserx-preview-fixture-front-assembled.png",
    );
  });

  it("reports an explicit failure when the write is rejected, without claiming success", async () => {
    const { controller, directory } = await desktop(() =>
      // A directory that does not exist: the writer must fail loudly rather
      // than inventing folders the user never confirmed.
      Promise.resolve(join(directory, "missing", "capture.png")),
    );

    await controller.savePhysicalPreviewCapture({
      filename: "capture.png",
      pngBase64: pngBase64(),
      overwrite: true,
    });

    const capture = controller.state.physicalPreview.capture;
    expect(capture?.status).toBe("failed");
    expect(capture?.error).toMatch(/could not be saved/u);
  });

  it("rejects malformed base64 before anything reaches the filesystem", async () => {
    const { controller, directory } = await desktop((suggested) =>
      Promise.resolve(join(directory, suggested)),
    );

    await controller.savePhysicalPreviewCapture({
      filename: "capture.png",
      // Not valid base64: a permissive decode would otherwise write a
      // corrupt-but-plausible PNG.
      pngBase64: "!!!!not-base64!!!!",
      overwrite: true,
    });

    expect(controller.state.physicalPreview.capture).toMatchObject({
      status: "failed",
      targetPath: null,
    });
    expect(await readdir(directory)).not.toContain("capture.png");
  });

  it("never mutates the document, dirty flag, history, or selection", async () => {
    const { controller, directory } = await desktop((suggested) =>
      Promise.resolve(join(directory, suggested)),
    );
    const beforeDocument = JSON.stringify(controller.state.project.document);
    const beforeDirty = controller.state.dirty;
    const beforeUndoDepth = controller.state.editor.history.undoDepth;
    const beforeSelection = controller.state.editor.selectionIds;

    await controller.savePhysicalPreviewCapture({
      filename: "laserx-preview-fixture-front-assembled.png",
      pngBase64: pngBase64(),
      overwrite: true,
    });

    expect(JSON.stringify(controller.state.project.document)).toBe(beforeDocument);
    expect(controller.state.dirty).toBe(beforeDirty);
    expect(controller.state.editor.history.undoDepth).toBe(beforeUndoDepth);
    expect(controller.state.editor.selectionIds).toEqual(beforeSelection);
    // Capture is a derived, read-only side effect: analysis and export
    // surfaces must be untouched by it too.
    expect(controller.state.analysis.cutability).toBeNull();
    expect(controller.state.production.exportSummary).toBeNull();
    expect(controller.state.interchange.exportSummary).toBeNull();
  });

  it("clears the capture result when a different project is opened", async () => {
    const { controller, directory } = await desktop((suggested) =>
      Promise.resolve(join(directory, suggested)),
    );
    await controller.savePhysicalPreviewCapture({
      filename: "laserx-preview-fixture-front-assembled.png",
      pngBase64: pngBase64(),
      overwrite: true,
    });
    expect(controller.state.physicalPreview.capture).not.toBeNull();

    await controller.newProject();

    expect(controller.state.physicalPreview.capture).toBeNull();
  });
});
