import { useEffect, useState } from "react";

export interface WebglContextLossState {
  lost: boolean;
  failedToRestore: boolean;
}

/** How long to wait after a context loss before treating it as failed
 * restoration rather than an in-progress recovery. */
export const DEFAULT_RESTORE_TIMEOUT_MS = 8_000;

/**
 * Tracks WebGL context loss and restoration for a canvas-like event target.
 *
 * Accepts any `EventTarget`, not specifically an `HTMLCanvasElement` --
 * jsdom has no WebGL implementation, so this stays unit-testable with a
 * plain fake event target instead of needing a real WebGL context.
 *
 * `webglcontextlost` fires when the browser reclaims the context; calling
 * `preventDefault()` on it is what signals the browser to attempt automatic
 * restoration, which then fires `webglcontextrestored`. If restoration does
 * not happen within `restoreTimeoutMs`, `failedToRestore` becomes true so
 * the UI can stop implying recovery is imminent.
 */
export function useWebglContextLossState(
  target: EventTarget | null,
  restoreTimeoutMs: number = DEFAULT_RESTORE_TIMEOUT_MS,
): WebglContextLossState {
  const [lost, setLost] = useState(false);
  const [failedToRestore, setFailedToRestore] = useState(false);

  useEffect(() => {
    setLost(false);
    setFailedToRestore(false);
    if (target === null) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const clearRestoreTimeout = (): void => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const handleLost = (event: Event): void => {
      event.preventDefault();
      setLost(true);
      setFailedToRestore(false);
      clearRestoreTimeout();
      timeoutId = setTimeout(() => {
        setFailedToRestore(true);
      }, restoreTimeoutMs);
    };
    const handleRestored = (): void => {
      clearRestoreTimeout();
      setLost(false);
      setFailedToRestore(false);
    };

    target.addEventListener("webglcontextlost", handleLost);
    target.addEventListener("webglcontextrestored", handleRestored);
    return () => {
      target.removeEventListener("webglcontextlost", handleLost);
      target.removeEventListener("webglcontextrestored", handleRestored);
      clearRestoreTimeout();
    };
  }, [target, restoreTimeoutMs]);

  return { lost, failedToRestore };
}
