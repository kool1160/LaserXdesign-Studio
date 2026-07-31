import { resolve } from "node:path";
import { Worker } from "node:worker_threads";

import {
  MAX_RASTER_PROCESSING_TIME_MS,
  type RasterTraceProgress,
  type RasterTraceTaskRequest,
  type RasterTraceTaskResult,
} from "@laserx/import-raster";

import type { RasterWorkerResponse } from "./raster-worker.js";

export class RasterTraceCancelledError extends Error {
  public constructor() {
    super("Raster trace canceled; the project and history were left unchanged.");
    this.name = "RasterTraceCancelledError";
  }
}

export class RasterTraceTimeoutError extends Error {
  public constructor(timeoutMs: number) {
    super(`Raster trace exceeded the ${String(timeoutMs)} ms processing-time safeguard.`);
    this.name = "RasterTraceTimeoutError";
  }
}

export interface RasterWorkerPort {
  run(
    request: RasterTraceTaskRequest,
    signal: AbortSignal,
    onProgress: (progress: RasterTraceProgress) => void,
  ): Promise<RasterTraceTaskResult>;
}

export class NodeRasterWorkerService implements RasterWorkerPort {
  readonly #workerPath: string;
  readonly #timeoutMs: number;

  public constructor(
    workerPath = resolve(__dirname, "raster-worker.cjs"),
    timeoutMs = MAX_RASTER_PROCESSING_TIME_MS,
  ) {
    this.#workerPath = workerPath;
    this.#timeoutMs = timeoutMs;
  }

  public run(
    request: RasterTraceTaskRequest,
    signal: AbortSignal,
    onProgress: (progress: RasterTraceProgress) => void,
  ): Promise<RasterTraceTaskResult> {
    return new Promise((resolveResult, reject) => {
      if (signal.aborted) {
        reject(new RasterTraceCancelledError());
        return;
      }
      const worker = new Worker(this.#workerPath);
      let settled = false;
      const finish = (): boolean => {
        if (settled) return false;
        settled = true;
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        return true;
      };
      const abort = (): void => {
        if (finish()) {
          void worker.terminate();
          reject(new RasterTraceCancelledError());
        }
      };
      const timer = setTimeout(() => {
        if (finish()) {
          void worker.terminate();
          reject(new RasterTraceTimeoutError(this.#timeoutMs));
        }
      }, this.#timeoutMs);
      timer.unref();
      signal.addEventListener("abort", abort, { once: true });
      worker.on("message", (response: RasterWorkerResponse) => {
        if (settled) return;
        if (response.type === "progress") {
          if (response.progress.operationId === request.operationId) {
            onProgress(response.progress);
          }
          return;
        }
        if (!finish()) return;
        void worker.terminate();
        if (response.type === "result") {
          if (response.result.operationId !== request.operationId) {
            reject(new Error("Raster worker returned a mismatched operation ID."));
          } else {
            resolveResult(response.result);
          }
        } else {
          reject(new Error(response.error));
        }
      });
      worker.once("error", (error) => {
        if (finish()) {
          reject(
            new Error(
              error instanceof Error ? error.message : "The raster worker failed.",
            ),
          );
        }
      });
      worker.once("exit", (code) => {
        if (code !== 0 && finish()) {
          reject(new Error(`Raster worker exited with code ${String(code)}.`));
        }
      });
      const transfer = request.image.rgba.buffer instanceof ArrayBuffer
        ? [request.image.rgba.buffer]
        : [];
      worker.postMessage(request, transfer);
    });
  }
}
