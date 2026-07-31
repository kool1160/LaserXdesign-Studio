import type { BoundsMm } from "@laserx/geometry";

import type { InterchangePath, InterchangeWarning } from "./interchange.js";

export type RasterSourceFormat = "png" | "jpeg";
export type RasterTracePreset = "draft" | "balanced" | "detailed";
export type RasterGrayscaleMode = "luminance" | "average";
export type RasterBackgroundMode = "auto" | "white" | "black";

export interface RasterCropSettings {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface RasterTraceSettings {
  preset: RasterTracePreset;
  outputWidthMm: number;
  crop: RasterCropSettings;
  rotationDeg: 0 | 90 | 180 | 270;
  grayscaleMode: RasterGrayscaleMode;
  contrast: number;
  threshold: number;
  invert: boolean;
  blurRadiusPx: number;
  denoiseRadiusPx: number;
  background: RasterBackgroundMode;
  speckleAreaPx: number;
  smoothingPasses: number;
  simplificationToleranceMm: number;
}

export interface RasterSourceMetadata {
  format: RasterSourceFormat;
  widthPx: number;
  heightPx: number;
  sourceBytes: number;
  decodedBytes: number;
}

export interface RasterTraceSummary {
  engineId: string;
  engineVersion: string;
  sourceWidthPx: number;
  sourceHeightPx: number;
  traceWidthPx: number;
  traceHeightPx: number;
  outputWidthMm: number;
  outputHeightMm: number;
  pathCount: number;
  nodeCount: number;
  sourceBoundaryNodeCount: number;
  smallestFeatureMm: number | null;
  speckleThresholdPx: number;
  removedSpeckleCount: number;
  removedSpeckleAreaPx: number;
  simplificationToleranceMm: number;
  bounds: BoundsMm | null;
}

export interface RasterTraceCandidate {
  source: RasterSourceMetadata;
  settings: RasterTraceSettings;
  paths: InterchangePath[];
  warnings: InterchangeWarning[];
  assumptions: string[];
  summary: RasterTraceSummary;
}
