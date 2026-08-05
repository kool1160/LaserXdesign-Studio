/**
 * Single source of truth for privileged capture size limits (M14 G5).
 *
 * The IPC schema, the pre-dialog check in the controller, and the privileged
 * writer all derive from these constants. Defining the ceiling in only one
 * place is the point: three independently written limits would drift, and a
 * payload permitted by the schema but rejected by the writer would prompt
 * the user for a destination before failing.
 *
 * Deliberately free of Node imports so the schema module can share it
 * without pulling filesystem APIs into the preload bundle.
 */

/** 64 MiB: far above any realistic preview capture, far below memory risk. */
export const MAX_CAPTURE_BYTES = 64 * 1024 * 1024;

/**
 * Exact base64 length of `MAX_CAPTURE_BYTES`: base64 encodes each 3-byte
 * group as 4 characters, padding the final group. Derived rather than
 * hand-tuned so the transport ceiling cannot drift from the byte ceiling.
 */
export const MAX_CAPTURE_BASE64_LENGTH = Math.ceil(MAX_CAPTURE_BYTES / 3) * 4;

/**
 * Decoded-pixel ceiling, enforced **before** any native decode.
 *
 * `MAX_CAPTURE_BYTES` bounds the *compressed* payload only. A small, validly
 * framed PNG can advertise enormous IHDR dimensions, so without a separate
 * pixel budget a few kilobytes could ask the decoder for a multi-gigabyte
 * allocation in the privileged main process — a classic decompression bomb.
 *
 * 64 Mi pixels is sized to LaserX's supported preview surface, not to the PNG
 * format maximum: the preview canvas is bounded by the display and its DPR is
 * clamped to [1, 2], so even a full-screen 8K capture is ~33 MP. This leaves
 * roughly 2x headroom while capping the worst-case RGBA allocation at 256 MiB,
 * versus the ~17 GB that the format's 65535x65535 maximum would permit.
 */
export const MAX_CAPTURE_PIXELS = 64 * 1024 * 1024;

/** Worst-case decoded RGBA allocation implied by `MAX_CAPTURE_PIXELS`. */
export const MAX_CAPTURE_RGBA_BYTES = MAX_CAPTURE_PIXELS * 4;

/**
 * Whether a claimed capture size is within the decoded-pixel budget.
 *
 * Rejects non-finite and non-integer values defensively rather than assuming
 * the caller already validated them: main must not trust preload.
 */
export function isWithinCapturePixelBudget(widthPx: number, heightPx: number): boolean {
  if (
    !Number.isInteger(widthPx) ||
    !Number.isInteger(heightPx) ||
    widthPx <= 0 ||
    heightPx <= 0
  ) {
    return false;
  }
  const pixels = widthPx * heightPx;
  return Number.isFinite(pixels) && pixels <= MAX_CAPTURE_PIXELS;
}
