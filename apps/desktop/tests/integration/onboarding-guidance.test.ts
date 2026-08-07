import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { fingerprintGeometryDocument } from "@laserx/application";
import { analyzeDocumentCutability } from "@laserx/cutability";
import { parseProject, serializeProject } from "@laserx/project-format";
import { afterEach, describe, expect, it } from "vitest";

import {
  DesktopController,
  type DesktopDialogs,
} from "../../electron/desktop-controller.js";
import type { CutabilityWorkerPort } from "../../electron/cutability-worker-service.js";

const directories: string[] = [];
const controllers: DesktopController[] = [];
const cutabilityWorker: CutabilityWorkerPort = {
  run: (request) =>
    Promise.resolve(
      analyzeDocumentCutability(request.document, {
        operationId: request.operationId,
        objectIds: request.objectIds,
      }),
    ),
};

async function setup(): Promise<{
  directory: string;
  userDataPath: string;
  projectPath: string;
}> {
  const directory = await mkdtemp(join(tmpdir(), "laserx-onboarding-"));
  directories.push(directory);
  return {
    directory,
    userDataPath: join(directory, "user-data"),
    projectPath: join(directory, "guided.laserx"),
  };
}

function makeController(
  userDataPath: string,
  projectPath: string,
): DesktopController {
  const dialogs: DesktopDialogs = {
    chooseOpenProject: () => Promise.resolve(projectPath),
    chooseSaveProject: () => Promise.resolve(projectPath),
    confirmUnsavedChanges: () => Promise.resolve("discard"),
  };
  const controller = new DesktopController({
    userDataPath,
    dialogs,
    onStateChanged: () => undefined,
    cutabilityWorker,
  });
  controllers.push(controller);
  return controller;
}

function activeIdentity(controller: DesktopController): {
  expectedStepId: string;
  runToken: string;
} {
  const workflow = controller.state.onboarding.workflow;
  expect(workflow.status).toBe("active");
  expect(workflow.currentStepId).not.toBeNull();
  expect(workflow.runToken).not.toBeNull();
  return {
    expectedStepId: workflow.currentStepId as string,
    runToken: workflow.runToken as string,
  };
}

afterEach(async () => {
  for (const controller of controllers.splice(0)) controller.stop();
  await Promise.all(
    directories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("desktop onboarding guidance", () => {
  it("persists and resumes an exact stable checkpoint with a fresh run token", async () => {
    const { userDataPath, projectPath } = await setup();
    const first = makeController(userDataPath, projectPath);
    await first.initialize();
    await first.saveProjectAs();
    await first.onboardingAction({ type: "start", goal: "create-first-sign" });
    const started = activeIdentity(first);
    await first.onboardingAction({
      type: "advance",
      ...started,
      completion: { kind: "step" },
    });
    expect(first.state.onboarding.workflow.currentStepId).toBe("add-content");
    await first.createDocument({ width: 20, height: 10, inputUnit: "inches" });
    await first.editorAction({ type: "object.create", objectType: "rectangle" });
    await first.saveProject();
    expect(first.state.project.document.objects).toHaveLength(1);
    first.stop();

    const second = makeController(userDataPath, projectPath);
    await second.initialize();
    expect(second.state.onboarding.preferences.activeWorkflow?.currentStepId).toBe(
      "add-content",
    );
    expect(second.state.onboarding.resumeEligibility).toBe("different-project");
    const savedSnapshot = second.state.onboarding.preferences.activeWorkflow;
    await second.onboardingAction({ type: "resume" });
    expect(second.state.onboarding.workflow.status).toBe("idle");
    expect(second.state.onboarding.preferences.activeWorkflow).toEqual(savedSnapshot);
    expect(second.state.onboarding.resumeEligibility).toBe("different-project");
    expect(second.state.onboarding.recoveryNotice).toContain("saved guidance was kept");

    await second.openProject();
    expect(
      second.state.onboarding.preferences.activeWorkflow?.projectBinding,
    ).toMatchObject({
      projectId: second.state.project.id,
      documentId: second.state.project.document.id,
    });
    expect(second.state.onboarding.resumeEligibility).toBe("available");
    await second.onboardingAction({ type: "resume" });

    expect(second.state.onboarding.workflow.currentStepId).toBe("add-content");
    expect(second.state.onboarding.workflow.runToken).not.toBe(started.runToken);
    expect(second.state.onboarding.recoveryNotice).toBeNull();
  });

  it("recovers a transient findings checkpoint to the prior stable step", async () => {
    const { userDataPath, projectPath } = await setup();
    const first = makeController(userDataPath, projectPath);
    await first.initialize();
    await first.saveProjectAs();
    await first.onboardingAction({ type: "start", goal: "create-first-sign" });
    for (let index = 0; index < 3; index += 1) {
      await first.onboardingAction({
        type: "advance",
        ...activeIdentity(first),
        completion: { kind: "step" },
      });
    }
    expect(first.state.onboarding.workflow.currentStepId).toBe("resolve-findings");
    first.stop();

    const second = makeController(userDataPath, projectPath);
    await second.initialize();
    await second.openProject();
    await second.onboardingAction({ type: "resume" });

    expect(second.state.onboarding.workflow.currentStepId).toBe(
      "analyze-cutability",
    );
    expect(second.state.onboarding.recoveryNotice).toContain(
      "nearest saved checkpoint",
    );
  });

  it("ends guidance before a true project replacement but not document creation", async () => {
    const { userDataPath, projectPath } = await setup();
    const controller = makeController(userDataPath, projectPath);
    await controller.initialize();
    await controller.onboardingAction({ type: "start", goal: "create-first-sign" });
    const runToken = controller.state.onboarding.workflow.runToken;

    await controller.createDocument({ width: 12, height: 6, inputUnit: "inches" });
    expect(controller.state.onboarding.workflow.runToken).toBe(runToken);
    expect(controller.state.onboarding.workflow.status).toBe("active");

    await controller.newProject();
    expect(controller.state.onboarding.workflow.status).toBe("idle");
    expect(controller.state.onboarding.preferences.activeWorkflow).toBeNull();
    expect(controller.state.onboarding.recoveryNotice).toContain("replaced");
  });

  it("auto-completes an empty resolution checkpoint only from current zero findings", async () => {
    const { userDataPath, projectPath } = await setup();
    const controller = makeController(userDataPath, projectPath);
    await controller.initialize();
    await controller.onboardingAction({ type: "start", goal: "create-first-sign" });
    for (let index = 0; index < 2; index += 1) {
      await controller.onboardingAction({
        type: "advance",
        ...activeIdentity(controller),
        completion: { kind: "step" },
      });
    }
    expect(controller.state.onboarding.workflow.currentStepId).toBe(
      "analyze-cutability",
    );
    const analysisResult = await controller.runCutabilityAnalysis(
      "c0000000-0000-4000-8000-000000000001",
      [],
    );
    expect(analysisResult.ok).toBe(true);
    expect(controller.state.analysis.cutability).toMatchObject({
      errorCount: 0,
      warningCount: 0,
    });
    await controller.onboardingAction({
      type: "advance",
      ...activeIdentity(controller),
      completion: { kind: "step" },
    });

    expect(controller.state.onboarding.workflow.currentStepId).toBe(
      "physical-preview",
    );
  });

  it("rejects a stale snapshot without mutating the open document", async () => {
    const { userDataPath, projectPath } = await setup();
    const first = makeController(userDataPath, projectPath);
    await first.initialize();
    await first.saveProjectAs();
    await first.onboardingAction({ type: "start", goal: "create-first-sign" });
    await first.createDocument({ width: 18, height: 9, inputUnit: "inches" });
    await first.saveProject();
    first.stop();

    const externallyChanged = parseProject(await readFile(projectPath, "utf8"));
    externallyChanged.document.dimensions.widthMm += 1;
    await writeFile(projectPath, serializeProject(externallyChanged), "utf8");

    const second = makeController(userDataPath, projectPath);
    await second.initialize();
    await second.openProject();
    const before = fingerprintGeometryDocument(second.state.project.document);
    await second.onboardingAction({ type: "resume" });

    expect(second.state.onboarding.workflow.status).toBe("idle");
    expect(second.state.onboarding.preferences.activeWorkflow).toBeNull();
    expect(second.state.onboarding.recoveryNotice).toContain("was not resumed");
    expect(fingerprintGeometryDocument(second.state.project.document)).toBe(before);
    const persisted = JSON.parse(
      await readFile(join(userDataPath, "onboarding-preferences.json"), "utf8"),
    ) as { activeWorkflow: unknown };
    expect(persisted.activeWorkflow).toBeNull();
  });
});
