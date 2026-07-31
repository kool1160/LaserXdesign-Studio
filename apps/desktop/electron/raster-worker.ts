import { parentPort } from "node:worker_threads";

import {
  runRasterTraceTask,
  type RasterTraceProgress,
  type RasterTraceTaskRequest,
  type RasterTraceTaskResult,
} from "@laserx/import-raster";

export type RasterWorkerResponse =
  | { type: "progress"; progress: RasterTraceProgress }
  | { type: "result"; result: RasterTraceTaskResult }
  | { type: "error"; operationId: string; error: string };

if (parentPort === null) {
  throw new Error("Raster worker requires a worker-thread parent port.");
}

parentPort.once("message", (request: RasterTraceTaskRequest) => {
  const delayMs = Math.max(0, Number(process.env.LASERX_TEST_RASTER_DELAY_MS ?? 0));
  setTimeout(() => {
    try {
      const result = runRasterTraceTask(request, (progress) => {
        parentPort?.postMessage({ type: "progress", progress } satisfies RasterWorkerResponse);
      });
      const transfer = [
        result.preview.originalRgba.buffer,
        result.preview.blackWhiteRgba.buffer,
        result.preview.edgeRgba.buffer,
      ].filter((buffer): buffer is ArrayBuffer => buffer instanceof ArrayBuffer);
      parentPort?.postMessage(
        { type: "result", result } satisfies RasterWorkerResponse,
        transfer,
      );
    } catch (error) {
      parentPort?.postMessage({
        type: "error",
        operationId: request.operationId,
        error: error instanceof Error ? error.message : String(error),
      } satisfies RasterWorkerResponse);
    }
  }, delayMs);
});
