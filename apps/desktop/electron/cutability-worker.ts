import { parentPort } from "node:worker_threads";

import {
  runCutabilityTask,
  type CutabilityAnalysisSummary,
  type CutabilityTaskProgress,
  type CutabilityTaskRequest,
} from "@laserx/cutability";

export type CutabilityWorkerResponse =
  | { ok: true; result: CutabilityAnalysisSummary }
  | { ok: false; operationId: string; error: string }
  | { ok: null; progress: CutabilityTaskProgress };

if (parentPort === null) {
  throw new Error("Cutability worker requires a worker-thread parent port.");
}

parentPort.once("message", (request: CutabilityTaskRequest) => {
  const delayMs = Math.max(
    0,
    Number(process.env.LASERX_TEST_CUTABILITY_DELAY_MS ?? 0),
  );
  setTimeout(() => {
    try {
      const result = runCutabilityTask(request, (progress) => {
        parentPort?.postMessage({ ok: null, progress } satisfies CutabilityWorkerResponse);
      });
      parentPort?.postMessage({ ok: true, result } satisfies CutabilityWorkerResponse);
    } catch (error) {
      parentPort?.postMessage({
        ok: false,
        operationId: request.operationId,
        error: error instanceof Error ? error.message : String(error),
      } satisfies CutabilityWorkerResponse);
    }
  }, delayMs);
});
