import type {
  RasterTracePreset,
  RasterTraceSettings,
} from "@laserx/domain";

const COMMON_SETTINGS = {
  outputWidthMm: 150,
  crop: { left: 0, top: 0, right: 0, bottom: 0 },
  rotationDeg: 0,
  grayscaleMode: "luminance",
  contrast: 0,
  threshold: 128,
  invert: false,
  background: "auto",
} as const;

export const RASTER_TRACE_PRESETS: Readonly<
  Record<RasterTracePreset, RasterTraceSettings>
> = {
  draft: {
    ...COMMON_SETTINGS,
    preset: "draft",
    blurRadiusPx: 1,
    denoiseRadiusPx: 0,
    speckleAreaPx: 16,
    smoothingPasses: 0,
    simplificationToleranceMm: 0.4,
  },
  balanced: {
    ...COMMON_SETTINGS,
    preset: "balanced",
    blurRadiusPx: 1,
    denoiseRadiusPx: 1,
    speckleAreaPx: 6,
    smoothingPasses: 1,
    simplificationToleranceMm: 0.2,
  },
  detailed: {
    ...COMMON_SETTINGS,
    preset: "detailed",
    blurRadiusPx: 0,
    denoiseRadiusPx: 1,
    speckleAreaPx: 2,
    smoothingPasses: 1,
    simplificationToleranceMm: 0.08,
  },
};

export function settingsForRasterTracePreset(
  preset: RasterTracePreset,
): RasterTraceSettings {
  const settings = RASTER_TRACE_PRESETS[preset];
  return { ...settings, crop: { ...settings.crop } };
}

export function validateRasterTraceSettings(
  settings: RasterTraceSettings,
): void {
  const cropValues = Object.values(settings.crop);
  if (
    cropValues.some((value) => !Number.isFinite(value) || value < 0 || value >= 1) ||
    settings.crop.left + settings.crop.right >= 0.98 ||
    settings.crop.top + settings.crop.bottom >= 0.98
  ) {
    throw new RangeError("Raster crop fractions must leave at least two percent on each axis.");
  }
  if (!Number.isFinite(settings.outputWidthMm) || settings.outputWidthMm <= 0 || settings.outputWidthMm > 10_000) {
    throw new RangeError("Traced output width must be between 0 and 10,000 millimeters.");
  }
  if (!Number.isInteger(settings.contrast) || settings.contrast < -100 || settings.contrast > 100) {
    throw new RangeError("Raster contrast must be an integer from -100 to 100.");
  }
  if (!Number.isInteger(settings.threshold) || settings.threshold < 0 || settings.threshold > 255) {
    throw new RangeError("Raster threshold must be an integer from 0 to 255.");
  }
  if (!Number.isInteger(settings.blurRadiusPx) || settings.blurRadiusPx < 0 || settings.blurRadiusPx > 3) {
    throw new RangeError("Raster blur radius must be an integer from 0 to 3 pixels.");
  }
  if (!Number.isInteger(settings.denoiseRadiusPx) || settings.denoiseRadiusPx < 0 || settings.denoiseRadiusPx > 2) {
    throw new RangeError("Raster denoise radius must be an integer from 0 to 2 pixels.");
  }
  if (!Number.isInteger(settings.speckleAreaPx) || settings.speckleAreaPx < 0 || settings.speckleAreaPx > 100_000) {
    throw new RangeError("Speckle area must be an integer from 0 to 100,000 pixels.");
  }
  if (!Number.isInteger(settings.smoothingPasses) || settings.smoothingPasses < 0 || settings.smoothingPasses > 3) {
    throw new RangeError("Smoothing passes must be an integer from 0 to 3.");
  }
  if (
    !Number.isFinite(settings.simplificationToleranceMm) ||
    settings.simplificationToleranceMm <= 0 ||
    settings.simplificationToleranceMm > 10
  ) {
    throw new RangeError("Simplification tolerance must be between 0 and 10 millimeters.");
  }
}
