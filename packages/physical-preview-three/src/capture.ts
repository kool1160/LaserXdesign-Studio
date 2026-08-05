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
 * The single source of truth for the preview background, shared by the scene
 * that clears to it, the renderer that validates a capture against it, and
 * the privileged main process that independently re-validates.
 *
 * Three copies of this value would be three chances to drift, and a drifted
 * background silently turns the blank-capture check into a no-op: every pixel
 * would compare as "content" against the wrong reference colour.
 */
export const PREVIEW_CAPTURE_BACKGROUND: BackgroundColor = { r: 0x2b, g: 0x2b, b: 0x2b };

/** The same colour as a CSS hex string, for the scene clear colour. */
export const PREVIEW_CAPTURE_BACKGROUND_HEX = "#2b2b2b";

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
function isFiniteChannel(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 255;
}

/**
 * Rejects trust inputs that are not usable, rather than letting `NaN` or an
 * out-of-range channel silently make every pixel compare as background (or as
 * content). These parameters gate whether a capture is reported as verified, so
 * they are validated exactly as strictly as the pixels themselves.
 */
function assertUsableContentParameters(
  background: BackgroundColor,
  tolerance: number,
  minimumNonBackgroundRatio: number,
): void {
  if (
    !isFiniteChannel(background.r) ||
    !isFiniteChannel(background.g) ||
    !isFiniteChannel(background.b)
  ) {
    throw new RangeError("Pixel content background channels must be finite numbers in 0-255.");
  }
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    throw new RangeError("Pixel content tolerance must be a finite, non-negative number.");
  }
  if (
    !Number.isFinite(minimumNonBackgroundRatio) ||
    minimumNonBackgroundRatio < 0 ||
    minimumNonBackgroundRatio > 1
  ) {
    throw new RangeError("Pixel content minimum ratio must be a finite number in 0-1.");
  }
}

export function analyzePixelContent(
  rgba: Uint8Array | Uint8ClampedArray,
  widthPx: number,
  heightPx: number,
  background: BackgroundColor,
  tolerance: number = DEFAULT_BACKGROUND_TOLERANCE,
): PixelContentEvidence {
  assertUsableContentParameters(background, tolerance, 0);
  const expected = widthPx * heightPx * 4;
  // Exact equality, not "at least": a longer buffer is evidence for pixels this
  // call was never told about, and accepting it would let unrelated bytes past
  // the shape this function's contract promises to check.
  if (widthPx <= 0 || heightPx <= 0 || rgba.length !== expected) {
    throw new RangeError(
      `Pixel content evidence needs exactly ${String(expected)} RGBA bytes for ${String(widthPx)}x${String(heightPx)}, received ${String(rgba.length)}.`,
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
    // The production package is renderer-bound, so its decoder must use the
    // browser-standard API rather than depending on Node's Buffer global.
    if (typeof atob !== "function") return null;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
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
 *
 * Binding, not just presence: `content`'s dimensions must exactly match both
 * the canvas's own `width`/`height` and the encoded `IHDR` dimensions. Without
 * that, RGBA bytes from an unrelated buffer of a different size could bless a
 * structurally valid but blank PNG — the evidence would prove *some* pixels
 * have content, not that *this* capture does.
 *
 * This package can enforce that shape/size consistency, but it cannot prove
 * the caller's provenance: G5 must obtain the encoded bytes and the RGBA
 * evidence from the **same capture transaction** (the same frame, read back
 * once), not from two different reads that merely happen to agree in size.
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

  // Bind the evidence to *this* capture before trusting it at all: the canvas's
  // own reported size, the encoded IHDR dimensions, and the supplied evidence
  // dimensions must all agree.
  if (
    content.widthPx !== canvas.width ||
    content.heightPx !== canvas.height ||
    content.widthPx !== header.widthPx ||
    content.heightPx !== header.heightPx
  ) {
    return rejected(
      `Pixel content evidence is ${String(content.widthPx)}x${String(content.heightPx)}, which does not match the captured ${String(header.widthPx)}x${String(header.heightPx)} PNG.`,
    );
  }

  const minimumRatio = content.minimumNonBackgroundRatio ?? 0;
  let evidence: PixelContentEvidence;
  try {
    // Validates background/tolerance internally; the ratio is this function's
    // own concern, so it is checked alongside them here.
    if (!Number.isFinite(minimumRatio) || minimumRatio < 0 || minimumRatio > 1) {
      throw new RangeError("Pixel content minimum ratio must be a finite number in 0-1.");
    }
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
  /** Drawing-buffer dimensions of the captured frame. */
  widthPx: number;
  heightPx: number;
  /** The captured PNG bytes, hashed into a stable content token. */
  pngBytes: Uint8Array;
}

/**
 * Stable, bounded content token for a captured image.
 *
 * Uses the same dependency-free FNV-1a technique as the rest of LaserX's
 * fingerprints rather than a crypto hash: this names files, it does not
 * authenticate them, and the pure package must not depend on `node:crypto`.
 *
 * Hashing the encoded bytes — rather than the view/mode inputs — is what
 * makes the name bind to what was actually rendered, including manual orbit,
 * pan, zoom, and per-layer visibility, none of which appear in any input the
 * caller could pass instead.
 */
export function captureContentToken(pngBytes: Uint8Array): string {
  let hash = 2_166_136_261 >>> 0;
  for (let index = 0; index < pngBytes.length; index += 1) {
    hash ^= pngBytes[index] ?? 0;
    hash = Math.imul(hash, 16_777_619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
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
  widthPx,
  heightPx,
  pngBytes,
}: CaptureFilenameInput): string {
  // Readable parts first so the file is still identifiable at a glance, then
  // the exact pixel dimensions and a content token. Identical bytes at
  // identical dimensions always produce the identical name (so a repeat
  // capture of the same thing overwrites rather than accumulating copies),
  // while any change in what was rendered produces a different one.
  const dimensions = `${String(widthPx)}x${String(heightPx)}`;
  const token = captureContentToken(pngBytes);
  return `laserx-preview-${slug(projectName)}-${view}-${mode}-${dimensions}-${token}.png`;
}

/**
 * Why `readPngHeader` is not sufficient on its own: it proves the signature,
 * the `IHDR` marker, and non-zero dimensions. A payload with a plausible
 * header but missing, truncated, or corrupt chunk framing — no `IDAT`, a bad
 * CRC, no terminal `IEND` — still passes it. A privileged writer must not
 * treat that as a real image, so this walks the entire chunk stream and
 * verifies it end to end.
 *
 * Pure and dependency-free (CRC-32 computed inline) so it stays inside this
 * renderer-safe package and can be shared verbatim by the privileged main
 * process — one definition of "valid PNG", not two that can drift.
 */
export type PngStructureFailure =
  | "bad-signature"
  | "truncated"
  | "bad-chunk-crc"
  | "missing-ihdr"
  | "bad-ihdr-length"
  | "duplicate-ihdr"
  | "missing-idat"
  | "non-consecutive-idat"
  | "missing-iend"
  | "bad-iend-length"
  | "trailing-bytes";

/**
 * `IHDR` carries exactly width, height, bit depth, colour type, compression,
 * filter, and interlace — 13 bytes, never more or fewer. Checking this is not
 * pedantry: `readPngHeader` reads dimensions from the first eight data bytes,
 * so a CRC-correct chunk merely *named* `IHDR` with a wrong length would
 * otherwise yield dimensions read out of unrelated bytes.
 */
const IHDR_DATA_BYTES = 13;

const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array, start: number, end: number): number {
  let crc = 0xffffffff;
  for (let index = start; index < end; index += 1) {
    crc = (CRC_TABLE[(crc ^ (bytes[index] ?? 0)) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunkType(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(
    bytes[offset] ?? 0,
    bytes[offset + 1] ?? 0,
    bytes[offset + 2] ?? 0,
    bytes[offset + 3] ?? 0,
  );
}

/**
 * Returns `null` when the bytes are a structurally complete PNG, or the first
 * structural defect found.
 */
export function validatePngStructure(bytes: Uint8Array): PngStructureFailure | null {
  if (bytes.length < IHDR_MINIMUM_BYTES) return "truncated";
  for (let index = 0; index < PNG_SIGNATURE.length; index += 1) {
    if (bytes[index] !== PNG_SIGNATURE[index]) return "bad-signature";
  }

  let offset = PNG_SIGNATURE.length;
  let ihdrCount = 0;
  let idatCount = 0;
  let sawNonIdatAfterIdat = false;
  let sawIend = false;
  let isFirstChunk = true;

  while (offset < bytes.length) {
    // length(4) + type(4) + data(length) + crc(4)
    if (offset + 8 > bytes.length) return "truncated";
    const length = readUint32BigEndian(bytes, offset);
    const type = chunkType(bytes, offset + 4);
    const dataStart = offset + 8;
    const crcStart = dataStart + length;
    if (crcStart + 4 > bytes.length) return "truncated";

    // The CRC covers the type and data, not the length field.
    if (crc32(bytes, offset + 4, crcStart) !== readUint32BigEndian(bytes, crcStart)) {
      return "bad-chunk-crc";
    }

    if (isFirstChunk) {
      if (type !== "IHDR") return "missing-ihdr";
      isFirstChunk = false;
    }

    if (type === "IHDR") {
      ihdrCount += 1;
      if (ihdrCount > 1) return "duplicate-ihdr";
      // A CRC-correct chunk named IHDR with the wrong length would still let
      // readPngHeader read "dimensions" out of bytes that are not dimensions.
      if (length !== IHDR_DATA_BYTES) return "bad-ihdr-length";
    }

    // Two ordering invariants are enforced structurally rather than by
    // explicit branches, which would be unreachable: an IDAT can never
    // precede IHDR because a non-IHDR first chunk already returned
    // `missing-ihdr`, and nothing can follow IEND because IEND must end the
    // stream exactly (any remaining byte is `trailing-bytes`), which also
    // makes a duplicate IEND impossible to reach.
    //
    // IDAT consecutiveness is *not* structural and must be checked: the PNG
    // specification requires every IDAT chunk to be consecutive, so a stream
    // like `IHDR, IDAT, tEXt, IDAT, IEND` is malformed even though each
    // chunk is individually well-framed and CRC-correct.
    if (type === "IDAT") {
      if (sawNonIdatAfterIdat) return "non-consecutive-idat";
      idatCount += 1;
    } else if (idatCount > 0) {
      sawNonIdatAfterIdat = true;
    }

    if (type === "IEND") {
      if (length !== 0) return "bad-iend-length";
      sawIend = true;
      offset = crcStart + 4;
      // IEND must terminate the stream; anything after it is unaccounted for.
      if (offset !== bytes.length) return "trailing-bytes";
      break;
    }

    offset = crcStart + 4;
  }

  if (ihdrCount === 0) return "missing-ihdr";
  if (idatCount === 0) return "missing-idat";
  if (!sawIend) return "missing-iend";
  return null;
}
