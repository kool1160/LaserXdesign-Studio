import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
import type { PhysicalPreviewWorkerPort } from "../../electron/physical-preview-worker-service.js";
import { runPhysicalPreviewTask } from "../../../../packages/physical-preview-3d/src/task.js";

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
const physicalPreviewWorker: PhysicalPreviewWorkerPort = {
  run: (request) => Promise.resolve(runPhysicalPreviewTask(request)),
};

async function setup(): Promise<{
  directory: string;
  userDataPath: string;
  projectPath: string;
  exportPath: string;
}> {
  const directory = await mkdtemp(join(tmpdir(), "laserx-onboarding-"));
  directories.push(directory);
  return {
    directory,
    userDataPath: join(directory, "user-data"),
    projectPath: join(directory, "guided.laserx"),
    exportPath: join(directory, "guided.svg"),
  };
}

function makeController(
  userDataPath: string,
  projectPath: string,
  exportPath = join(userDataPath, "guided.svg"),
  previewWorker: PhysicalPreviewWorkerPort = physicalPreviewWorker,
): DesktopController {
  const dialogs: DesktopDialogs = {
    chooseOpenProject: () => Promise.resolve(projectPath),
    chooseSaveProject: () => Promise.resolve(projectPath),
    chooseExportVector: () => Promise.resolve(exportPath),
    confirmUnsavedChanges: () => Promise.resolve("discard"),
  };
  const controller = new DesktopController({
    userDataPath,
    dialogs,
    onStateChanged: () => undefined,
    cutabilityWorker,
    physicalPreviewWorker: previewWorker,
  });
  controllers.push(controller);
  return controller;
}

async function assignActiveLayerAsPhysical(
  controller: DesktopController,
): Promise<void> {
  const layerId = controller.state.project.document.activeLayerId;
  const result = await controller.editorAction({
    type: "layer.set-manufacturing",
    layerId,
    manufacturing: {
      role: "face",
      material: "mild-steel",
      thicknessMm: 3,
      process: "laser",
      notes: "",
      registrationGroup: null,
      registrationHoleIds: [],
    },
  });
  expect(result.ok).toBe(true);
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
  it("persists learning preferences without changing project or manufacturing truth", async () => {
    const { userDataPath, projectPath } = await setup();
    const first = makeController(userDataPath, projectPath);
    await first.initialize();
    const beforeProject = JSON.stringify(first.state.project);
    const beforeHistory = structuredClone(first.state.editor.history);
    const beforeAnalysis = structuredClone(first.state.analysis);
    const beforePreview = structuredClone(first.state.physicalPreview);

    expect(first.state.onboarding.preferences).toMatchObject({
      schemaVersion: 2,
      learnModeEnabled: false,
      completedLearnTopics: [],
    });
    expect(
      await first.onboardingAction({ type: "set-learn-mode", enabled: true }),
    ).toMatchObject({ ok: true });
    expect(
      await first.onboardingAction({
        type: "complete-learn-topic",
        topic: "repair-groups",
      }),
    ).toMatchObject({ ok: true });

    expect(JSON.stringify(first.state.project)).toBe(beforeProject);
    expect(first.state.editor.history).toEqual(beforeHistory);
    expect(first.state.analysis).toEqual(beforeAnalysis);
    expect(first.state.physicalPreview).toEqual(beforePreview);
    expect(first.state.onboarding.preferences).toMatchObject({
      learnModeEnabled: true,
      completedLearnTopics: ["repair-groups"],
      completedGoals: [],
    });
    first.stop();

    const second = makeController(userDataPath, projectPath);
    await second.initialize();
    expect(second.state.onboarding.preferences).toMatchObject({
      schemaVersion: 2,
      learnModeEnabled: true,
      completedLearnTopics: ["repair-groups"],
    });
    const beforeReopenProject = JSON.stringify(second.state.project);
    await second.onboardingAction({
      type: "reopen-learn-topic",
      topic: "repair-groups",
    });
    expect(second.state.onboarding.preferences.completedLearnTopics).toEqual([]);
    expect(JSON.stringify(second.state.project)).toBe(beforeReopenProject);
  });

  it("migrates shipped v1 preferences without unexpectedly enabling Learn Mode", async () => {
    const { userDataPath, projectPath } = await setup();
    await mkdir(userDataPath, { recursive: true });
    await writeFile(
      join(userDataPath, "onboarding-preferences.json"),
      JSON.stringify({
        schemaVersion: 1,
        completedGoals: ["create-first-sign"],
        dismissed: true,
        activeWorkflow: null,
      }),
      "utf8",
    );

    const controller = makeController(userDataPath, projectPath);
    await controller.initialize();
    expect(controller.state.onboarding.preferences).toEqual({
      schemaVersion: 2,
      completedGoals: ["create-first-sign"],
      dismissed: true,
      activeWorkflow: null,
      learnModeEnabled: false,
      completedLearnTopics: [],
    });

    await controller.onboardingAction({ type: "set-learn-mode", enabled: true });
    const persisted = JSON.parse(
      await readFile(join(userDataPath, "onboarding-preferences.json"), "utf8"),
    ) as { schemaVersion: number; learnModeEnabled: boolean };
    expect(persisted).toMatchObject({ schemaVersion: 2, learnModeEnabled: true });
  });

  it("replays a skipped tutorial with a fresh token against the current project", async () => {
    const { userDataPath, projectPath } = await setup();
    const controller = makeController(userDataPath, projectPath);
    await controller.initialize();
    const projectId = controller.state.project.id;
    const beforeProject = JSON.stringify(controller.state.project);

    await controller.onboardingAction({
      type: "start",
      goal: "create-first-sign",
    });
    const firstRun = activeIdentity(controller);
    await controller.onboardingAction({
      type: "exit",
      runToken: firstRun.runToken,
    });
    expect(controller.state.onboarding.workflow.status).toBe("dismissed");
    expect(controller.state.onboarding.preferences.completedGoals).toEqual([]);

    await controller.onboardingAction({
      type: "replay",
      goal: "create-first-sign",
      expectedRunToken: firstRun.runToken,
    });
    const replay = activeIdentity(controller);
    expect(replay.runToken).not.toBe(firstRun.runToken);
    expect(controller.state.onboarding.workflow.currentStepId).toBe(
      "choose-size-material",
    );
    expect(
      controller.state.onboarding.preferences.activeWorkflow?.projectBinding.projectId,
    ).toBe(projectId);
    expect(controller.state.onboarding.preferences.completedGoals).toEqual([]);
    expect(JSON.stringify(controller.state.project)).toBe(beforeProject);

    await controller.onboardingAction({
      type: "replay",
      goal: "create-first-sign",
      expectedRunToken: firstRun.runToken,
    });
    expect(controller.state.onboarding.workflow.runToken).toBe(replay.runToken);
  });

  it("persists and resumes an exact stable checkpoint with a fresh run token", async () => {
    const { userDataPath, projectPath } = await setup();
    const first = makeController(userDataPath, projectPath);
    await first.initialize();
    await first.saveProjectAs();
    await first.onboardingAction({ type: "start", goal: "create-first-sign" });
    const started = activeIdentity(first);
    await first.createDocument({ width: 20, height: 10, inputUnit: "inches" });
    await assignActiveLayerAsPhysical(first);
    expect(first.state.onboarding.workflow.currentStepId).toBe("add-content");
    await first.saveProject();
    expect(first.state.project.document.objects).toHaveLength(0);
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
    await first.createDocument({ width: 200, height: 100, inputUnit: "millimeters" });
    await assignActiveLayerAsPhysical(first);
    await first.editorAction({ type: "object.create", objectType: "line" });
    await first.runCutabilityAnalysis(
      "c0000000-0000-4000-8000-000000000010",
      [],
    );
    expect(first.state.onboarding.workflow.currentStepId).toBe("resolve-findings");
    await first.saveProject();
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
    await controller.createDocument({ width: 200, height: 100, inputUnit: "millimeters" });
    await assignActiveLayerAsPhysical(controller);
    await controller.editorAction({ type: "object.create", objectType: "rectangle" });
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
    expect(controller.state.onboarding.workflow.currentStepId).toBe(
      "physical-preview",
    );
  });

  it("completes Create My First Sign only from real whole-design, preview, save, and export outcomes", async () => {
    const { userDataPath, projectPath, exportPath } = await setup();
    const controller = makeController(userDataPath, projectPath, exportPath);
    await controller.initialize();
    await controller.onboardingAction({ type: "start", goal: "create-first-sign" });

    const beforeRejectedAdvance = fingerprintGeometryDocument(
      controller.state.project.document,
    );
    const rejectedSetupAdvance = await controller.onboardingAction({
      type: "advance",
      ...activeIdentity(controller),
      completion: { kind: "step" },
    });
    expect(rejectedSetupAdvance.ok).toBe(false);
    if (rejectedSetupAdvance.ok) throw new Error("Expected setup rejection.");
    expect(rejectedSetupAdvance.error).toContain("physical layer");
    expect(controller.state.onboarding.workflow.currentStepId).toBe(
      "choose-size-material",
    );
    expect(
      fingerprintGeometryDocument(controller.state.project.document),
    ).toBe(beforeRejectedAdvance);

    await controller.createDocument({
      width: 240,
      height: 120,
      inputUnit: "millimeters",
    });
    await assignActiveLayerAsPhysical(controller);
    expect(controller.state.onboarding.workflow.currentStepId).toBe("add-content");

    await controller.editorAction({ type: "object.create", objectType: "rectangle" });
    expect(controller.state.onboarding.workflow.currentStepId).toBe(
      "analyze-cutability",
    );
    const objectId = controller.state.project.document.objects[0]?.id;
    expect(objectId).toBeDefined();

    await controller.runCutabilityAnalysis(
      "c0000000-0000-4000-8000-000000000020",
      [objectId as string],
    );
    expect(controller.state.analysis.scope?.kind).toBe("selection");
    expect(controller.state.onboarding.workflow.currentStepId).toBe(
      "analyze-cutability",
    );
    const rejectedSelectionAdvance = await controller.onboardingAction({
      type: "advance",
      ...activeIdentity(controller),
      completion: { kind: "step" },
    });
    expect(rejectedSelectionAdvance.ok).toBe(false);
    if (rejectedSelectionAdvance.ok) throw new Error("Expected selection rejection.");
    expect(rejectedSelectionAdvance.error).toContain("Analyze all");

    await controller.runCutabilityAnalysis(
      "c0000000-0000-4000-8000-000000000021",
      [],
    );
    expect(controller.state.analysis.scope?.kind).toBe("whole-design");
    expect(controller.state.onboarding.workflow.currentStepId).toBe(
      "physical-preview",
    );

    const rejectedGenericPreviewAdvance = await controller.onboardingAction({
      type: "advance",
      ...activeIdentity(controller),
      completion: { kind: "step" },
    });
    expect(rejectedGenericPreviewAdvance.ok).toBe(false);
    if (rejectedGenericPreviewAdvance.ok) {
      throw new Error("Expected generic preview rejection.");
    }
    expect(rejectedGenericPreviewAdvance.error).toContain("required 3D preview");

    const previewBuild = await controller.runPhysicalPreview(
      "c0000000-0000-4000-8000-000000000022",
    );
    expect(
      previewBuild.ok,
      previewBuild.ok ? undefined : previewBuild.error,
    ).toBe(true);
    const assembly = controller.state.physicalPreview.assembly;
    expect(assembly).toMatchObject({ status: "complete" });
    const previewResult = await controller.onboardingAction({
      type: "advance",
      ...activeIdentity(controller),
      completion: {
        kind: "physical-preview",
        result: "rendered",
        assemblyFingerprint: assembly?.fingerprint as string,
      },
    });
    expect(previewResult.ok).toBe(true);
    expect(controller.state.onboarding.workflow.currentStepId).toBe("save-export");

    const rejectedFinalAdvance = await controller.onboardingAction({
      type: "advance",
      ...activeIdentity(controller),
      completion: { kind: "step" },
    });
    expect(rejectedFinalAdvance.ok).toBe(false);
    if (rejectedFinalAdvance.ok) throw new Error("Expected export rejection.");
    expect(rejectedFinalAdvance.error).toContain("Export SVG or DXF");

    await controller.editorAction({ type: "history.undo" });
    expect(controller.state.project.document.objects).toHaveLength(0);
    const staleExport = await controller.exportVector({ format: "svg" });
    expect(staleExport.ok).toBe(false);
    if (staleExport.ok) throw new Error("Expected stale-design export rejection.");
    expect(staleExport.error).toContain("design changed");
    await expect(readFile(exportPath, "utf8")).rejects.toThrow();

    await controller.editorAction({ type: "history.redo" });
    expect(controller.state.project.document.objects).toHaveLength(1);

    expect((await controller.saveProjectAs()).ok).toBe(true);
    expect(JSON.parse(await readFile(projectPath, "utf8"))).toMatchObject({
      document: { objects: [{ type: "rectangle" }] },
    });
    expect(controller.state.onboarding.workflow.currentStepId).toBe("save-export");

    expect(await controller.exportVector({ format: "svg" })).toMatchObject({ ok: true });
    expect(await readFile(exportPath, "utf8")).toContain("<svg");
    expect(controller.state.onboarding.workflow.status).toBe("completed");
    expect(controller.state.onboarding.preferences.completedGoals).toContain(
      "create-first-sign",
    );
    expect(controller.state.onboarding.preferences.activeWorkflow).toBeNull();
  });

  it("allows the required preview checkpoint to use only a current explicit build-failure route", async () => {
    const { userDataPath, projectPath, exportPath } = await setup();
    const failedWorker: PhysicalPreviewWorkerPort = {
      run: () => Promise.reject(new Error("Simulated 3D worker failure.")),
    };
    const controller = makeController(
      userDataPath,
      projectPath,
      exportPath,
      failedWorker,
    );
    await controller.initialize();
    await controller.onboardingAction({ type: "start", goal: "create-first-sign" });
    await controller.createDocument({ width: 200, height: 100, inputUnit: "millimeters" });
    await assignActiveLayerAsPhysical(controller);
    await controller.editorAction({ type: "object.create", objectType: "rectangle" });
    await controller.runCutabilityAnalysis(
      "c0000000-0000-4000-8000-000000000030",
      [],
    );
    expect(controller.state.onboarding.workflow.currentStepId).toBe(
      "physical-preview",
    );

    const prematureAcknowledgement = await controller.onboardingAction({
      type: "advance",
      ...activeIdentity(controller),
      completion: {
        kind: "physical-preview",
        result: "unavailable",
        reason: "build-failed",
        assemblyFingerprint: null,
      },
    });
    expect(prematureAcknowledgement).toMatchObject({ ok: false });
    expect(controller.state.onboarding.workflow.currentStepId).toBe(
      "physical-preview",
    );

    const buildResult = await controller.runPhysicalPreview(
      "c0000000-0000-4000-8000-000000000031",
    );
    expect(buildResult).toMatchObject({
      ok: false,
      error: "Simulated 3D worker failure.",
    });
    const acknowledged = await controller.onboardingAction({
      type: "advance",
      ...activeIdentity(controller),
      completion: {
        kind: "physical-preview",
        result: "unavailable",
        reason: "build-failed",
        assemblyFingerprint: null,
      },
    });
    expect(acknowledged.ok).toBe(true);
    expect(controller.state.onboarding.workflow.currentStepId).toBe("save-export");
  });

  it("resumes the exact saved export checkpoint with bound analysis and preview evidence", async () => {
    const { userDataPath, projectPath, exportPath } = await setup();
    const first = makeController(userDataPath, projectPath, exportPath);
    await first.initialize();
    await first.onboardingAction({ type: "start", goal: "create-first-sign" });
    await first.createDocument({ width: 200, height: 100, inputUnit: "millimeters" });
    await assignActiveLayerAsPhysical(first);
    await first.editorAction({ type: "object.create", objectType: "rectangle" });
    await first.runCutabilityAnalysis(
      "c0000000-0000-4000-8000-000000000040",
      [],
    );
    await first.runPhysicalPreview(
      "c0000000-0000-4000-8000-000000000041",
    );
    const assemblyFingerprint =
      first.state.physicalPreview.assembly?.fingerprint;
    expect(assemblyFingerprint).toBeDefined();
    await first.onboardingAction({
      type: "advance",
      ...activeIdentity(first),
      completion: {
        kind: "physical-preview",
        result: "rendered",
        assemblyFingerprint: assemblyFingerprint as string,
      },
    });
    expect(first.state.onboarding.workflow.currentStepId).toBe("save-export");
    await first.saveProjectAs();
    first.stop();

    const second = makeController(userDataPath, projectPath, exportPath);
    await second.initialize();
    await second.openProject();
    expect(second.state.onboarding.resumeEligibility).toBe("available");
    await second.onboardingAction({ type: "resume" });
    expect(second.state.onboarding.workflow.currentStepId).toBe("save-export");
    expect(second.state.analysis.cutability).toBeNull();
    expect(second.state.physicalPreview.assembly).toBeNull();

    expect(await second.exportVector({ format: "svg" })).toMatchObject({ ok: true });
    expect(await readFile(exportPath, "utf8")).toContain("<svg");
    expect(second.state.onboarding.workflow.status).toBe("completed");
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
