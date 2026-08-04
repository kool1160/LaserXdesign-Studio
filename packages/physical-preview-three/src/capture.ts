import type { PreviewView } from "./camera.js";
import type { AssemblyMode } from "./placement.js";

/**
 * Pure PNG capture **validation** and deterministic naming.
 *
 * This package performs no filesystem write and no download. ADR 0024 §6
 * rejects the research lab's anchor/object-URL download outright: in production
 * the bytes cross a typed Electron preload/main boundary, which is G5's work.
 * What is promoted here is the half that is genuinely pure and testable — proof
 * that captured bytes really are a non-empty PNG of the expected size.
 */

/**
 * Only the canvas surface actually read from, so validation is unit-testable in
 * Node against a plain object without a real `HTMLCanvasElement` or DOM.
 */
export interface CapturableCanvas {
  width: number;
  height: number;
  toDataURL: (type?: string) => string;
}

/** Background the preview clears to, as RGB 0-255. */
export interface BackgroundColor {
  r: number;
  g: number;
  b: number;
}

export interface PixelContentEvidence {
  sampledPixels: number;
  nonBackgroundPixels: number;
  nonBackgroundRatio: number;
}

/**
 * Default per-channel tolerance when comparing against the background.
 *
 * Antialiasing and colour-space conversion move background pixels by a few
 * units, so an exact match would count them as content and defeat the check.
 */
export const DEFAULT_BACKGROUND_TOLERANCE = 8;

/**
 * Proves at least one meaningful non-background pixel exists.
 *
 * Pure and renderer-independent: it takes raw RGBA bytes, so G4 can supply them
 * from the real renderer (`readRenderTargetPixels` or a 2D readback) without
 * this package touching a canvas, a DOM, or a GPU.
 *
 * Fully transparent pixels count as background: a transparent buffer is exactly
 * the blank readback this exists to catch.
 */
export function analyzePixelContent(
  rgba: Uint8Array | Uint8ClampedArray,
  widthPx: number,
  heightPx: number,
  background: BackgroundColor,
  tolerance: number = DEFAULT_BACKGROUND_TOLERANCE,
): PixelContentEvidence {
  const expected = widthPx * heightPx * 4;
  if (widthPx <= 0 || heightPx <= 0 || rgba.length < expected) {
    throw new RangeError(
      `Pixel content evidence needs ${String(expected)} RGBA bytes for ${String(widthPx)}x${String(heightPx)}, received ${String(rgba.length)}.`,
    );
  }

  let nonBackgroundPixels = 0;
  for (let index = 0; index < expected; index += 4) {
    const alpha = rgba[index + 3] ?? 0;
    if (alpha === 0) continue;
    const r = rgba[index] ?? 0;
    const g = rgba[index + 1] ?? 0;
    const b = rgba[index + 2] ?? 0;
    if (
      Math.abs(r - background.r) > tolerance ||
      Math.abs(g - background.g) > tolerance ||
      Math.abs(b - background.b) > tolerance
    ) {
      nonBackgroundPixels += 1;
    }
  }

  const sampledPixels = widthPx * heightPx;
  return {
    sampledPixels,
    nonBackgroundPixels,
    nonBackgroundRatio: nonBackgroundPixels / sampledPixels,
  };
}

export interface CaptureFailure {
  ok: false;
  status: "rejected";
  filename: string;
  errorMessage: string;
}

/**
 * The bytes are a structurally valid PNG, but **no pixel-content evidence was
 * supplied**, so this is not a verified capture.
 *
 * `ok` is deliberately `false`. Encoded-header validation cannot detect a blank
 * drawing buffer — a fully cleared frame encodes to a perfectly valid PNG — so
 * treating this as success is exactly the mistake this state exists to prevent.
 */
export interface CaptureStructureOnly {
  ok: false;
  status: "structure-only";
  filename: string;
  dataUrl: string;
  byteLength: number;
  widthPx: number;
  heightPx: number;
  errorMessage: string;
}

export interface CaptureVerified {
  ok: true;
  status: "verified";
  filename: string;
  dataUrl: string;
  byteLength: number;
  widthPx: number;
  heightPx: number;
  content: PixelContentEvidence;
}

export type CaptureResult = CaptureFailure | CaptureStructureOnly | CaptureVerified;

/** `\x89PNG\r\n\x1a\n` — the mandatory 8-byte PNG signature. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
/** Signature (8) + length (4) + "IHDR" (4) + width (4) + height (4). */
const IHDR_MINIMUM_BYTES = 24;
const MINIMUM_PNG_BYTES = 64;

function decodeBase64(base64: string): Uint8Array | null {
  try {
    // `atob` in the renderer, `Buffer` in Node tests — both are pure decoders.
    if (typeof atob === "function") {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      return bytes;
    }
    return new Uint8Array(Buffer.from(base64, "base64"));
  } catch {
    return null;
  }
}

function readUint32BigEndian(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) << 24) |
    ((bytes[offset + 1] ?? 0) << 16) |
    ((bytes[offset + 2] ?? 0) << 8) |
    (bytes[offset + 3] ?? 0)
  ) >>> 0;
}

export interface PngHeader {
  widthPx: number;
  heightPx: number;
}

/**
 * Validates the PNG signature and IHDR header of decoded bytes.
 *
 * Returns `null` for anything that is not a structurally valid PNG with
 * non-zero dimensions, so a blank or truncated readback cannot be reported as a
 * successful capture.
 */
export function readPngHeader(bytes: Uint8Array): PngHeader | null {
  if (bytes.length < IHDR_MINIMUM_BYTES) return null;
  for (let index = 0; index < PNG_SIGNATURE.length; index += 1) {
    if (bytes[index] !== PNG_SIGNATURE[index]) return null;
  }
  if (
    bytes[12] !== 0x49 ||
    bytes[13] !== 0x48 ||
    bytes[14] !== 0x44 ||
    bytes[15] !== 0x52
  ) {
    return null;
  }
  const widthPx = readUint32BigEndian(bytes, 16);
  const heightPx = readUint32BigEndian(bytes, 20);
  if (widthPx === 0 || heightPx === 0) return null;
  return { widthPx, heightPx };
}

export interface CaptureContentInput {
  /** RGBA bytes for the captured frame, row-major, 4 bytes per pixel. */
  rgba: Uint8Array | Uint8ClampedArray;
  widthPx: number;
  heightPx: number;
  background: BackgroundColor;
  tolerance?: number;
  /**
   * Minimum fraction of non-background pixels required. Defaults to "at least
   * one pixel", which is the weakest honest claim; a caller that knows the
   * expected coverage can demand more.
   */
  minimumNonBackgroundRatio?: number;
}

/**
 * Validates captured PNG bytes.
 *
 * Structure — signature, `IHDR`, non-zero dimensions, plausible size — is
 * checked from the encoded bytes. **Pixel content cannot be checked from the
 * header**: a WebGL canvas that cleared its drawing buffer encodes to a
 * perfectly valid PNG of the right dimensions. Content therefore requires
 * `content` evidence from the caller; without it the result is
 * `status: "structure-only"` with `ok: false`.
 */
export function validatePngCapture(
  canvas: CapturableCanvas,
  filename: string,
  content?: CaptureContentInput,
): CaptureResult {
  if (canvas.width === 0 || canvas.height === 0) {
    return {
      ok: false,
      status: "rejected",
      filename,
      errorMessage: "The preview canvas has no rendered pixels to capture.",
    };
  }

  const rejected = (errorMessage: string): CaptureFailure => ({
    ok: false,
    status: "rejected",
    filename,
    errorMessage,
  });

  let dataUrl: string;
  try {
    dataUrl = canvas.toDataURL("image/png");
  } catch (error) {
    return rejected(error instanceof Error ? error.message : "PNG capture failed.");
  }

  const base64 = dataUrl.split(",")[1];
  if (dataUrl === "data:," || base64 === undefined || base64.length === 0) {
    return rejected("PNG capture produced no image data.");
  }

  const bytes = decodeBase64(base64);
  if (bytes === null) return rejected("PNG capture produced undecodable data.");
  if (bytes.length < MINIMUM_PNG_BYTES) {
    return rejected("PNG capture produced an unexpectedly small image.");
  }

  const header = readPngHeader(bytes);
  if (header === null) return rejected("PNG capture did not produce a valid PNG image.");

  const structure = {
    filename,
    dataUrl,
    byteLength: bytes.length,
    widthPx: header.widthPx,
    heightPx: header.heightPx,
  };

  if (content === undefined) {
    return {
      ok: false,
      status: "structure-only",
      ...structure,
      errorMessage:
        "PNG structure is valid, but no pixel-content evidence was supplied, so a blank frame cannot be ruled out.",
    };
  }

  let evidence: PixelContentEvidence;
  try {
    evidence = analyzePixelContent(
      content.rgba,
      content.widthPx,
      content.heightPx,
      content.background,
      content.tolerance,
    );
  } catch (error) {
    return rejected(
      error instanceof Error ? error.message : "Pixel content evidence was unusable.",
    );
  }

  const minimumRatio = content.minimumNonBackgroundRatio ?? 0;
  const hasContent =
    evidence.nonBackgroundPixels > 0 && evidence.nonBackgroundRatio >= minimumRatio;
  if (!hasContent) {
    return rejected(
      evidence.nonBackgroundPixels === 0
        ? "PNG capture contains only background pixels, so nothing was rendered."
        : `PNG capture contains only ${evidence.nonBackgroundRatio.toFixed(6)} non-background pixels, below the required ${minimumRatio.toFixed(6)}.`,
    );
  }

  return { ok: true, status: "verified", ...structure, content: evidence };
}

export interface CaptureFilenameInput {
  projectName: string;
  view: PreviewView;
  mode: AssemblyMode;
}

/** Same slugging approach as `@laserx/production-export`'s `safeFilePart`. */
function slug(value: string): string {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .toLowerCase()
    .slice(0, 60);
  return cleaned.length === 0 ? "project" : cleaned;
}

/**
 * Deterministic PNG filename: the same project/view/mode always produces the
 * same name, so repeat captures overwrite rather than accumulating ambiguous
 * copies.
 */
export function buildCaptureFilename({
  projectName,
  view,
  mode,
}: CaptureFilenameInput): string {
  return `laserx-preview-${slug(projectName)}-${view}-${mode}.png`;
}
