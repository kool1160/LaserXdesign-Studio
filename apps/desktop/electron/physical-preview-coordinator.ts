import type { LaserxProject } from "@laserx/domain";

import { PhysicalPreviewAssemblyCache } from "../../../packages/physical-preview-3d/src/cache.js";
import {
  rebindPhysicalPreviewAssemblyIdentity,
  type BuildPhysicalPreviewAssemblyOptions,
  type PhysicalPreviewAssembly,
} from "../../../packages/physical-preview-3d/src/index.js";
import {
  createPhysicalPreviewTaskRequest,
  type PhysicalPreviewTaskProgress,
  type PhysicalPreviewTaskRequest,
  type PhysicalPreviewTaskResult,
} from "../../../packages/physical-preview-3d/src/task.js";

import {
  PhysicalPreviewCancelledError,
  type PhysicalPreviewWorkerPort,
} from "./physical-preview-worker-service.js";

export class PhysicalPreviewSupersededError extends Error {
  public constructor() {
    super("A newer document snapshot superseded this physical preview request.");
    this.name = "PhysicalPreviewSupersededError";
  }
}

export interface PhysicalPreviewCoordinatorOptions {
  signal?: AbortSignal;
  onProgress?: (progress: PhysicalPreviewTaskProgress) => void;
}

export interface PhysicalPreviewCoordinatorResult {
  operationId: string;
  inputFingerprint: string;
  assembly: PhysicalPreviewAssembly;
  cacheHit: boolean;
}

type CancellationReason = "manual" | "superseded" | null;

interface ActiveWaiter {
  operationId: string;
  /** This waiter's own requesting snapshot — used to rebind identity on settle. */
  project: LaserxProject;
  onProgress?: (progress: PhysicalPreviewTaskProgress) => void;
  resolve: (result: PhysicalPreviewCoordinatorResult) => void;
  reject: (error: Error) => void;
}

interface ActiveRequest {
  inputFingerprint: string;
  controller: AbortController;
  waiters: ActiveWaiter[];
  cancellationReason: CancellationReason;
}

/**
 * Coordinates immutable preview snapshots across the dedicated worker.
 *
 * Only physical project content and assembly spacing enter the task
 * fingerprint (see `fingerprintPhysicalPreviewInput`); unrelated project
 * metadata such as `project.project.updatedAt` never invalidates the cache or
 * an in-flight request, and a cache hit is always rebound to the exact
 * requesting snapshot via `rebindPhysicalPreviewAssemblyIdentity` before it is
 * returned. Camera/view/mode/visibility are renderer presentation state and
 * never call this coordinator, so those interactions reuse the accepted
 * assembly and do not recompute topology.
 *
 * A `build()` call whose fingerprint matches the request currently in flight
 * coalesces onto that single worker call instead of aborting and restarting
 * it. Every waiter still receives a result bound to its own project snapshot.
 * Each waiter's own `signal` cancels only that waiter — other waiters
 * coalesced onto the same worker call are unaffected — unless the cancelling
 * waiter was the last one left, in which case the now-unwanted worker call is
 * aborted.
 */
export class PhysicalPreviewCoordinator {
  readonly #worker: PhysicalPreviewWorkerPort;
  readonly #cache: PhysicalPreviewAssemblyCache;
  #operationSequence = 0;
  #active: ActiveRequest | null = null;

  public constructor(
    worker: PhysicalPreviewWorkerPort,
    cache = new PhysicalPreviewAssemblyCache(),
  ) {
    this.#worker = worker;
    this.#cache = cache;
  }

  public get cacheSize(): number {
    return this.#cache.size;
  }

  public async build(
    project: LaserxProject,
    assemblyOptions?: BuildPhysicalPreviewAssemblyOptions,
    options: PhysicalPreviewCoordinatorOptions = {},
  ): Promise<PhysicalPreviewCoordinatorResult> {
    if (options.signal?.aborted === true) throw new PhysicalPreviewCancelledError();

    const operationId = `physical-preview-${String(++this.#operationSequence)}`;
    const request = createPhysicalPreviewTaskRequest(operationId, project, assemblyOptions);

    const active = this.#active;
    if (active !== null && active.inputFingerprint === request.inputFingerprint) {
      // Identical physical content is already being built. Coalesce onto that
      // worker call instead of aborting and restarting identical work.
      return this.#attach(active, operationId, project, options);
    }

    // Every newer request owns the preview result, including a cache hit. An old
    // worker must not be allowed to complete after a newer cached scene is shown.
    this.#supersedeActive();

    const cached = this.#cache.get(request.inputFingerprint);
    if (cached !== null) {
      const assembly = rebindPhysicalPreviewAssemblyIdentity(cached, project);
      options.onProgress?.({
        operationId,
        inputFingerprint: request.inputFingerprint,
        stage: "complete",
        percent: 100,
        message: "Reused the unchanged physical preview scene.",
      });
      return {
        operationId,
        inputFingerprint: request.inputFingerprint,
        assembly,
        cacheHit: true,
      };
    }

    return this.#start(request, operationId, project, options);
  }

  public cancelActive(): void {
    const active = this.#active;
    if (active === null) return;
    active.cancellationReason = "manual";
    this.#active = null;
    active.controller.abort();
  }

  public clearCache(): void {
    this.#cache.clear();
  }

  #supersedeActive(): void {
    const active = this.#active;
    if (active === null) return;
    active.cancellationReason = "superseded";
    this.#active = null;
    active.controller.abort();
  }

  #start(
    request: PhysicalPreviewTaskRequest,
    operationId: string,
    project: LaserxProject,
    options: PhysicalPreviewCoordinatorOptions,
  ): Promise<PhysicalPreviewCoordinatorResult> {
    const active: ActiveRequest = {
      inputFingerprint: request.inputFingerprint,
      controller: new AbortController(),
      waiters: [],
      cancellationReason: null,
    };
    this.#active = active;

    const firstWaiterResult = this.#attach(active, operationId, project, options);
    void this.#run(active, request);
    return firstWaiterResult;
  }

  #attach(
    active: ActiveRequest,
    operationId: string,
    project: LaserxProject,
    options: PhysicalPreviewCoordinatorOptions,
  ): Promise<PhysicalPreviewCoordinatorResult> {
    return new Promise<PhysicalPreviewCoordinatorResult>((resolve, reject) => {
      const waiter: ActiveWaiter = {
        operationId,
        project,
        ...(options.onProgress === undefined ? {} : { onProgress: options.onProgress }),
        resolve,
        reject,
      };

      const detach = (): void => {
        options.signal?.removeEventListener("abort", onAbort);
      };
      const onAbort = (): void => {
        const index = active.waiters.indexOf(waiter);
        if (index === -1) return;
        active.waiters.splice(index, 1);
        detach();
        reject(new PhysicalPreviewCancelledError());
        // No one is left waiting on this content key: stop the now-unwanted
        // work instead of letting it finish for nobody.
        if (active.waiters.length === 0 && this.#active === active) {
          active.controller.abort();
        }
      };

      // Wrapping resolve/reject (rather than relying solely on the {once:true}
      // abort listener) guarantees the listener is removed on every settle
      // path, including the shared worker call settling first.
      waiter.resolve = (result) => {
        detach();
        resolve(result);
      };
      waiter.reject = (error) => {
        detach();
        reject(error);
      };

      active.waiters.push(waiter);
      options.signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  async #run(active: ActiveRequest, request: PhysicalPreviewTaskRequest): Promise<void> {
    let result: PhysicalPreviewTaskResult | null = null;
    let failure: unknown;
    let hasFailure = false;
    try {
      result = await this.#worker.run(request, active.controller.signal, (progress) => {
        if (this.#active !== active || active.controller.signal.aborted) return;
        for (const waiter of active.waiters) {
          waiter.onProgress?.(progress);
        }
      });
    } catch (error) {
      failure = error;
      hasFailure = true;
    }

    if (this.#active === active) this.#active = null;

    const waiters = active.waiters.splice(0, active.waiters.length);
    if (waiters.length === 0) return;

    if (active.cancellationReason === "manual") {
      this.#rejectAll(waiters, new PhysicalPreviewCancelledError());
      return;
    }
    if (active.cancellationReason === "superseded") {
      this.#rejectAll(waiters, new PhysicalPreviewSupersededError());
      return;
    }
    if (active.controller.signal.aborted) {
      this.#rejectAll(waiters, new PhysicalPreviewCancelledError());
      return;
    }

    if (hasFailure) {
      this.#rejectAll(waiters, failure instanceof Error ? failure : new Error(String(failure)));
      return;
    }

    const finalResult = result;
    if (finalResult === null) return;

    this.#cache.set(finalResult);
    for (const waiter of waiters) {
      const rebound = rebindPhysicalPreviewAssemblyIdentity(finalResult.assembly, waiter.project);
      waiter.resolve({
        operationId: waiter.operationId,
        inputFingerprint: finalResult.inputFingerprint,
        assembly: structuredClone(rebound),
        cacheHit: false,
      });
    }
  }

  #rejectAll(waiters: readonly ActiveWaiter[], error: Error): void {
    for (const waiter of waiters) waiter.reject(error);
  }
}
