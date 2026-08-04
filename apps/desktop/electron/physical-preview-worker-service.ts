import { resolve } from "node:path";
import { Worker } from "node:worker_threads";

import type {
  PhysicalPreviewTaskProgress,
  PhysicalPreviewTaskRequest,
  PhysicalPreviewTaskResult,
} from "../../../packages/physical-preview-3d/src/task.js";

import type { PhysicalPreviewWorkerResponse } from "./physical-preview-worker.js";

export class PhysicalPreviewCancelledError extends Error {
  public constructor() {
    super("Physical preview generation canceled; the document was left unchanged.");
    this.name = "PhysicalPreviewCancelledError";
  }
}

export interface PhysicalPreviewWorkerPort {
  run(
    request: PhysicalPreviewTaskRequest,
    signal: AbortSignal,
    onProgress?: (progress: PhysicalPreviewTaskProgress) => void,
  ): Promise<PhysicalPreviewTaskResult>;
}

export class NodePhysicalPreviewWorkerService implements PhysicalPreviewWorkerPort {
  readonly #workerPath: string;

  public constructor(workerPath = resolve(__dirname, "physical-preview-worker.cjs")) {
    this.#workerPath = workerPath;
  }

  public run(
    request: PhysicalPreviewTaskRequest,
    signal: AbortSignal,
    onProgress?: (progress: PhysicalPreviewTaskProgress) => void,
  ): Promise<PhysicalPreviewTaskResult> {
    return new Promise((resolveResult, reject) => {
      if (signal.aborted) {
        reject(new PhysicalPreviewCancelledError());
        return;
      }

      const worker = new Worker(this.#workerPath);
      let settled = false;
      const finish = (): boolean => {
        if (settled) return false;
        settled = true;
        signal.removeEventListener("abort", abort);
        return true;
      };
      const abort = (): void => {
        if (finish()) {
          void worker.terminate();
          reject(new PhysicalPreviewCancelledError());
        }
      };

      signal.addEventListener("abort", abort, { once: true });
      worker.on("message", (response: PhysicalPreviewWorkerResponse) => {
        if (response.ok === null) {
          if (
            !settled &&
            response.progress.operationId === request.operationId &&
            response.progress.inputFingerprint === request.inputFingerprint
          ) {
            onProgress?.(response.progress);
          }
          return;
        }

        if (!finish()) return;
        void worker.terminate();
        if (response.ok) {
          if (
            response.result.operationId !== request.operationId ||
            response.result.inputFingerprint !== request.inputFingerprint
          ) {
            reject(new Error("Physical preview worker returned a result for another request."));
            return;
          }
          resolveResult(response.result);
          return;
        }

        if (
          response.operationId !== request.operationId ||
          response.inputFingerprint !== request.inputFingerprint
        ) {
          reject(new Error("Physical preview worker returned a failure for another request."));
          return;
        }
        reject(new Error(response.error));
      });
      worker.once("error", (error) => {
        if (finish()) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });
      worker.once("exit", (code) => {
        if (code !== 0 && finish()) {
          reject(new Error(`Physical preview worker exited with code ${String(code)}.`));
        }
      });
      worker.postMessage(request);
    });
  }
}
