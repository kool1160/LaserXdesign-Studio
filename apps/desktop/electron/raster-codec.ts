import { deflateSync, inflateSync } from "node:zlib";

import type { RasterSourceMetadata } from "@laserx/domain";
import {
  validateDecodedRaster,
  type DecodedRaster,
  type RasterPreviewPixels,
} from "@laserx/import-raster";

interface NativeImageLike {
  isEmpty(): boolean;
  getSize(scaleFactor?: number): { width: number; height: number };
  toPNG(options?: { scaleFactor?: number }): Buffer;
}

export interface NativeImageFactory {
  createFromBuffer(buffer: Buffer): NativeImageLike;
}

export interface RasterCodecPort {
  decode(
    bytes: Uint8Array,
    metadata: RasterSourceMetadata,
  ): DecodedRaster | Promise<DecodedRaster>;
  encodePreview(
    preview: RasterPreviewPixels,
  ): RasterPreviewDataUrls | Promise<RasterPreviewDataUrls>;
}

export interface RasterPreviewDataUrls {
  widthPx: number;
  heightPx: number;
  original: string;
  blackWhite: string;
  edges: string;
}

function readUint32(buffer: Uint8Array, offset: number): number {
  return (
    ((buffer[offset] ?? 0) * 0x1000000) +
    ((buffer[offset + 1] ?? 0) << 16) +
    ((buffer[offset + 2] ?? 0) << 8) +
    (buffer[offset + 3] ?? 0)
  );
}

function paeth(left: number, above: number, upperLeft: number): number {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  return leftDistance <= aboveDistance && leftDistance <= upperLeftDistance
    ? left
    : aboveDistance <= upperLeftDistance
      ? above
      : upperLeft;
}

function decodeNormalizedPng(png: Uint8Array): DecodedRaster {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (signature.some((value, index) => png[index] !== value)) {
    throw new RangeError("Electron returned an invalid normalized PNG raster.");
  }
  let widthPx = 0;
  let heightPx = 0;
  let bitDepth = 0;
  let colorType = -1;
  let interlace = -1;
  const idat: Uint8Array[] = [];
  let offset = 8;
  while (offset + 12 <= png.length) {
    const length = readUint32(png, offset);
    const type = String.fromCharCode(...png.slice(offset + 4, offset + 8));
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > png.length) {
      throw new RangeError("Electron returned a truncated normalized PNG raster.");
    }
    if (type === "IHDR") {
      widthPx = readUint32(png, dataStart);
      heightPx = readUint32(png, dataStart + 4);
      bitDepth = png[dataStart + 8] ?? 0;
      colorType = png[dataStart + 9] ?? -1;
      interlace = png[dataStart + 12] ?? -1;
    } else if (type === "IDAT") {
      idat.push(png.slice(dataStart, dataEnd));
    } else if (type === "IEND") {
      break;
    }
    offset = dataEnd + 4;
  }
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : colorType === 0 ? 1 : 0;
  if (widthPx <= 0 || heightPx <= 0 || bitDepth !== 8 || channels === 0 || interlace !== 0) {
    throw new RangeError("Electron returned an unsupported normalized PNG pixel layout.");
  }
  const compressed = Buffer.concat(idat.map((chunk) => Buffer.from(chunk)));
  const raw = new Uint8Array(inflateSync(compressed));
  const stride = widthPx * channels;
  if (raw.length !== heightPx * (stride + 1)) {
    throw new RangeError("Electron returned malformed normalized PNG scanlines.");
  }
  const scanlines = new Uint8Array(heightPx * stride);
  let rawOffset = 0;
  for (let y = 0; y < heightPx; y += 1) {
    const filter = raw[rawOffset] ?? 255;
    rawOffset += 1;
    for (let x = 0; x < stride; x += 1) {
      const encoded = raw[rawOffset + x] ?? 0;
      const outputOffset = y * stride + x;
      const left = x >= channels ? scanlines[outputOffset - channels] ?? 0 : 0;
      const above = y > 0 ? scanlines[outputOffset - stride] ?? 0 : 0;
      const upperLeft = y > 0 && x >= channels
        ? scanlines[outputOffset - stride - channels] ?? 0
        : 0;
      const value = filter === 0
        ? encoded
        : filter === 1
          ? encoded + left
          : filter === 2
            ? encoded + above
            : filter === 3
              ? encoded + Math.floor((left + above) / 2)
              : filter === 4
                ? encoded + paeth(left, above, upperLeft)
                : (() => {
                    throw new RangeError("Electron returned an invalid normalized PNG filter.");
                  })();
      scanlines[outputOffset] = value & 0xff;
    }
    rawOffset += stride;
  }
  const rgba = new Uint8Array(widthPx * heightPx * 4);
  for (let index = 0; index < widthPx * heightPx; index += 1) {
    const inputOffset = index * channels;
    const outputOffset = index * 4;
    if (colorType === 6) {
      rgba.set(scanlines.subarray(inputOffset, inputOffset + 4), outputOffset);
    } else if (colorType === 2) {
      rgba[outputOffset] = scanlines[inputOffset] ?? 0;
      rgba[outputOffset + 1] = scanlines[inputOffset + 1] ?? 0;
      rgba[outputOffset + 2] = scanlines[inputOffset + 2] ?? 0;
      rgba[outputOffset + 3] = 255;
    } else {
      const gray = scanlines[inputOffset] ?? 0;
      rgba[outputOffset] = gray;
      rgba[outputOffset + 1] = gray;
      rgba[outputOffset + 2] = gray;
      rgba[outputOffset + 3] = colorType === 4 ? scanlines[inputOffset + 1] ?? 0 : 255;
    }
  }
  return { widthPx, heightPx, rgba };
}

const CRC_TABLE = Array.from({ length: 256 }, (_unused, value) => {
  let current = value;
  for (let bit = 0; bit < 8; bit += 1) {
    current = (current & 1) === 1
      ? 0xedb88320 ^ (current >>> 1)
      : current >>> 1;
  }
  return current >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  typeBytes.copy(output, 4);
  Buffer.from(data).copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([typeBytes, Buffer.from(data)])), 8 + data.length);
  return output;
}

export function encodeRgbaPng(
  widthPx: number,
  heightPx: number,
  rgba: Uint8Array,
): Buffer {
  if (widthPx <= 0 || heightPx <= 0 || rgba.length !== widthPx * heightPx * 4) {
    throw new RangeError("PNG preview dimensions do not match the supplied RGBA pixels.");
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(widthPx, 0);
  header.writeUInt32BE(heightPx, 4);
  header[8] = 8;
  header[9] = 6;
  const scanlines = Buffer.alloc(heightPx * (widthPx * 4 + 1));
  for (let y = 0; y < heightPx; y += 1) {
    const rowOffset = y * (widthPx * 4 + 1);
    scanlines[rowOffset] = 0;
    Buffer.from(rgba.subarray(y * widthPx * 4, (y + 1) * widthPx * 4)).copy(
      scanlines,
      rowOffset + 1,
    );
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(scanlines, { level: 9 })),
    pngChunk("IEND", new Uint8Array()),
  ]);
}

function dataUrl(widthPx: number, heightPx: number, rgba: Uint8Array): string {
  return `data:image/png;base64,${encodeRgbaPng(widthPx, heightPx, rgba).toString("base64")}`;
}

export class ElectronRasterCodec implements RasterCodecPort {
  readonly #nativeImages: NativeImageFactory;

  public constructor(nativeImages: NativeImageFactory) {
    this.#nativeImages = nativeImages;
  }

  public decode(bytes: Uint8Array, metadata: RasterSourceMetadata): DecodedRaster {
    const native = this.#nativeImages.createFromBuffer(Buffer.from(bytes));
    if (native.isEmpty()) {
      throw new RangeError("Electron could not decode the validated PNG/JPEG raster.");
    }
    const dimensions = native.getSize(1);
    if (dimensions.width !== metadata.widthPx || dimensions.height !== metadata.heightPx) {
      throw new RangeError("Decoded raster dimensions do not match the validated file header.");
    }
    const decoded = decodeNormalizedPng(native.toPNG({ scaleFactor: 1 }));
    validateDecodedRaster(metadata, decoded.widthPx, decoded.heightPx, decoded.rgba);
    return decoded;
  }

  public encodePreview(preview: RasterPreviewPixels): RasterPreviewDataUrls {
    return {
      widthPx: preview.widthPx,
      heightPx: preview.heightPx,
      original: dataUrl(preview.widthPx, preview.heightPx, preview.originalRgba),
      blackWhite: dataUrl(preview.widthPx, preview.heightPx, preview.blackWhiteRgba),
      edges: dataUrl(preview.widthPx, preview.heightPx, preview.edgeRgba),
    };
  }
}
