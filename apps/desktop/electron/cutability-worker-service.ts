import { resolve } from "node:path";
import { Worker } from "node:worker_threads";

import type {
  CutabilityAnalysisSummary,
  CutabilityTaskProgress,
  CutabilityTaskRequest,
} from "@laserx/cutability";

import type { CutabilityWorkerResponse } from "./cutability-worker.js";

export class CutabilityAnalysisCancelledError extends Error {
  public constructor() {
    super("Manufacturing analysis canceled; the document was left unchanged.");
    this.name = "CutabilityAnalysisCancelledError";
  }
}

export interface CutabilityWorkerPort {
  run(
    request: CutabilityTaskRequest,
    signal: AbortSignal,
    onProgress?: (progress: CutabilityTaskProgress) => void,
  ): Promise<CutabilityAnalysisSummary>;
}

export class NodeCutabilityWorkerService implements CutabilityWorkerPort {
  readonly #workerPath: string;

  public constructor(workerPath = resolve(__dirname, "cutability-worker.cjs")) {
    this.#workerPath = workerPath;
  }

  public run(
    request: CutabilityTaskRequest,
    signal: AbortSignal,
    onProgress?: (progress: CutabilityTaskProgress) => void,
  ): Promise<CutabilityAnalysisSummary> {
    return new Promise((resolveResult, reject) => {
      if (signal.aborted) {
        reject(new CutabilityAnalysisCancelledError());
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
          reject(new CutabilityAnalysisCancelledError());
        }
      };
      signal.addEventListener("abort", abort, { once: true });
      worker.on("message", (response: CutabilityWorkerResponse) => {
        if (response.ok === null) {
          if (!settled && response.progress.operationId === request.operationId) {
            onProgress?.(response.progress);
          }
          return;
        }
        if (!finish()) return;
        void worker.terminate();
        if (response.ok) resolveResult(response.result);
        else reject(new Error(response.error));
      });
      worker.once("error", (error) => {
        if (finish()) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });
      worker.once("exit", (code) => {
        if (code !== 0 && finish()) {
          reject(new Error(`Cutability worker exited with code ${String(code)}.`));
        }
      });
      worker.postMessage(request);
    });
  }
}
