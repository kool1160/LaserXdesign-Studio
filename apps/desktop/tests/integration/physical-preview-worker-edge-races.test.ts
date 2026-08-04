import {
  createBlankProject,
  identityTransform,
  type LaserxProject,
  type Layer,
} from "@laserx/domain";
import { describe, expect, it } from "vitest";

import {
  PhysicalPreviewCoordinator,
  PhysicalPreviewSupersededError,
} from "../../electron/physical-preview-coordinator.js";
import {
  PhysicalPreviewCancelledError,
  type PhysicalPreviewWorkerPort,
} from "../../electron/physical-preview-worker-service.js";
import {
  runPhysicalPreviewTask,
  type PhysicalPreviewTaskProgress,
  type PhysicalPreviewTaskRequest,
  type PhysicalPreviewTaskResult,
} from "../../../../packages/physical-preview-3d/src/task.js";

const LAYER_ID = "aaaaaaaa-1000-4000-8000-000000000001";

function layer(): Layer {
  return {
    id: LAYER_ID,
    name: "Face",
    visible: true,
    locked: false,
    manufacturing: {
      role: "face",
      material: "mild-steel",
      thicknessMm: 3,
      stockThicknessDesignation: null,
      process: "laser",
      notes: "",
      registrationGroup: null,
      registrationHoleIds: [],
    },
  };
}

function project(updatedAt: string, widthMm: number): LaserxProject {
  return createBlankProject({
    id: "cccccccc-1000-4000-8000-000000000001",
    documentId: "cccccccc-1000-4000-8000-000000000002",
    name: "Preview Race Fixture",
    now: updatedAt,
    width: 200,
    height: 100,
    inputUnit: "millimeters",
    layers: [layer()],
    activeLayerId: LAYER_ID,
    objects: [
      {
        id: "dddddddd-1000-4000-8000-000000000001",
        type: "rectangle",
        layerId: LAYER_ID,
        transform: identityTransform(),
        origin: { xMm: 0, yMm: 0 },
        widthMm,
        heightMm: 40,
      },
    ],
  });
}

interface Pending {
  request: PhysicalPreviewTaskRequest;
  onProgress?: (progress: PhysicalPreviewTaskProgress) => void;
  resolve: (result: PhysicalPreviewTaskResult) => void;
}

class AbortIgnoringWorker implements PhysicalPreviewWorkerPort {
  public readonly calls: Pending[] = [];

  public run(
    request: PhysicalPreviewTaskRequest,
    _signal: AbortSignal,
    onProgress?: (progress: PhysicalPreviewTaskProgress) => void,
  ): Promise<PhysicalPreviewTaskResult> {
    return new Promise((resolve) => {
      this.calls.push({
        request,
        ...(onProgress === undefined ? {} : { onProgress }),
        resolve,
      });
    });
  }

  public progress(index: number, percent: number): void {
    const pending = this.calls[index];
    if (pending === undefined) throw new Error("Expected pending worker call.");
    pending.onProgress?.({
      operationId: pending.request.operationId,
      inputFingerprint: pending.request.inputFingerprint,
      stage: "building",
      percent,
      message: "late progress",
    });
  }

  public complete(index: number): void {
    const pending = this.calls[index];
    if (pending === undefined) throw new Error("Expected pending worker call.");
    pending.resolve(runPhysicalPreviewTask(pending.request));
  }
}

class AbortRespectingWorker implements PhysicalPreviewWorkerPort {
  public readonly requests: PhysicalPreviewTaskRequest[] = [];

  public run(
    request: PhysicalPreviewTaskRequest,
    signal: AbortSignal,
  ): Promise<PhysicalPreviewTaskResult> {
    this.requests.push(request);
    return new Promise((_resolve, reject) => {
      signal.addEventListener(
        "abort",
        () => reject(new PhysicalPreviewCancelledError()),
        { once: true },
      );
    });
  }
}

describe("physical preview edge races", () => {
  it("supersedes an active worker before returning a newer cached scene", async () => {
    const worker = new AbortIgnoringWorker();
    const coordinator = new PhysicalPreviewCoordinator(worker);
    const cachedProject = project("2026-08-04T13:00:00.000Z", 80);

    const seedPromise = coordinator.build(cachedProject);
    worker.complete(0);
    await seedPromise;

    const staleProgress: number[] = [];
    const staleOutcome = coordinator
      .build(project("2026-08-04T13:01:00.000Z", 120), undefined, {
        onProgress: (event) => staleProgress.push(event.percent),
      })
      .catch((error: unknown) => error);

    const cached = await coordinator.build(cachedProject);
    expect(cached.cacheHit).toBe(true);

    worker.progress(1, 75);
    worker.complete(1);

    expect(await staleOutcome).toBeInstanceOf(PhysicalPreviewSupersededError);
    expect(staleProgress).toEqual([]);
    expect(worker.calls).toHaveLength(2);
  });

  it("rejects success from a worker that ignores an external abort", async () => {
    const worker = new AbortIgnoringWorker();
    const coordinator = new PhysicalPreviewCoordinator(worker);
    const controller = new AbortController();

    const outcome = coordinator
      .build(project("2026-08-04T13:02:00.000Z", 90), undefined, {
        signal: controller.signal,
      })
      .catch((error: unknown) => error);

    controller.abort();
    worker.complete(0);

    expect(await outcome).toBeInstanceOf(PhysicalPreviewCancelledError);
    expect(coordinator.cacheSize).toBe(0);
  });

  it("keeps manual cancellation distinct from supersession", async () => {
    const worker = new AbortIgnoringWorker();
    const coordinator = new PhysicalPreviewCoordinator(worker);

    const outcome = coordinator
      .build(project("2026-08-04T13:03:00.000Z", 100))
      .catch((error: unknown) => error);
    coordinator.cancelActive();
    worker.complete(0);

    const error = await outcome;
    expect(error).toBeInstanceOf(PhysicalPreviewCancelledError);
    expect(error).not.toBeInstanceOf(PhysicalPreviewSupersededError);
  });

  it("terminates ordinary superseded work through the worker abort signal", async () => {
    const worker = new AbortRespectingWorker();
    const coordinator = new PhysicalPreviewCoordinator(worker);

    const first = coordinator
      .build(project("2026-08-04T13:04:00.000Z", 110))
      .catch((error: unknown) => error);
    const second = coordinator
      .build(project("2026-08-04T13:05:00.000Z", 130))
      .catch((error: unknown) => error);

    expect(await first).toBeInstanceOf(PhysicalPreviewSupersededError);
    expect(worker.requests).toHaveLength(2);
    coordinator.cancelActive();
    expect(await second).toBeInstanceOf(PhysicalPreviewCancelledError);
  });
});
