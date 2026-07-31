import type {
  RasterBackgroundMode,
  RasterTraceSettings,
} from "@laserx/domain";

import {
  MAX_RASTER_PREVIEW_DIMENSION_PX,
  MAX_RASTER_TRACE_PIXELS,
} from "./limits.js";

export interface DecodedRaster {
  widthPx: number;
  heightPx: number;
  rgba: Uint8Array;
}

export interface PreprocessedRaster {
  widthPx: number;
  heightPx: number;
  originalRgba: Uint8Array;
  grayscale: Uint8Array;
  binary: Uint8Array;
  edges: Uint8Array;
  downsampled: boolean;
}

export interface RasterPreviewPixels {
  widthPx: number;
  heightPx: number;
  originalRgba: Uint8Array;
  blackWhiteRgba: Uint8Array;
  edgeRgba: Uint8Array;
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function resolvedBackground(
  image: DecodedRaster,
  mode: RasterBackgroundMode,
): number {
  if (mode === "white") {
    return 255;
  }
  if (mode === "black") {
    return 0;
  }
  let total = 0;
  let count = 0;
  const step = Math.max(1, Math.floor(Math.max(image.widthPx, image.heightPx) / 512));
  const sample = (x: number, y: number): void => {
    const offset = (y * image.widthPx + x) * 4;
    const alpha = (image.rgba[offset + 3] ?? 0) / 255;
    if (alpha > 0.5) {
      total +=
        (image.rgba[offset] ?? 0) * 0.2126 +
        (image.rgba[offset + 1] ?? 0) * 0.7152 +
        (image.rgba[offset + 2] ?? 0) * 0.0722;
      count += 1;
    }
  };
  for (let x = 0; x < image.widthPx; x += step) {
    sample(x, 0);
    sample(x, image.heightPx - 1);
  }
  for (let y = step; y < image.heightPx - 1; y += step) {
    sample(0, y);
    sample(image.widthPx - 1, y);
  }
  return count === 0 || total / count >= 128 ? 255 : 0;
}

function rotatedSourceCoordinate(
  x: number,
  y: number,
  cropWidth: number,
  cropHeight: number,
  rotationDeg: RasterTraceSettings["rotationDeg"],
): { x: number; y: number } {
  switch (rotationDeg) {
    case 0:
      return { x, y };
    case 90:
      return { x: y, y: cropHeight - 1 - x };
    case 180:
      return { x: cropWidth - 1 - x, y: cropHeight - 1 - y };
    case 270:
      return { x: cropWidth - 1 - y, y: x };
  }
}

function boxBlur(
  source: Uint8Array,
  width: number,
  height: number,
  radius: number,
): Uint8Array {
  if (radius === 0) {
    return source.slice();
  }
  const horizontal = new Uint8Array(source.length);
  for (let y = 0; y < height; y += 1) {
    let sum = 0;
    for (let x = -radius; x <= radius; x += 1) {
      sum += source[y * width + Math.max(0, Math.min(width - 1, x))] ?? 0;
    }
    for (let x = 0; x < width; x += 1) {
      horizontal[y * width + x] = Math.round(sum / (radius * 2 + 1));
      const removeX = Math.max(0, x - radius);
      const addX = Math.min(width - 1, x + radius + 1);
      sum += (source[y * width + addX] ?? 0) - (source[y * width + removeX] ?? 0);
    }
  }
  const output = new Uint8Array(source.length);
  for (let x = 0; x < width; x += 1) {
    let sum = 0;
    for (let y = -radius; y <= radius; y += 1) {
      sum += horizontal[Math.max(0, Math.min(height - 1, y)) * width + x] ?? 0;
    }
    for (let y = 0; y < height; y += 1) {
      output[y * width + x] = Math.round(sum / (radius * 2 + 1));
      const removeY = Math.max(0, y - radius);
      const addY = Math.min(height - 1, y + radius + 1);
      sum += (horizontal[addY * width + x] ?? 0) - (horizontal[removeY * width + x] ?? 0);
    }
  }
  return output;
}

function medianDenoise(
  source: Uint8Array,
  width: number,
  height: number,
  radius: number,
): Uint8Array {
  if (radius === 0) {
    return source.slice();
  }
  const output = new Uint8Array(source.length);
  const values: number[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      values.length = 0;
      for (let dy = -radius; dy <= radius; dy += 1) {
        const sampleY = Math.max(0, Math.min(height - 1, y + dy));
        for (let dx = -radius; dx <= radius; dx += 1) {
          const sampleX = Math.max(0, Math.min(width - 1, x + dx));
          values.push(source[sampleY * width + sampleX] ?? 0);
        }
      }
      values.sort((first, second) => first - second);
      output[y * width + x] = values[Math.floor(values.length / 2)] ?? 0;
    }
  }
  return output;
}

function sobelEdges(source: Uint8Array, width: number, height: number): Uint8Array {
  const output = new Uint8Array(source.length);
  const sample = (x: number, y: number): number =>
    source[Math.max(0, Math.min(height - 1, y)) * width + Math.max(0, Math.min(width - 1, x))] ?? 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const gx =
        -sample(x - 1, y - 1) + sample(x + 1, y - 1) -
        2 * sample(x - 1, y) + 2 * sample(x + 1, y) -
        sample(x - 1, y + 1) + sample(x + 1, y + 1);
      const gy =
        -sample(x - 1, y - 1) - 2 * sample(x, y - 1) - sample(x + 1, y - 1) +
        sample(x - 1, y + 1) + 2 * sample(x, y + 1) + sample(x + 1, y + 1);
      output[y * width + x] = clampByte(Math.hypot(gx, gy));
    }
  }
  return output;
}

export function preprocessRaster(
  image: DecodedRaster,
  settings: RasterTraceSettings,
): PreprocessedRaster {
  const left = Math.floor(image.widthPx * settings.crop.left);
  const top = Math.floor(image.heightPx * settings.crop.top);
  const right = Math.ceil(image.widthPx * (1 - settings.crop.right));
  const bottom = Math.ceil(image.heightPx * (1 - settings.crop.bottom));
  const cropWidth = right - left;
  const cropHeight = bottom - top;
  if (cropWidth < 2 || cropHeight < 2) {
    throw new RangeError("Raster crop must retain at least two pixels on each axis.");
  }
  const rotatedWidth = settings.rotationDeg === 90 || settings.rotationDeg === 270
    ? cropHeight
    : cropWidth;
  const rotatedHeight = settings.rotationDeg === 90 || settings.rotationDeg === 270
    ? cropWidth
    : cropHeight;
  const scale = Math.min(
    1,
    Math.sqrt(MAX_RASTER_TRACE_PIXELS / (rotatedWidth * rotatedHeight)),
  );
  const widthPx = Math.max(2, Math.floor(rotatedWidth * scale));
  const heightPx = Math.max(2, Math.floor(rotatedHeight * scale));
  const background = resolvedBackground(image, settings.background);
  const originalRgba = new Uint8Array(widthPx * heightPx * 4);
  const grayscale = new Uint8Array(widthPx * heightPx);
  const contrastFactor = (100 + settings.contrast) / 100;
  for (let y = 0; y < heightPx; y += 1) {
    for (let x = 0; x < widthPx; x += 1) {
      const rotatedX = Math.min(rotatedWidth - 1, Math.floor(((x + 0.5) * rotatedWidth) / widthPx));
      const rotatedY = Math.min(rotatedHeight - 1, Math.floor(((y + 0.5) * rotatedHeight) / heightPx));
      const source = rotatedSourceCoordinate(
        rotatedX,
        rotatedY,
        cropWidth,
        cropHeight,
        settings.rotationDeg,
      );
      const sourceOffset = ((top + source.y) * image.widthPx + left + source.x) * 4;
      const alpha = (image.rgba[sourceOffset + 3] ?? 0) / 255;
      const red = clampByte((image.rgba[sourceOffset] ?? 0) * alpha + background * (1 - alpha));
      const green = clampByte((image.rgba[sourceOffset + 1] ?? 0) * alpha + background * (1 - alpha));
      const blue = clampByte((image.rgba[sourceOffset + 2] ?? 0) * alpha + background * (1 - alpha));
      const outputOffset = (y * widthPx + x) * 4;
      originalRgba[outputOffset] = red;
      originalRgba[outputOffset + 1] = green;
      originalRgba[outputOffset + 2] = blue;
      originalRgba[outputOffset + 3] = 255;
      const gray = settings.grayscaleMode === "average"
        ? (red + green + blue) / 3
        : red * 0.2126 + green * 0.7152 + blue * 0.0722;
      grayscale[y * widthPx + x] = clampByte((gray - 128) * contrastFactor + 128);
    }
  }
  const blurred = boxBlur(grayscale, widthPx, heightPx, settings.blurRadiusPx);
  const denoised = medianDenoise(blurred, widthPx, heightPx, settings.denoiseRadiusPx);
  const binary = new Uint8Array(denoised.length);
  for (let index = 0; index < denoised.length; index += 1) {
    const dark = (denoised[index] ?? 0) <= settings.threshold;
    binary[index] = dark !== settings.invert ? 1 : 0;
  }
  return {
    widthPx,
    heightPx,
    originalRgba,
    grayscale: denoised,
    binary,
    edges: sobelEdges(denoised, widthPx, heightPx),
    downsampled: widthPx !== rotatedWidth || heightPx !== rotatedHeight,
  };
}

function previewDimensions(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, MAX_RASTER_PREVIEW_DIMENSION_PX / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function rgbaFromScalar(
  source: Uint8Array,
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number,
  binary: boolean,
): Uint8Array {
  const output = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(sourceWidth - 1, Math.floor(((x + 0.5) * sourceWidth) / width));
      const sourceY = Math.min(sourceHeight - 1, Math.floor(((y + 0.5) * sourceHeight) / height));
      const value = binary
        ? (source[sourceY * sourceWidth + sourceX] ?? 0) === 1 ? 0 : 255
        : source[sourceY * sourceWidth + sourceX] ?? 0;
      const offset = (y * width + x) * 4;
      output[offset] = value;
      output[offset + 1] = value;
      output[offset + 2] = value;
      output[offset + 3] = 255;
    }
  }
  return output;
}

function resizeRgba(
  source: Uint8Array,
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number,
): Uint8Array {
  const output = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(sourceWidth - 1, Math.floor(((x + 0.5) * sourceWidth) / width));
      const sourceY = Math.min(sourceHeight - 1, Math.floor(((y + 0.5) * sourceHeight) / height));
      const sourceOffset = (sourceY * sourceWidth + sourceX) * 4;
      const outputOffset = (y * width + x) * 4;
      output.set(source.subarray(sourceOffset, sourceOffset + 4), outputOffset);
    }
  }
  return output;
}

export function createRasterPreviewPixels(
  raster: PreprocessedRaster,
): RasterPreviewPixels {
  const dimensions = previewDimensions(raster.widthPx, raster.heightPx);
  return {
    widthPx: dimensions.width,
    heightPx: dimensions.height,
    originalRgba: resizeRgba(
      raster.originalRgba,
      raster.widthPx,
      raster.heightPx,
      dimensions.width,
      dimensions.height,
    ),
    blackWhiteRgba: rgbaFromScalar(
      raster.binary,
      raster.widthPx,
      raster.heightPx,
      dimensions.width,
      dimensions.height,
      true,
    ),
    edgeRgba: rgbaFromScalar(
      raster.edges,
      raster.widthPx,
      raster.heightPx,
      dimensions.width,
      dimensions.height,
      false,
    ),
  };
}
