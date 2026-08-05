/**
 * Same-frame capture transaction (M14 G5).
 *
 * `@laserx/physical-preview-three`'s `validatePngCapture` can prove the
 * encoded PNG and the RGBA evidence *agree in size*, but it explicitly
 * cannot prove they came from the same read -- that provenance is G5's
 * responsibility. This module is that guarantee: one forced render,
 * then both the pixel readback and the PNG encode taken from that single
 * preserved drawing buffer, with no opportunity for another frame to be
 * drawn in between.
 *
 * The renderer surface is narrowed to the four operations actually used, so
 * the transaction ordering is unit-testable in Node against a fake without a
 * real WebGL context, a GPU, or a DOM.
 */

export interface SameFrameCaptureSource {
  /** Draws the current scene into the preserved drawing buffer. */
  renderFrame(): void;
  readonly widthPx: number;
  readonly heightPx: number;
  /** RGBA bytes of the drawing buffer, 4 per pixel. */
  readPixels(): Uint8Array;
  /** PNG data URL encoded from the same drawing buffer. */
  toDataURL(): string;
}

export interface SameFrameCapture {
  dataUrl: string;
  rgba: Uint8Array;
  widthPx: number;
  heightPx: number;
}

export class SameFrameCaptureError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "SameFrameCaptureError";
  }
}

/**
 * Performs the capture as a single ordered transaction:
 * render -> readPixels -> toDataURL.
 *
 * Both reads happen after exactly one render and before returning, which is
 * only sound because the preview canvas is created with
 * `preserveDrawingBuffer: true` (ADR 0024 section 6 records this as a
 * deliberate, documented cost). Without it the buffer may be cleared
 * immediately after compositing and the second read would return blank
 * pixels -- the precise failure `validatePngCapture`'s content check exists
 * to catch, but which is far better prevented here than merely detected.
 *
 * Dimensions are validated before either read so a zero-sized or
 * inconsistent buffer fails loudly rather than producing evidence that
 * silently describes the wrong thing.
 */
export function captureSameFrame(source: SameFrameCaptureSource): SameFrameCapture {
  const widthPx = source.widthPx;
  const heightPx = source.heightPx;
  if (
    !Number.isInteger(widthPx) ||
    !Number.isInteger(heightPx) ||
    widthPx <= 0 ||
    heightPx <= 0
  ) {
    throw new SameFrameCaptureError(
      "The preview canvas has no rendered pixels to capture.",
    );
  }

  source.renderFrame();

  const rgba = source.readPixels();
  const expectedBytes = widthPx * heightPx * 4;
  if (rgba.length !== expectedBytes) {
    throw new SameFrameCaptureError(
      `The capture read ${String(rgba.length)} bytes for a ${String(widthPx)}x${String(heightPx)} frame, expected ${String(expectedBytes)}.`,
    );
  }

  const dataUrl = source.toDataURL();
  if (!dataUrl.startsWith("data:image/png;base64,")) {
    throw new SameFrameCaptureError("The capture did not produce PNG image data.");
  }

  return { dataUrl, rgba, widthPx, heightPx };
}

/** Decodes a `data:image/png;base64,` URL to raw bytes for the privileged write. */
export function decodeCaptureDataUrl(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1];
  if (base64 === undefined || base64.length === 0) {
    throw new SameFrameCaptureError("The capture produced no image data.");
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
