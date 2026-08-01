import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { analyzeDocumentCutability } from "@laserx/cutability";
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
const LAYER_ID = "b0000000-0000-4000-8000-000000000001";
const OUTER_ID = "c0000000-0000-4000-8000-000000000001";
const ISLAND_ID = "d0000000-0000-4000-8000-000000000001";
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

async function desktop(worker: CutabilityWorkerPort): Promise<DesktopController> {
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
      read: () => Promise.resolve(nestedProject()),
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
  it("caches exact analysis and invalidates it after a document command", async () => {
    const counter = { calls: 0 };
    const controller = await desktop(immediateWorker(counter));

    expect(await controller.runCutabilityAnalysis(OPERATION_ID, [])).toMatchObject({ ok: true });
    expect(controller.state.analysis.cutability).toMatchObject({
      status: "complete",
      errorCount: 1,
    });
    expect(counter.calls).toBe(1);
    expect(await controller.runCutabilityAnalysis(SECOND_OPERATION_ID, [])).toMatchObject({ ok: true });
    expect(counter.calls).toBe(1);

    await controller.editorAction({ type: "objects.move", objectIds: [ISLAND_ID], deltaXmm: 1, deltaYmm: 0 });
    expect(controller.state.analysis.cutability).toBeNull();
    expect(await controller.runCutabilityAnalysis(SECOND_OPERATION_ID, [])).toMatchObject({ ok: true });
    expect(counter.calls).toBe(2);
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
    const controller = await desktop(immediateWorker());
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
    expect(controller.state.editor.history.undoDepth).toBe(1);
    expect(JSON.stringify(controller.state.project.document)).not.toBe(before);
    await controller.editorAction({ type: "history.undo" });
    expect(JSON.stringify(controller.state.project.document)).toBe(before);
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
