import type { LaserxProject } from "@laserx/domain";

import { PhysicalPreviewAssemblyCache } from "../../../packages/physical-preview-3d/src/cache.js";
import type {
  BuildPhysicalPreviewAssemblyOptions,
  PhysicalPreviewAssembly,
} from "../../../packages/physical-preview-3d/src/index.js";
import {
  createPhysicalPreviewTaskRequest,
  type PhysicalPreviewTaskProgress,
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

interface ActiveRequest {
  generation: number;
  operationId: string;
  controller: AbortController;
  cancellationReason: CancellationReason;
}

/**
 * Coordinates immutable preview snapshots across the dedicated worker.
 *
 * Only physical project content and assembly spacing enter the task fingerprint.
 * Camera/view/mode/visibility are renderer presentation state and never call
 * this coordinator, so those interactions reuse the accepted assembly and do
 * not recompute topology.
 */
export class PhysicalPreviewCoordinator {
  readonly #worker: PhysicalPreviewWorkerPort;
  readonly #cache: PhysicalPreviewAssemblyCache;
  #operationSequence = 0;
  #generation = 0;
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
    const cached = this.#cache.get(request.inputFingerprint);
    if (cached !== null) {
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
        assembly: cached,
        cacheHit: true,
      };
    }

    // A newer immutable snapshot owns the worker. Terminating the earlier worker
    // is the only honest cancellation boundary while topology analysis remains
    // synchronous inside the pure package.
    const previous = this.#active;
    if (previous !== null) {
      previous.cancellationReason = "superseded";
      previous.controller.abort();
    }

    const generation = ++this.#generation;
    const controller = new AbortController();
    const active: ActiveRequest = {
      generation,
      operationId,
      controller,
      cancellationReason: null,
    };
    this.#active = active;

    const externalAbort = (): void => controller.abort();
    options.signal?.addEventListener("abort", externalAbort, { once: true });

    try {
      const result = await this.#worker.run(request, controller.signal, (progress) => {
        if (this.#active === active && !controller.signal.aborted) {
          options.onProgress?.(progress);
        }
      });

      if (active.cancellationReason === "manual") {
        throw new PhysicalPreviewCancelledError();
      }
      if (
        active.cancellationReason === "superseded" ||
        this.#active !== active ||
        generation !== this.#generation
      ) {
        throw new PhysicalPreviewSupersededError();
      }

      this.#cache.set(result);
      return {
        operationId,
        inputFingerprint: result.inputFingerprint,
        assembly: structuredClone(result.assembly),
        cacheHit: false,
      };
    } catch (error) {
      if (active.cancellationReason === "manual") {
        throw new PhysicalPreviewCancelledError();
      }
      if (
        active.cancellationReason === "superseded" ||
        generation !== this.#generation ||
        this.#active !== active
      ) {
        throw new PhysicalPreviewSupersededError();
      }
      throw error;
    } finally {
      options.signal?.removeEventListener("abort", externalAbort);
      if (this.#active === active) this.#active = null;
    }
  }

  public cancelActive(): void {
    const active = this.#active;
    if (active === null) return;
    active.cancellationReason = "manual";
    this.#generation += 1;
    active.controller.abort();
    this.#active = null;
  }

  public clearCache(): void {
    this.#cache.clear();
  }
}
