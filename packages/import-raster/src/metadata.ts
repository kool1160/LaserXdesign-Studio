import type {
  RasterSourceFormat,
  RasterSourceMetadata,
} from "@laserx/domain";

import {
  MAX_RASTER_DECODED_BYTES,
  MAX_RASTER_DECODED_PIXELS,
  MAX_RASTER_HEIGHT_PX,
  MAX_RASTER_SOURCE_BYTES,
  MAX_RASTER_WIDTH_PX,
} from "./limits.js";

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10] as const;
const JPEG_START_OF_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) * 0x1000000) +
    ((bytes[offset + 1] ?? 0) << 16) +
    ((bytes[offset + 2] ?? 0) << 8) +
    (bytes[offset + 3] ?? 0)
  );
}

function assertDimensions(widthPx: number, heightPx: number): void {
  if (
    !Number.isInteger(widthPx) ||
    !Number.isInteger(heightPx) ||
    widthPx <= 0 ||
    heightPx <= 0
  ) {
    throw new RangeError("Raster dimensions must be positive integers.");
  }
  if (widthPx > MAX_RASTER_WIDTH_PX || heightPx > MAX_RASTER_HEIGHT_PX) {
    throw new RangeError(
      `Raster dimensions exceed the ${String(MAX_RASTER_WIDTH_PX)} x ${String(MAX_RASTER_HEIGHT_PX)} pixel limit.`,
    );
  }
  if (widthPx > Math.floor(MAX_RASTER_DECODED_PIXELS / heightPx)) {
    throw new RangeError(
      `Raster decode exceeds the ${String(MAX_RASTER_DECODED_PIXELS)} pixel memory limit.`,
    );
  }
}

function inspectPng(bytes: Uint8Array): { widthPx: number; heightPx: number } {
  if (
    bytes.length < 33 ||
    PNG_SIGNATURE.some((value, index) => bytes[index] !== value) ||
    String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR" ||
    readUint32(bytes, 8) !== 13
  ) {
    throw new RangeError("The selected PNG has an invalid signature or IHDR header.");
  }
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    if (length > bytes.length - offset - 12) {
      throw new RangeError("The selected PNG contains a truncated chunk.");
    }
    if (type === "acTL") {
      throw new RangeError("Animated PNG files are not supported for deterministic tracing.");
    }
    offset += length + 12;
    if (type === "IEND") {
      break;
    }
  }
  return { widthPx: readUint32(bytes, 16), heightPx: readUint32(bytes, 20) };
}

function inspectJpeg(bytes: Uint8Array): { widthPx: number; heightPx: number } {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new RangeError("The selected JPEG has an invalid start-of-image marker.");
  }
  let offset = 2;
  while (offset + 3 < bytes.length) {
    while (bytes[offset] === 0xff) {
      offset += 1;
    }
    const marker = bytes[offset];
    offset += 1;
    if (marker === undefined || marker === 0xd9 || marker === 0xda) {
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }
    const segmentLength = ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) {
      throw new RangeError("The selected JPEG contains a truncated segment.");
    }
    if (JPEG_START_OF_FRAME_MARKERS.has(marker)) {
      if (segmentLength < 7) {
        throw new RangeError("The selected JPEG has an invalid frame header.");
      }
      return {
        heightPx: ((bytes[offset + 3] ?? 0) << 8) | (bytes[offset + 4] ?? 0),
        widthPx: ((bytes[offset + 5] ?? 0) << 8) | (bytes[offset + 6] ?? 0),
      };
    }
    offset += segmentLength;
  }
  throw new RangeError("The selected JPEG has no supported image frame.");
}

export function inspectRasterSource(
  bytes: Uint8Array,
  expectedFormat?: RasterSourceFormat,
): RasterSourceMetadata {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_RASTER_SOURCE_BYTES) {
    throw new RangeError(
      `Raster source must contain 1 to ${String(MAX_RASTER_SOURCE_BYTES)} bytes.`,
    );
  }
  const detectedFormat: RasterSourceFormat = PNG_SIGNATURE.every(
    (value, index) => bytes[index] === value,
  )
    ? "png"
    : bytes[0] === 0xff && bytes[1] === 0xd8
      ? "jpeg"
      : (() => {
          throw new RangeError("Choose a valid PNG or JPEG raster file.");
        })();
  if (expectedFormat !== undefined && detectedFormat !== expectedFormat) {
    throw new RangeError(
      `The file extension does not match the detected ${detectedFormat.toUpperCase()} content.`,
    );
  }
  const dimensions = detectedFormat === "png"
    ? inspectPng(bytes)
    : inspectJpeg(bytes);
  assertDimensions(dimensions.widthPx, dimensions.heightPx);
  const decodedBytes = dimensions.widthPx * dimensions.heightPx * 4;
  if (decodedBytes > MAX_RASTER_DECODED_BYTES) {
    throw new RangeError("Raster decoded memory exceeds the configured safety limit.");
  }
  return {
    format: detectedFormat,
    ...dimensions,
    sourceBytes: bytes.byteLength,
    decodedBytes,
  };
}

export function validateDecodedRaster(
  metadata: RasterSourceMetadata,
  widthPx: number,
  heightPx: number,
  rgba: Uint8Array,
): void {
  if (widthPx !== metadata.widthPx || heightPx !== metadata.heightPx) {
    throw new RangeError("Decoded raster dimensions do not match the validated source header.");
  }
  if (rgba.byteLength !== metadata.decodedBytes) {
    throw new RangeError("Decoded raster byte length does not match its validated dimensions.");
  }
}
