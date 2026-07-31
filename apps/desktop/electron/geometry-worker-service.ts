import { resolve } from "node:path";
import { Worker } from "node:worker_threads";

import type {
  GeometryEngineTaskRequest,
  GeometryEngineTaskResult,
} from "@laserx/geometry";

import type { GeometryWorkerResponse } from "./geometry-worker.js";

export class GeometryOperationCancelledError extends Error {
  public constructor() {
    super("Geometry operation canceled; the original document was left unchanged.");
    this.name = "GeometryOperationCancelledError";
  }
}

export interface GeometryWorkerPort {
  run(
    request: GeometryEngineTaskRequest,
    signal: AbortSignal,
  ): Promise<GeometryEngineTaskResult>;
}

export class NodeGeometryWorkerService implements GeometryWorkerPort {
  readonly #workerPath: string;

  public constructor(
    workerPath = resolve(__dirname, "geometry-worker.cjs"),
  ) {
    this.#workerPath = workerPath;
  }

  public run(
    request: GeometryEngineTaskRequest,
    signal: AbortSignal,
  ): Promise<GeometryEngineTaskResult> {
    return new Promise((resolveResult, reject) => {
      if (signal.aborted) {
        reject(new GeometryOperationCancelledError());
        return;
      }
      const worker = new Worker(this.#workerPath);
      let settled = false;
      const finish = (): boolean => {
        if (settled) {
          return false;
        }
        settled = true;
        signal.removeEventListener("abort", abort);
        return true;
      };
      const abort = (): void => {
        if (finish()) {
          void worker.terminate();
          reject(new GeometryOperationCancelledError());
        }
      };
      signal.addEventListener("abort", abort, { once: true });
      worker.once("message", (response: GeometryWorkerResponse) => {
        if (!finish()) {
          return;
        }
        void worker.terminate();
        if (response.ok) {
          resolveResult(response.result);
        } else {
          reject(new Error(response.error));
        }
      });
      worker.once("error", (error) => {
        if (finish()) {
          reject(
            new Error(
              error instanceof Error
                ? error.message
                : "The geometry worker failed.",
            ),
          );
        }
      });
      worker.once("exit", (code) => {
        if (code !== 0 && finish()) {
          reject(new Error(`Geometry worker exited with code ${String(code)}.`));
        }
      });
      worker.postMessage(request);
    });
  }
}
