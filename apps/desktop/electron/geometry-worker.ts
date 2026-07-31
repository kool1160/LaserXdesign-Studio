import { parentPort } from "node:worker_threads";

import {
  runGeometryEngineTask,
  type GeometryEngineTaskRequest,
  type GeometryEngineTaskResult,
} from "@laserx/geometry";

export type GeometryWorkerResponse =
  | { ok: true; result: GeometryEngineTaskResult }
  | { ok: false; operationId: string; error: string };

if (parentPort === null) {
  throw new Error("Geometry worker requires a worker-thread parent port.");
}

parentPort.once("message", (request: GeometryEngineTaskRequest) => {
  const delayMs = Math.max(
    0,
    Number(process.env.LASERX_TEST_GEOMETRY_DELAY_MS ?? 0),
  );
  setTimeout(() => {
    try {
      const result = runGeometryEngineTask(request);
      parentPort?.postMessage({ ok: true, result } satisfies GeometryWorkerResponse);
    } catch (error) {
      parentPort?.postMessage({
        ok: false,
        operationId: request.operationId,
        error: error instanceof Error ? error.message : String(error),
      } satisfies GeometryWorkerResponse);
    }
  }, delayMs);
});
