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

export interface CaptureFailure {
  ok: false;
  filename: string;
  errorMessage: string;
}

export interface CaptureSuccess {
  ok: true;
  filename: string;
  dataUrl: string;
  byteLength: number;
  widthPx: number;
  heightPx: number;
}

export type CaptureResult = CaptureFailure | CaptureSuccess;

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

/**
 * Reads the canvas and proves the result is a real, non-empty PNG.
 *
 * A WebGL canvas normally clears its drawing buffer after presenting a frame, so
 * a readback taken outside the render loop can return a blank image. That is
 * exactly what this validation exists to catch; the renderer-side fix
 * (`preserveDrawingBuffer`) is a G4 concern and deliberately not decided here.
 */
export function validatePngCapture(
  canvas: CapturableCanvas,
  filename: string,
): CaptureResult {
  if (canvas.width === 0 || canvas.height === 0) {
    return {
      ok: false,
      filename,
      errorMessage: "The preview canvas has no rendered pixels to capture.",
    };
  }

  let dataUrl: string;
  try {
    dataUrl = canvas.toDataURL("image/png");
  } catch (error) {
    return {
      ok: false,
      filename,
      errorMessage: error instanceof Error ? error.message : "PNG capture failed.",
    };
  }

  const base64 = dataUrl.split(",")[1];
  if (dataUrl === "data:," || base64 === undefined || base64.length === 0) {
    return { ok: false, filename, errorMessage: "PNG capture produced no image data." };
  }

  const bytes = decodeBase64(base64);
  if (bytes === null) {
    return { ok: false, filename, errorMessage: "PNG capture produced undecodable data." };
  }
  if (bytes.length < MINIMUM_PNG_BYTES) {
    return {
      ok: false,
      filename,
      errorMessage: "PNG capture produced an unexpectedly small image.",
    };
  }

  const header = readPngHeader(bytes);
  if (header === null) {
    return {
      ok: false,
      filename,
      errorMessage: "PNG capture did not produce a valid PNG image.",
    };
  }

  return {
    ok: true,
    filename,
    dataUrl,
    byteLength: bytes.length,
    widthPx: header.widthPx,
    heightPx: header.heightPx,
  };
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
