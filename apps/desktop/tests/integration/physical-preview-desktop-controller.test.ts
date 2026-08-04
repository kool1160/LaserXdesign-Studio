import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createBlankProject,
  identityTransform,
  type LaserxProject,
} from "@laserx/domain";
import { afterEach, describe, expect, it } from "vitest";

import {
  DesktopController,
  type DesktopDialogs,
} from "../../electron/desktop-controller.js";
import {
  PhysicalPreviewCancelledError,
  type PhysicalPreviewWorkerPort,
} from "../../electron/physical-preview-worker-service.js";
import {
  runPhysicalPreviewTask,
  type PhysicalPreviewTaskRequest,
  type PhysicalPreviewTaskResult,
} from "../../../../packages/physical-preview-3d/src/task.js";

const OPERATION_ID = "a0000000-0000-4000-8000-000000000001";
const SECOND_OPERATION_ID = "a0000000-0000-4000-8000-000000000002";
const FACE_LAYER_ID = "b0000000-0000-4000-8000-000000000001";
const RECTANGLE_ID = "c0000000-0000-4000-8000-000000000001";
const temporaryDirectories: string[] = [];
const controllers: DesktopController[] = [];

function physicalProject(widthMm = 80): LaserxProject {
  return createBlankProject({
    id: "e0000000-0000-4000-8000-000000000001",
    documentId: "e0000000-0000-4000-8000-000000000002",
    now: "2026-08-04T12:00:00.000Z",
    width: 200,
    height: 100,
    layers: [
      {
        id: FACE_LAYER_ID,
        name: "Face",
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
    ],
    activeLayerId: FACE_LAYER_ID,
    objects: [
      {
        id: RECTANGLE_ID,
        type: "rectangle",
        layerId: FACE_LAYER_ID,
        transform: identityTransform(),
        origin: { xMm: 10, yMm: 10 },
        widthMm,
        heightMm: 40,
      },
    ],
  });
}

function immediateWorker(counter?: { calls: number }): PhysicalPreviewWorkerPort {
  return {
    run: (request, _signal, onProgress) => {
      if (counter !== undefined) counter.calls += 1;
      onProgress?.({
        operationId: request.operationId,
        inputFingerprint: request.inputFingerprint,
        stage: "building",
        percent: 50,
        message: "Analyzing physical layers.",
      });
      return Promise.resolve(runPhysicalPreviewTask(request));
    },
  };
}

interface PendingCall {
  request: PhysicalPreviewTaskRequest;
  resolve: (result: PhysicalPreviewTaskResult) => void;
  reject: (error: Error) => void;
  settled: boolean;
}

class DeferredWorker implements PhysicalPreviewWorkerPort {
  public readonly calls: PendingCall[] = [];

  public run(
    request: PhysicalPreviewTaskRequest,
    signal: AbortSignal,
  ): Promise<PhysicalPreviewTaskResult> {
    return new Promise((resolve, reject) => {
      const call: PendingCall = { request, resolve, reject, settled: false };
      this.calls.push(call);
      signal.addEventListener(
        "abort",
        () => {
          if (call.settled) return;
          call.settled = true;
          reject(new PhysicalPreviewCancelledError());
        },
        { once: true },
      );
    });
  }

  public complete(index: number): void {
    const call = this.calls[index];
    if (call === undefined) throw new Error(`Expected worker call ${String(index)}.`);
    if (call.settled) return;
    call.settled = true;
    call.resolve(runPhysicalPreviewTask(call.request));
  }

  public fail(index: number, message: string): void {
    const call = this.calls[index];
    if (call === undefined) throw new Error(`Expected worker call ${String(index)}.`);
    if (call.settled) return;
    call.settled = true;
    call.reject(new Error(message));
  }
}

async function desktop(
  worker: PhysicalPreviewWorkerPort,
  project = physicalProject(),
): Promise<DesktopController> {
  const directory = await mkdtemp(join(tmpdir(), "laserx-physical-preview-"));
  temporaryDirectories.push(directory);
  const path = join(directory, "physical.laserx");
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
    physicalPreviewWorker: worker,
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

describe("physical preview desktop controller wiring", () => {
  it("builds the physical preview from the currently open document and publishes it in state", async () => {
    const counter = { calls: 0 };
    const controller = await desktop(immediateWorker(counter));

    expect(await controller.runPhysicalPreview(OPERATION_ID)).toMatchObject({ ok: true });
    expect(controller.state.physicalPreview.job).toBeNull();
    expect(controller.state.physicalPreview.assembly).toMatchObject({
      status: "complete",
      layers: [{ layerId: FACE_LAYER_ID, thicknessMm: 3 }],
    });
    expect(controller.state.physicalPreview.assembly?.identity.projectId).toBe(
      controller.state.project.id,
    );
    expect(counter.calls).toBe(1);
  });

  it("reuses the cached build for an identical request without a second worker call", async () => {
    const counter = { calls: 0 };
    const controller = await desktop(immediateWorker(counter));

    await controller.runPhysicalPreview(OPERATION_ID);
    await controller.runPhysicalPreview(SECOND_OPERATION_ID);
    expect(counter.calls).toBe(1);
  });

  it("discards a stale completion when the physical content changes before the worker settles", async () => {
    const worker = new DeferredWorker();
    const controller = await desktop(worker, physicalProject(80));

    const firstPromise = controller.runPhysicalPreview(OPERATION_ID);
    await Promise.resolve();
    expect(worker.calls).toHaveLength(1);

    // A real physical-content change: moves the rectangle on the physical
    // face layer, which changes fingerprintPhysicalPreviewInput's payload.
    await controller.editorAction({
      type: "objects.move",
      objectIds: [RECTANGLE_ID],
      deltaXmm: 20,
      deltaYmm: 0,
    });

    const secondPromise = controller.runPhysicalPreview(SECOND_OPERATION_ID);
    await Promise.resolve();
    expect(worker.calls).toHaveLength(2);

    // The abandoned first worker call settles late; its result must never
    // become the published assembly.
    worker.complete(0);
    worker.complete(1);

    expect(await firstPromise).toMatchObject({ ok: true });
    expect(await secondPromise).toMatchObject({ ok: true });

    const assembly = controller.state.physicalPreview.assembly;
    // Original rectangle: origin xMm=10, widthMm=80 -> moved +20 -> origin
    // xMm=30, so the new bound is 30 + 80 = 110, not the original 10 + 80 = 90.
    expect(assembly?.layers[0]?.boundsMm?.maxXmm).toBe(110);
  });

  it("stops exposing the last-valid assembly once physical content changes without a new build request", async () => {
    const controller = await desktop(immediateWorker(), physicalProject(80));
    await controller.runPhysicalPreview(OPERATION_ID);
    expect(controller.state.physicalPreview.assembly).not.toBeNull();

    // No second runPhysicalPreview call: the document changes, but nobody
    // asks for a fresh preview. The previously built assembly no longer
    // matches the current physical content and must not stay on display.
    await controller.editorAction({
      type: "objects.move",
      objectIds: [RECTANGLE_ID],
      deltaXmm: 20,
      deltaYmm: 0,
    });

    expect(controller.state.physicalPreview.assembly).toBeNull();
  });

  it("does not resurrect a stale assembly when a rebuild fails after a physical edit", async () => {
    const worker = new DeferredWorker();
    const controller = await desktop(worker, physicalProject(80));

    const firstPromise = controller.runPhysicalPreview(OPERATION_ID);
    worker.complete(0);
    await firstPromise;
    expect(controller.state.physicalPreview.assembly).not.toBeNull();

    await controller.editorAction({
      type: "objects.move",
      objectIds: [RECTANGLE_ID],
      deltaXmm: 20,
      deltaYmm: 0,
    });
    expect(controller.state.physicalPreview.assembly).toBeNull();

    const secondPromise = controller.runPhysicalPreview(SECOND_OPERATION_ID);
    worker.fail(1, "Injected physical preview failure.");
    expect(await secondPromise).toMatchObject({ ok: false });

    // The internal field still holds the earlier, now content-mismatched
    // assembly (the failure path never touches it) -- the state getter must
    // still refuse to expose it.
    expect(controller.state.physicalPreview.assembly).toBeNull();
  });

  it("cancels an in-flight build without mutating the document, dirty flag, history, or selection", async () => {
    const worker = new DeferredWorker();
    const controller = await desktop(worker);
    const beforeDocument = JSON.stringify(controller.state.project.document);
    const beforeDirty = controller.state.dirty;
    const beforeUndoDepth = controller.state.editor.history.undoDepth;
    const beforeSelection = controller.state.editor.selectionIds;

    const outcome = controller.runPhysicalPreview(OPERATION_ID);
    await Promise.resolve();
    expect(await controller.cancelPhysicalPreview(OPERATION_ID)).toMatchObject({ ok: true });
    await outcome;

    expect(controller.state.physicalPreview.job).toBeNull();
    expect(controller.state.physicalPreview.assembly).toBeNull();
    expect(JSON.stringify(controller.state.project.document)).toBe(beforeDocument);
    expect(controller.state.dirty).toBe(beforeDirty);
    expect(controller.state.editor.history.undoDepth).toBe(beforeUndoDepth);
    expect(controller.state.editor.selectionIds).toEqual(beforeSelection);
  });

  it("clears the previous physical preview job and assembly when a different project is opened", async () => {
    const controller = await desktop(immediateWorker(), physicalProject());
    await controller.runPhysicalPreview(OPERATION_ID);
    expect(controller.state.physicalPreview.assembly).not.toBeNull();

    await controller.newProject();

    expect(controller.state.physicalPreview.job).toBeNull();
    expect(controller.state.physicalPreview.assembly).toBeNull();
  });

  it("running and cancelling physical preview never mutates the document, dirty flag, history, or selection", async () => {
    const counter = { calls: 0 };
    const controller = await desktop(immediateWorker(counter));
    const beforeDocument = JSON.stringify(controller.state.project.document);
    const beforeDirty = controller.state.dirty;
    const beforeUndoDepth = controller.state.editor.history.undoDepth;
    const beforeSelection = controller.state.editor.selectionIds;

    await controller.runPhysicalPreview(OPERATION_ID);

    expect(JSON.stringify(controller.state.project.document)).toBe(beforeDocument);
    expect(controller.state.dirty).toBe(beforeDirty);
    expect(controller.state.editor.history.undoDepth).toBe(beforeUndoDepth);
    expect(controller.state.editor.selectionIds).toEqual(beforeSelection);
  });
});
