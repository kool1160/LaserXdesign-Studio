import { parentPort } from "node:worker_threads";

import {
  runPhysicalPreviewTask,
  type PhysicalPreviewTaskProgress,
  type PhysicalPreviewTaskRequest,
  type PhysicalPreviewTaskResult,
} from "../../../packages/physical-preview-3d/src/task.js";

export type PhysicalPreviewWorkerResponse =
  | { ok: true; result: PhysicalPreviewTaskResult }
  | {
      ok: false;
      operationId: string;
      inputFingerprint: string;
      error: string;
    }
  | { ok: null; progress: PhysicalPreviewTaskProgress };

if (parentPort === null) {
  throw new Error("Physical preview worker requires a worker-thread parent port.");
}

parentPort.once("message", (request: PhysicalPreviewTaskRequest) => {
  const delayMs = Math.max(
    0,
    Number(process.env.LASERX_TEST_PHYSICAL_PREVIEW_DELAY_MS ?? 0),
  );

  setTimeout(() => {
    try {
      const result = runPhysicalPreviewTask(request, (progress) => {
        parentPort?.postMessage({ ok: null, progress } satisfies PhysicalPreviewWorkerResponse);
      });
      parentPort?.postMessage({ ok: true, result } satisfies PhysicalPreviewWorkerResponse);
    } catch (error) {
      parentPort?.postMessage({
        ok: false,
        operationId: request.operationId,
        inputFingerprint: request.inputFingerprint,
        error: error instanceof Error ? error.message : String(error),
      } satisfies PhysicalPreviewWorkerResponse);
    }
  }, delayMs);
});
