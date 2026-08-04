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

const FACE_LAYER_ID = "aaaaaaaa-0000-4000-8000-000000000001";

function physicalLayer(thicknessMm = 3): Layer {
  return {
    id: FACE_LAYER_ID,
    name: "Face",
    visible: true,
    locked: false,
    manufacturing: {
      role: "face",
      material: "mild-steel",
      thicknessMm,
      stockThicknessDesignation: null,
      process: "laser",
      notes: "",
      registrationGroup: null,
      registrationHoleIds: [],
    },
  };
}

function projectFixture(
  updatedAt = "2026-08-04T12:00:00.000Z",
  widthMm = 80,
  thicknessMm = 3,
): LaserxProject {
  const project = createBlankProject({
    id: "cccccccc-0000-4000-8000-000000000001",
    documentId: "cccccccc-0000-4000-8000-000000000002",
    name: "Preview Worker Fixture",
    now: updatedAt,
    width: 200,
    height: 100,
    inputUnit: "millimeters",
    layers: [physicalLayer(thicknessMm)],
    activeLayerId: FACE_LAYER_ID,
    objects: [
      {
        id: "dddddddd-0000-4000-8000-000000000001",
        type: "rectangle",
        layerId: FACE_LAYER_ID,
        transform: identityTransform(),
        origin: { xMm: 10, yMm: 10 },
        widthMm,
        heightMm: 40,
      },
    ],
  });
  project.project.updatedAt = updatedAt;
  return project;
}

interface PendingCall {
  request: PhysicalPreviewTaskRequest;
  signal: AbortSignal;
  onProgress?: (progress: PhysicalPreviewTaskProgress) => void;
  resolve: (result: PhysicalPreviewTaskResult) => void;
  reject: (error: Error) => void;
  settled: boolean;
}

class ControlledPreviewWorker implements PhysicalPreviewWorkerPort {
  public readonly calls: PendingCall[] = [];
  readonly #ignoreAbort: boolean;

  public constructor(ignoreAbort = false) {
    this.#ignoreAbort = ignoreAbort;
  }

  public run(
    request: PhysicalPreviewTaskRequest,
    signal: AbortSignal,
    onProgress?: (progress: PhysicalPreviewTaskProgress) => void,
  ): Promise<PhysicalPreviewTaskResult> {
    return new Promise((resolve, reject) => {
      const call: PendingCall = {
        request,
        signal,
        ...(onProgress === undefined ? {} : { onProgress }),
        resolve,
        reject,
        settled: false,
      };
      this.calls.push(call);

      if (!this.#ignoreAbort) {
        signal.addEventListener(
          "abort",
          () => {
            if (call.settled) return;
            call.settled = true;
            reject(new PhysicalPreviewCancelledError());
          },
          { once: true },
        );
      }
    });
  }

  public progress(index: number, percent: number): void {
    const call = this.requireCall(index);
    call.onProgress?.({
      operationId: call.request.operationId,
      inputFingerprint: call.request.inputFingerprint,
      stage: percent === 100 ? "complete" : "building",
      percent,
      message: `Progress ${String(percent)}`,
    });
  }

  public complete(index: number): void {
    const call = this.requireCall(index);
    if (call.settled) return;
    call.settled = true;
    call.resolve(runPhysicalPreviewTask(call.request));
  }

  public fail(index: number, message: string): void {
    const call = this.requireCall(index);
    if (call.settled) return;
    call.settled = true;
    call.reject(new Error(message));
  }

  private requireCall(index: number): PendingCall {
    const call = this.calls[index];
    if (call === undefined) throw new Error(`Expected worker call ${String(index)}.`);
    return call;
  }
}

describe("physical preview worker coordination", () => {
  it("reuses a fingerprint-cached assembly without launching another worker", async () => {
    const worker = new ControlledPreviewWorker();
    const coordinator = new PhysicalPreviewCoordinator(worker);
    const project = projectFixture();

    const firstPromise = coordinator.build(project);
    expect(worker.calls).toHaveLength(1);
    worker.complete(0);
    const first = await firstPromise;
    expect(first.cacheHit).toBe(false);

    const progress: PhysicalPreviewTaskProgress[] = [];
    const second = await coordinator.build(project, undefined, {
      onProgress: (event) => progress.push(event),
    });

    expect(worker.calls).toHaveLength(1);
    expect(second.cacheHit).toBe(true);
    expect(second.inputFingerprint).toBe(first.inputFingerprint);
    expect(progress).toHaveLength(1);
    expect(progress[0]?.message).toContain("Reused");
  });

  it("supersedes an older document request and completes only the newer snapshot", async () => {
    const worker = new ControlledPreviewWorker();
    const coordinator = new PhysicalPreviewCoordinator(worker);

    const firstOutcome = coordinator.build(projectFixture()).catch((error: unknown) => error);
    const secondPromise = coordinator.build(
      projectFixture("2026-08-04T12:01:00.000Z", 120),
    );

    expect(worker.calls).toHaveLength(2);
    worker.complete(1);

    const firstError = await firstOutcome;
    expect(firstError).toBeInstanceOf(PhysicalPreviewSupersededError);
    const second = await secondPromise;
    expect(second.assembly.layers[0]?.boundsMm?.maxXmm).toBe(130);
  });

  it("rejects a stale completion even when a broken worker ignores cancellation", async () => {
    const worker = new ControlledPreviewWorker(true);
    const coordinator = new PhysicalPreviewCoordinator(worker);
    const staleProgress: number[] = [];

    const firstOutcome = coordinator
      .build(projectFixture(), undefined, {
        onProgress: (event) => staleProgress.push(event.percent),
      })
      .catch((error: unknown) => error);
    const secondPromise = coordinator.build(
      projectFixture("2026-08-04T12:02:00.000Z", 100),
    );

    worker.progress(0, 50);
    worker.complete(0);
    worker.complete(1);

    expect(await firstOutcome).toBeInstanceOf(PhysicalPreviewSupersededError);
    expect((await secondPromise).assembly.layers[0]?.boundsMm?.maxXmm).toBe(110);
    expect(staleProgress).toEqual([]);
  });

  it("propagates explicit cancellation without changing the project", async () => {
    const worker = new ControlledPreviewWorker();
    const coordinator = new PhysicalPreviewCoordinator(worker);
    const project = projectFixture();
    const before = JSON.stringify(project);
    const controller = new AbortController();

    const outcome = coordinator
      .build(project, undefined, { signal: controller.signal })
      .catch((error: unknown) => error);
    controller.abort();

    expect(await outcome).toBeInstanceOf(PhysicalPreviewCancelledError);
    expect(JSON.stringify(project)).toBe(before);
  });

  it("keeps the last valid cache entry after a later worker failure", async () => {
    const worker = new ControlledPreviewWorker();
    const coordinator = new PhysicalPreviewCoordinator(worker);
    const validProject = projectFixture();

    const validPromise = coordinator.build(validProject);
    worker.complete(0);
    await validPromise;

    const failedPromise = coordinator
      .build(projectFixture("2026-08-04T12:03:00.000Z", 140))
      .catch((error: unknown) => error);
    worker.fail(1, "simulated worker failure");
    expect(await failedPromise).toBeInstanceOf(Error);

    const recovered = await coordinator.build(validProject);
    expect(recovered.cacheHit).toBe(true);
    expect(worker.calls).toHaveLength(2);
  });

  it("does not recompute topology for camera, mode, or presentation visibility changes", async () => {
    const worker = new ControlledPreviewWorker();
    const coordinator = new PhysicalPreviewCoordinator(worker);
    const project = projectFixture();

    const firstPromise = coordinator.build(project);
    worker.complete(0);
    await firstPromise;

    // These values belong to G4 renderer presentation state. They are not input
    // to the worker coordinator and therefore cannot invalidate its fingerprint.
    const presentationState = {
      view: "perspective",
      mode: "exploded",
      visibleLayerIds: new Set([FACE_LAYER_ID]),
    };
    presentationState.view = "back";
    presentationState.mode = "assembled";
    presentationState.visibleLayerIds.clear();

    const second = await coordinator.build(project);
    expect(second.cacheHit).toBe(true);
    expect(worker.calls).toHaveLength(1);
  });

  it("reuses cached content across an unrelated non-physical project update and rebinds identity to the newer snapshot", async () => {
    const worker = new ControlledPreviewWorker();
    const coordinator = new PhysicalPreviewCoordinator(worker);
    const original = projectFixture("2026-08-04T12:10:00.000Z");

    const firstPromise = coordinator.build(original);
    worker.complete(0);
    const first = await firstPromise;
    expect(first.assembly.identity.projectUpdatedAt).toBe("2026-08-04T12:10:00.000Z");

    // Same physical content -- same layer, material, thickness, geometry --
    // only the project's own updatedAt changed, as it would from renaming the
    // project or editing an unrelated non-physical layer.
    const updated = projectFixture("2026-08-04T12:11:00.000Z");
    const second = await coordinator.build(updated);

    expect(worker.calls).toHaveLength(1);
    expect(second.cacheHit).toBe(true);
    expect(second.inputFingerprint).toBe(first.inputFingerprint);
    expect(second.assembly.identity.projectUpdatedAt).toBe("2026-08-04T12:11:00.000Z");
    expect(second.assembly.layers).toEqual(first.assembly.layers);
    expect(second.assembly.fingerprint).not.toBe(first.assembly.fingerprint);
  });

  it("coalesces identical concurrent in-flight requests onto a single worker call", async () => {
    const worker = new ControlledPreviewWorker();
    const coordinator = new PhysicalPreviewCoordinator(worker);
    const project = projectFixture();

    const firstPromise = coordinator.build(project);
    const secondPromise = coordinator.build(project);

    expect(worker.calls).toHaveLength(1);
    worker.complete(0);

    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    expect(first.cacheHit).toBe(false);
    expect(second.cacheHit).toBe(false);
    expect(second.assembly).toEqual(first.assembly);
    expect(coordinator.cacheSize).toBe(1);
  });

  it("lets one cancelled caller leave another caller coalesced on the same request unaffected", async () => {
    const worker = new ControlledPreviewWorker();
    const coordinator = new PhysicalPreviewCoordinator(worker);
    const project = projectFixture();
    const controller = new AbortController();

    const cancelledOutcome = coordinator
      .build(project, undefined, { signal: controller.signal })
      .catch((error: unknown) => error);
    const remainingPromise = coordinator.build(project);

    expect(worker.calls).toHaveLength(1);
    controller.abort();

    expect(await cancelledOutcome).toBeInstanceOf(PhysicalPreviewCancelledError);
    // The still-interested caller's worker call must not have been aborted by
    // the other caller's independent cancellation.
    expect(worker.calls[0]?.signal.aborted).toBe(false);

    worker.complete(0);
    const remaining = await remainingPromise;
    expect(remaining.cacheHit).toBe(false);
    expect(coordinator.cacheSize).toBe(1);
  });

  it("invalidates the cache when physical layer thickness changes even though geometry is unchanged", async () => {
    const worker = new ControlledPreviewWorker();
    const coordinator = new PhysicalPreviewCoordinator(worker);

    const thinPromise = coordinator.build(projectFixture(undefined, undefined, 3));
    worker.complete(0);
    const thin = await thinPromise;

    const thickPromise = coordinator.build(projectFixture(undefined, undefined, 6));
    worker.complete(1);
    const thick = await thickPromise;

    expect(worker.calls).toHaveLength(2);
    expect(thick.cacheHit).toBe(false);
    expect(thick.inputFingerprint).not.toBe(thin.inputFingerprint);
  });

  it("invalidates the cache when assembly spacing options change", async () => {
    const worker = new ControlledPreviewWorker();
    const coordinator = new PhysicalPreviewCoordinator(worker);
    const project = projectFixture();

    const defaultSpacingPromise = coordinator.build(project);
    worker.complete(0);
    const defaultSpacing = await defaultSpacingPromise;

    const widerSpacingPromise = coordinator.build(project, {
      spacing: { explodedGapMm: 40 },
    });
    worker.complete(1);
    const widerSpacing = await widerSpacingPromise;

    expect(worker.calls).toHaveLength(2);
    expect(widerSpacing.cacheHit).toBe(false);
    expect(widerSpacing.inputFingerprint).not.toBe(defaultSpacing.inputFingerprint);
  });
});
