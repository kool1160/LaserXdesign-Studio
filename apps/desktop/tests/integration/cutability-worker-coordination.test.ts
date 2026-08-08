import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  analyzeDocumentCutability,
  fingerprintCutabilityDocument,
} from "@laserx/cutability";
import {
  createBlankProject,
  identityTransform,
  type LaserxProject,
} from "@laserx/domain";
import { afterEach, describe, expect, it } from "vitest";

import {
  CutabilityAnalysisCancelledError,
  type CutabilityWorkerPort,
} from "../../electron/cutability-worker-service.js";
import {
  DesktopController,
  type DesktopDialogs,
} from "../../electron/desktop-controller.js";

const OPERATION_ID = "a0000000-0000-4000-8000-000000000001";
const SECOND_OPERATION_ID = "a0000000-0000-4000-8000-000000000002";
const THIRD_OPERATION_ID = "a0000000-0000-4000-8000-000000000003";
const LAYER_ID = "b0000000-0000-4000-8000-000000000001";
const SECOND_LAYER_ID = "b0000000-0000-4000-8000-000000000002";
const OUTER_ID = "c0000000-0000-4000-8000-000000000001";
const SECOND_OUTER_ID = "c0000000-0000-4000-8000-000000000002";
const ISLAND_ID = "d0000000-0000-4000-8000-000000000001";
const SECOND_ISLAND_ID = "d0000000-0000-4000-8000-000000000002";
const SAFE_DUPLICATE_ID = "c0000000-0000-4000-8000-000000000003";
const SAFE_COLLINEAR_ID = "c0000000-0000-4000-8000-000000000004";
const SAFE_AMBIGUOUS_ID = "c0000000-0000-4000-8000-000000000005";
const temporaryDirectories: string[] = [];
const controllers: DesktopController[] = [];

function nestedProject(): LaserxProject {
  return createBlankProject({
    id: "e0000000-0000-4000-8000-000000000001",
    documentId: "e0000000-0000-4000-8000-000000000002",
    now: "2026-07-31T12:00:00.000Z",
    width: 150,
    height: 120,
    layers: [{ id: LAYER_ID, name: "Stencil", visible: true, locked: false }],
    activeLayerId: LAYER_ID,
    objects: [
      {
        id: OUTER_ID,
        type: "path",
        layerId: LAYER_ID,
        transform: identityTransform(),
        closed: true,
        points: [
          { xMm: 10, yMm: 10 },
          { xMm: 110, yMm: 10 },
          { xMm: 110, yMm: 110 },
          { xMm: 10, yMm: 110 },
        ],
      },
      {
        id: ISLAND_ID,
        type: "path",
        layerId: LAYER_ID,
        transform: identityTransform(),
        closed: true,
        points: [
          { xMm: 35, yMm: 35 },
          { xMm: 85, yMm: 35 },
          { xMm: 85, yMm: 85 },
          { xMm: 35, yMm: 85 },
        ],
      },
    ],
  });
}

function twoLayerNestedProject(): LaserxProject {
  return createBlankProject({
    id: "e0000000-0000-4000-8000-000000000003",
    documentId: "e0000000-0000-4000-8000-000000000004",
    now: "2026-07-31T12:00:00.000Z",
    width: 300,
    height: 120,
    layers: [
      {
        id: LAYER_ID,
        name: "Front",
        visible: true,
        locked: false,
        manufacturing: {
          role: "face",
          material: "mild-steel",
          thicknessMm: 3,
          process: "laser",
          notes: "",
          registrationGroup: null,
          registrationHoleIds: [],
        },
      },
      {
        id: SECOND_LAYER_ID,
        name: "Backing",
        visible: true,
        locked: false,
        manufacturing: {
          role: "backing",
          material: "acrylic",
          thicknessMm: 6,
          process: "router",
          notes: "",
          registrationGroup: null,
          registrationHoleIds: [],
        },
      },
    ],
    activeLayerId: LAYER_ID,
    objects: [
      {
        id: OUTER_ID,
        type: "path",
        layerId: LAYER_ID,
        transform: identityTransform(),
        closed: true,
        points: [
          { xMm: 10, yMm: 10 },
          { xMm: 110, yMm: 10 },
          { xMm: 110, yMm: 110 },
          { xMm: 10, yMm: 110 },
        ],
      },
      {
        id: ISLAND_ID,
        type: "path",
        layerId: LAYER_ID,
        transform: identityTransform(),
        closed: true,
        points: [
          { xMm: 35, yMm: 35 },
          { xMm: 85, yMm: 35 },
          { xMm: 85, yMm: 85 },
          { xMm: 35, yMm: 85 },
        ],
      },
      {
        id: SECOND_OUTER_ID,
        type: "path",
        layerId: SECOND_LAYER_ID,
        transform: identityTransform(),
        closed: true,
        points: [
          { xMm: 160, yMm: 10 },
          { xMm: 260, yMm: 10 },
          { xMm: 260, yMm: 110 },
          { xMm: 160, yMm: 110 },
        ],
      },
      {
        id: SECOND_ISLAND_ID,
        type: "path",
        layerId: SECOND_LAYER_ID,
        transform: identityTransform(),
        closed: true,
        points: [
          { xMm: 185, yMm: 35 },
          { xMm: 235, yMm: 35 },
          { xMm: 235, yMm: 85 },
          { xMm: 185, yMm: 85 },
        ],
      },
    ],
  });
}

function safeRepairProject(): LaserxProject {
  const square = (id: string) => ({
    id,
    type: "path" as const,
    layerId: LAYER_ID,
    transform: identityTransform(),
    closed: true,
    points: [
      { xMm: 10, yMm: 10 },
      { xMm: 50, yMm: 10 },
      { xMm: 50, yMm: 50 },
      { xMm: 10, yMm: 50 },
    ],
  });
  return createBlankProject({
    id: "e0000000-0000-4000-8000-000000000005",
    documentId: "e0000000-0000-4000-8000-000000000006",
    now: "2026-08-08T12:00:00.000Z",
    width: 150,
    height: 120,
    layers: [{ id: LAYER_ID, name: "Repair", visible: true, locked: false }],
    activeLayerId: LAYER_ID,
    objects: [
      square(OUTER_ID),
      square(SAFE_DUPLICATE_ID),
      {
        id: SAFE_COLLINEAR_ID,
        type: "path",
        layerId: LAYER_ID,
        transform: identityTransform(),
        closed: true,
        points: [
          { xMm: 70, yMm: 10 },
          { xMm: 90, yMm: 10 },
          { xMm: 110, yMm: 10 },
          { xMm: 110, yMm: 50 },
          { xMm: 70, yMm: 50 },
        ],
      },
      {
        id: SAFE_AMBIGUOUS_ID,
        type: "path",
        layerId: LAYER_ID,
        transform: identityTransform(),
        closed: false,
        points: [
          { xMm: 20, yMm: 80 },
          { xMm: 60, yMm: 80 },
          { xMm: 60, yMm: 105 },
        ],
      },
    ],
  });
}

function immediateWorker(counter?: { calls: number }): CutabilityWorkerPort {
  return {
    run: (request, _signal, onProgress) => {
      if (counter !== undefined) counter.calls += 1;
      onProgress?.({ operationId: request.operationId, percent: 55, stage: "spacing" });
      return Promise.resolve(
        analyzeDocumentCutability(request.document, {
          operationId: request.operationId,
          objectIds: request.objectIds,
        }),
      );
    },
  };
}

async function desktop(
  worker: CutabilityWorkerPort,
  project = nestedProject(),
): Promise<DesktopController> {
  const directory = await mkdtemp(join(tmpdir(), "laserx-cutability-"));
  temporaryDirectories.push(directory);
  const path = join(directory, "nested.laserx");
  const dialogs: DesktopDialogs = {
    chooseOpenProject: () => Promise.resolve(path),
    chooseSaveProject: () => Promise.resolve(null),
    confirmUnsavedChanges: () => Promise.resolve("discard"),
  };
  const controller = new DesktopController({
    userDataPath: directory,
    dialogs,
    onStateChanged: () => undefined,
    projectStorage: {
      read: () => Promise.resolve(project),
      write: () => Promise.resolve(),
    },
    cutabilityWorker: worker,
  });
  controllers.push(controller);
  await controller.initialize();
  await controller.openProject();
  return controller;
}

afterEach(async () => {
  for (const controller of controllers.splice(0)) controller.stop();
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("cutability worker coordination", () => {
  it("previews, rejects, accepts, reanalyzes, reports, and undoes one safe batch", async () => {
    const counter = { calls: 0 };
    const controller = await desktop(
      immediateWorker(counter),
      safeRepairProject(),
    );
    await controller.runCutabilityAnalysis(OPERATION_ID, []);
    const before = JSON.stringify(controller.state.project.document);
    expect(controller.state.analysis.repairGroups?.safeToFix.findingCount)
      .toBeGreaterThan(0);

    expect(await controller.previewSafeRepairs()).toMatchObject({ ok: true });
    expect(JSON.stringify(controller.state.project.document)).toBe(before);
    expect(controller.state.editor.history.undoDepth).toBe(0);
    expect(controller.state.analysis.safeRepairProposal).toMatchObject({
      skippedFindingCount: 0,
    });
    expect(await controller.rejectSafeRepairs()).toMatchObject({ ok: true });
    expect(JSON.stringify(controller.state.project.document)).toBe(before);
    expect(controller.state.analysis.safeRepairProposal).toBeNull();
    expect(controller.state.editor.history.undoDepth).toBe(0);

    await controller.previewSafeRepairs();
    expect(await controller.acceptSafeRepairs()).toMatchObject({ ok: true });
    expect(counter.calls).toBe(2);
    expect(controller.state.editor.history.undoDepth).toBe(1);
    expect(controller.state.project.document.objects.some(
      (object) => object.id === SAFE_DUPLICATE_ID,
    )).toBe(false);
    const cleaned = controller.state.project.document.objects.find(
      (object) => object.id === SAFE_COLLINEAR_ID,
    );
    expect(cleaned?.type === "path" ? cleaned.points.length : 0).toBe(4);
    expect(controller.state.analysis.safeRepairResult).toMatchObject({
      skippedCount: 0,
      remainingCount: controller.state.analysis.cutability?.issueCount,
    });
    expect(controller.state.analysis.safeRepairResult?.fixedCount)
      .toBeGreaterThan(0);
    expect(controller.state.analysis.cutability).not.toBeNull();
    expect(controller.state.analysis.repairGroups?.needsYourDecision.findingCount)
      .toBeGreaterThan(0);

    await controller.editorAction({ type: "history.undo" });
    expect(JSON.stringify(controller.state.project.document)).toBe(before);
    expect(controller.state.analysis.cutability).toBeNull();
  });

  it("refuses a repair preview after the document basis changes", async () => {
    const controller = await desktop(
      immediateWorker(),
      safeRepairProject(),
    );
    await controller.runCutabilityAnalysis(OPERATION_ID, []);
    await controller.previewSafeRepairs();
    await controller.editorAction({
      type: "objects.move",
      objectIds: [OUTER_ID],
      deltaXmm: 1,
      deltaYmm: 0,
    });
    const afterEdit = JSON.stringify(controller.state.project.document);

    expect(await controller.acceptSafeRepairs()).toMatchObject({
      ok: false,
      error: "There is no safe-repair preview to accept.",
    });
    expect(JSON.stringify(controller.state.project.document)).toBe(afterEdit);
    expect(controller.state.project.document.objects.some(
      (object) => object.id === SAFE_DUPLICATE_ID,
    )).toBe(true);
  });

  it("caches exact analysis and invalidates it after a document command", async () => {
    const counter = { calls: 0 };
    const controller = await desktop(immediateWorker(counter));

    expect(await controller.runCutabilityAnalysis(OPERATION_ID, [])).toMatchObject({ ok: true });
    expect(controller.state.analysis.cutability).toMatchObject({
      status: "complete",
      errorCount: 1,
    });
    expect(controller.state.analysis.scope).toEqual({
      kind: "whole-design",
      layerId: null,
      layerName: null,
    });
    expect(counter.calls).toBe(1);
    expect(await controller.runCutabilityAnalysis(SECOND_OPERATION_ID, [])).toMatchObject({ ok: true });
    expect(counter.calls).toBe(1);

    await controller.editorAction({ type: "objects.move", objectIds: [ISLAND_ID], deltaXmm: 1, deltaYmm: 0 });
    expect(controller.state.analysis.cutability).toBeNull();
    expect(controller.state.analysis.scope).toBeNull();
    expect(await controller.runCutabilityAnalysis(SECOND_OPERATION_ID, [])).toMatchObject({ ok: true });
    expect(counter.calls).toBe(2);
  });

  it("publishes whole-design, selection, and physical-layer scopes atomically across cache reuse", async () => {
    const counter = { calls: 0 };
    const controller = await desktop(
      immediateWorker(counter),
      twoLayerNestedProject(),
    );

    await controller.runCutabilityAnalysis(OPERATION_ID, []);
    expect(controller.state.analysis.scope).toEqual({
      kind: "whole-design",
      layerId: null,
      layerName: null,
    });
    expect(controller.state.analysis.cutability?.analyzedObjectIds).toEqual([
      ISLAND_ID,
      SECOND_ISLAND_ID,
      OUTER_ID,
      SECOND_OUTER_ID,
    ].sort());
    expect(counter.calls).toBe(1);

    await controller.runCutabilityAnalysis(
      SECOND_OPERATION_ID,
      [OUTER_ID, ISLAND_ID],
    );
    expect(controller.state.analysis.scope).toEqual({
      kind: "selection",
      layerId: null,
      layerName: null,
      objectIds: [ISLAND_ID, OUTER_ID].sort(),
    });
    expect(controller.state.analysis.cutability?.analyzedObjectIds).toEqual([
      ISLAND_ID,
      OUTER_ID,
    ].sort());
    expect(counter.calls).toBe(2);

    await controller.runManufacturingLayerAnalysis(THIRD_OPERATION_ID, LAYER_ID);
    expect(controller.state.analysis.scope).toEqual({
      kind: "manufacturing-layer",
      layerId: LAYER_ID,
      layerName: "Front",
    });
    expect(controller.state.analysis.cutability?.analyzedObjectIds).toEqual([
      ISLAND_ID,
      OUTER_ID,
    ].sort());
    expect(counter.calls).toBe(2);
  });

  it("preserves the previous result with its original scope on cancellation and failure", async () => {
    let callCount = 0;
    const worker: CutabilityWorkerPort = {
      run: (request, signal) => {
        callCount += 1;
        if (callCount === 1) {
          return Promise.resolve(analyzeDocumentCutability(request.document, {
            operationId: request.operationId,
            objectIds: request.objectIds,
          }));
        }
        if (callCount === 2) {
          return new Promise((_resolve, reject) => {
            signal.addEventListener(
              "abort",
              () => reject(new CutabilityAnalysisCancelledError()),
              { once: true },
            );
          });
        }
        return Promise.reject(new Error("Injected analysis failure."));
      },
    };
    const controller = await desktop(worker);
    await controller.runCutabilityAnalysis(OPERATION_ID, []);
    const previousScope = controller.state.analysis.scope;
    const previousAnalysis = controller.state.analysis.cutability;

    const canceled = controller.runCutabilityAnalysis(
      SECOND_OPERATION_ID,
      [OUTER_ID, ISLAND_ID],
    );
    await Promise.resolve();
    await controller.cancelCutabilityAnalysis(SECOND_OPERATION_ID);
    expect(await canceled).toMatchObject({ ok: true });
    expect(controller.state.analysis.scope).toEqual(previousScope);
    expect(controller.state.analysis.cutability).toEqual(previousAnalysis);

    const failed = await controller.runCutabilityAnalysis(
      THIRD_OPERATION_ID,
      [OUTER_ID, ISLAND_ID],
    );
    expect(failed).toMatchObject({
      ok: false,
      error: "Injected analysis failure.",
    });
    expect(controller.state.analysis.scope).toEqual(previousScope);
    expect(controller.state.analysis.cutability).toEqual(previousAnalysis);
  });

  it("cancels without publishing and rejects a stale worker result", async () => {
    let callCount = 0;
    let resolveStaleRun = (): void => {
      throw new Error("Expected a pending stale analysis.");
    };
    const worker: CutabilityWorkerPort = {
      run: (request, signal) =>
        new Promise((resolve, reject) => {
          callCount += 1;
          const publish = () => resolve(analyzeDocumentCutability(request.document, {
            operationId: request.operationId,
            objectIds: request.objectIds,
          }));
          if (callCount === 1) {
            signal.addEventListener(
              "abort",
              () => reject(new CutabilityAnalysisCancelledError()),
              { once: true },
            );
          } else {
            resolveStaleRun = publish;
          }
        }),
    };
    const controller = await desktop(worker);
    const canceled = controller.runCutabilityAnalysis(OPERATION_ID, []);
    await Promise.resolve();
    await controller.cancelCutabilityAnalysis(OPERATION_ID);
    expect(await canceled).toMatchObject({ ok: true });
    expect(controller.state.analysis.cutability).toBeNull();

    const stale = controller.runCutabilityAnalysis(SECOND_OPERATION_ID, []);
    await Promise.resolve();
    await controller.editorAction({ type: "object.create", objectType: "rectangle" });
    expect(callCount).toBe(2);
    resolveStaleRun();
    const staleResult = await stale;
    expect(staleResult.ok).toBe(false);
    if (staleResult.ok) throw new Error("Expected stale analysis rejection.");
    expect(staleResult.error).toContain("stale result was discarded");
    expect(controller.state.analysis.cutability).toBeNull();
  });

  it("previews manual and automatic bridges without mutation, accepts once, and undoes exactly", async () => {
    const counter = { calls: 0 };
    const controller = await desktop(immediateWorker(counter));
    await controller.runCutabilityAnalysis(OPERATION_ID, []);
    const issue = controller.state.analysis.cutability?.issues.find(
      (candidate) => candidate.code === "DISCONNECTED_ISLAND",
    );
    if (issue === undefined) throw new Error("Expected a disconnected island issue.");
    const before = JSON.stringify(controller.state.project.document);

    expect(await controller.previewBridge({
      issueId: issue.id,
      widthMm: 2,
      mode: "manual",
      direction: "right",
    })).toMatchObject({ ok: true });
    expect(JSON.stringify(controller.state.project.document)).toBe(before);
    expect(controller.state.analysis.bridgeProposal).toMatchObject({
      mode: "manual",
      direction: "right",
      widthMm: 2,
    });
    await controller.rejectBridge();
    expect(controller.state.analysis.bridgeProposal).toBeNull();
    expect(await controller.previewBridge({
      issueId: issue.id,
      widthMm: 2,
      mode: "automatic",
    })).toMatchObject({ ok: true });

    expect(await controller.acceptBridge()).toMatchObject({ ok: true });
    expect(controller.state.analysis.scope).toEqual({
      kind: "whole-design",
      layerId: null,
      layerName: null,
    });
    expect(controller.state.analysis.cutability?.analyzedObjectIds).toEqual(
      controller.state.project.document.objects.map((object) => object.id).sort(),
    );
    expect(counter.calls).toBe(2);
    expect(controller.state.editor.history.undoDepth).toBe(1);
    expect(JSON.stringify(controller.state.project.document)).not.toBe(before);
    await controller.editorAction({ type: "history.undo" });
    expect(JSON.stringify(controller.state.project.document)).toBe(before);
  });

  it("keeps scoped and whole-design identities exact across layers and bridge repair", async () => {
    const counter = { calls: 0 };
    const controller = await desktop(
      immediateWorker(counter),
      twoLayerNestedProject(),
    );

    await controller.runCutabilityAnalysis(OPERATION_ID, [OUTER_ID, ISLAND_ID]);
    expect(controller.state.analysis.cutability).toMatchObject({
      documentFingerprint: fingerprintCutabilityDocument(
        controller.state.project.document,
      ),
      analyzedObjectIds: [ISLAND_ID, OUTER_ID].sort(),
    });
    expect(counter.calls).toBe(1);

    await controller.runCutabilityAnalysis(SECOND_OPERATION_ID, []);
    const analysis = controller.state.analysis.cutability;
    if (analysis === null) throw new Error("Expected whole-design analysis.");
    const islandIssues = analysis.issues.filter(
      (issue) => issue.code === "DISCONNECTED_ISLAND",
    );
    expect(islandIssues.map((issue) => issue.id)).toEqual([
      "DISCONNECTED_ISLAND:1",
      "DISCONNECTED_ISLAND:2",
    ]);
    expect(new Set(islandIssues.map((issue) => issue.id)).size).toBe(2);
    expect(analysis.analyzedObjectIds).toEqual([
      ISLAND_ID,
      SECOND_ISLAND_ID,
      OUTER_ID,
      SECOND_OUTER_ID,
    ].sort());
    expect(counter.calls).toBe(2);
    await controller.runCutabilityAnalysis(OPERATION_ID, []);
    expect(counter.calls).toBe(2);

    const target = islandIssues.find(
      (issue) => issue.objectId === SECOND_ISLAND_ID,
    );
    if (target === undefined) throw new Error("Expected the second-layer island.");
    await controller.focusCutabilityIssue(target.id);
    expect(controller.state.editor.selectionIds).toEqual([SECOND_ISLAND_ID]);

    const untouchedBefore = controller.state.project.document.objects
      .filter((object) => object.id === OUTER_ID || object.id === ISLAND_ID);
    expect(await controller.previewBridge({
      issueId: target.id,
      widthMm: 2,
      mode: "manual",
      direction: "right",
    })).toMatchObject({ ok: true });
    expect(controller.state.analysis.bridgeProposal?.sourceObjectIds).toEqual([
      SECOND_OUTER_ID,
      SECOND_ISLAND_ID,
    ]);

    expect(await controller.acceptBridge()).toMatchObject({ ok: true });
    expect(counter.calls).toBe(3);
    expect(controller.state.analysis.scope).toEqual({
      kind: "whole-design",
      layerId: null,
      layerName: null,
    });
    expect(controller.state.analysis.cutability?.analyzedObjectIds).toEqual(
      controller.state.project.document.objects.map((object) => object.id).sort(),
    );
    expect(controller.state.project.document.objects
      .filter((object) => object.id === OUTER_ID || object.id === ISLAND_ID))
      .toEqual(untouchedBefore);
    expect(controller.state.project.document.objects.some(
      (object) => object.id === SECOND_ISLAND_ID,
    )).toBe(false);

    await controller.editorAction({ type: "history.undo" });
    expect(controller.state.analysis.cutability).toBeNull();
    await controller.runCutabilityAnalysis(OPERATION_ID, []);
    expect(counter.calls).toBe(4);
  });

  it("re-analyzes the mapped successful selection after bridge acceptance", async () => {
    const controller = await desktop(immediateWorker());
    await controller.runCutabilityAnalysis(
      OPERATION_ID,
      [OUTER_ID, ISLAND_ID],
    );
    const issue = controller.state.analysis.cutability?.issues.find(
      (candidate) => candidate.code === "DISCONNECTED_ISLAND",
    );
    if (issue === undefined) throw new Error("Expected a disconnected island issue.");
    await controller.previewBridge({
      issueId: issue.id,
      widthMm: 2,
      mode: "automatic",
    });

    expect(await controller.acceptBridge()).toMatchObject({ ok: true });
    const analyzedObjectIds = controller.state.analysis.cutability?.analyzedObjectIds;
    expect(analyzedObjectIds).toEqual(
      controller.state.project.document.objects.map((object) => object.id).sort(),
    );
    expect(analyzedObjectIds).not.toContain(ISLAND_ID);
    expect(controller.state.analysis.scope).toEqual({
      kind: "selection",
      layerId: null,
      layerName: null,
      objectIds: analyzedObjectIds,
    });
  });

  it("re-analyzes current authoritative physical-layer IDs after bridge acceptance", async () => {
    const controller = await desktop(
      immediateWorker(),
      twoLayerNestedProject(),
    );
    await controller.runManufacturingLayerAnalysis(
      OPERATION_ID,
      SECOND_LAYER_ID,
    );
    const issue = controller.state.analysis.cutability?.issues.find(
      (candidate) => candidate.code === "DISCONNECTED_ISLAND",
    );
    if (issue === undefined) throw new Error("Expected a disconnected island issue.");
    await controller.previewBridge({
      issueId: issue.id,
      widthMm: 2,
      mode: "automatic",
    });

    expect(await controller.acceptBridge()).toMatchObject({ ok: true });
    const currentLayerObjectIds = controller.state.project.document.objects
      .filter((object) => object.layerId === SECOND_LAYER_ID)
      .map((object) => object.id)
      .sort();
    expect(controller.state.analysis.scope).toEqual({
      kind: "manufacturing-layer",
      layerId: SECOND_LAYER_ID,
      layerName: "Backing",
    });
    expect(controller.state.analysis.cutability?.analyzedObjectIds).toEqual(
      currentLayerObjectIds,
    );
    expect(controller.state.analysis.cutability?.analyzedObjectIds).not.toContain(
      OUTER_ID,
    );
  });

  it("rejects a worker response for a different operation", async () => {
    const worker: CutabilityWorkerPort = {
      run: (request) => Promise.resolve(analyzeDocumentCutability(
        request.document,
        { operationId: SECOND_OPERATION_ID, objectIds: request.objectIds },
      )),
    };
    const controller = await desktop(worker);

    expect(await controller.runCutabilityAnalysis(OPERATION_ID, [])).toMatchObject({
      ok: false,
      error: "Manufacturing analysis worker returned a mismatched operation ID.",
    });
    expect(controller.state.analysis.cutability).toBeNull();
  });
});
