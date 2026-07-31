import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  GRID_TRACE_ENGINE_ID,
  GRID_TRACE_ENGINE_VERSION,
  runRasterTraceTask,
  settingsForRasterTracePreset,
  type DecodedRaster,
} from "../src/index.js";

interface GoldenCase {
  id: string;
  kind: "rows" | "rectangle";
  rows?: string[];
  widthPx?: number;
  heightPx?: number;
  rectangle?: { left: number; top: number; right: number; bottom: number };
  outputWidthMm: number;
  speckleAreaPx: number;
  expected: {
    pathCount: number;
    nodeCount: number;
    removedSpeckleCount: number;
    removedSpeckleAreaPx: number;
    paths: number[][][];
  };
}

const fixture = JSON.parse(
  readFileSync(
    new URL("../../../fixtures/images/m07-raster-trace-goldens.json", import.meta.url),
    "utf8",
  ),
) as {
  schemaVersion: number;
  engine: { id: string; version: string };
  cases: GoldenCase[];
};

function rgbaRaster(golden: GoldenCase): DecodedRaster {
  const widthPx = golden.kind === "rows"
    ? golden.rows?.[0]?.length ?? 0
    : golden.widthPx ?? 0;
  const heightPx = golden.kind === "rows"
    ? golden.rows?.length ?? 0
    : golden.heightPx ?? 0;
  const rgba = new Uint8Array(widthPx * heightPx * 4).fill(255);
  for (let index = 0; index < widthPx * heightPx; index += 1) {
    rgba[index * 4 + 3] = 255;
  }
  if (golden.kind === "rows") {
    golden.rows?.forEach((row, y) => {
      Array.from({ length: row.length }, (_unused, x) => row.charAt(x)).forEach((pixel, x) => {
        const value = pixel === "#" ? 0 : pixel === "+" ? 120 : 255;
        const offset = (y * widthPx + x) * 4;
        rgba[offset] = value;
        rgba[offset + 1] = value;
        rgba[offset + 2] = value;
      });
    });
  } else {
    const rectangle = golden.rectangle;
    if (rectangle === undefined) throw new Error("Rectangle fixture is incomplete.");
    for (let y = rectangle.top; y < rectangle.bottom; y += 1) {
      for (let x = rectangle.left; x < rectangle.right; x += 1) {
        const offset = (y * widthPx + x) * 4;
        rgba[offset] = 0;
        rgba[offset + 1] = 0;
        rgba[offset + 2] = 0;
      }
    }
  }
  return { widthPx, heightPx, rgba };
}

describe("reviewed M07 raster trace goldens", () => {
  it("pins the reviewed engine identity", () => {
    expect(fixture).toMatchObject({
      schemaVersion: 1,
      engine: { id: GRID_TRACE_ENGINE_ID, version: GRID_TRACE_ENGINE_VERSION },
    });
  });

  for (const golden of fixture.cases) {
    it(`matches ${golden.id} geometry and filtering evidence`, () => {
      const image = rgbaRaster(golden);
      const settings = {
        ...settingsForRasterTracePreset("balanced"),
        outputWidthMm: golden.outputWidthMm,
        threshold: 128,
        blurRadiusPx: 0,
        denoiseRadiusPx: 0,
        speckleAreaPx: golden.speckleAreaPx,
        smoothingPasses: 0,
        simplificationToleranceMm: 0.01,
      };
      const result = runRasterTraceTask({
        operationId: `golden-${golden.id}`,
        source: {
          format: "png",
          widthPx: image.widthPx,
          heightPx: image.heightPx,
          sourceBytes: 100,
          decodedBytes: image.rgba.byteLength,
        },
        image,
        settings,
      });
      expect(result.candidate.summary).toMatchObject({
        pathCount: golden.expected.pathCount,
        nodeCount: golden.expected.nodeCount,
        removedSpeckleCount: golden.expected.removedSpeckleCount,
        removedSpeckleAreaPx: golden.expected.removedSpeckleAreaPx,
      });
      expect(
        result.candidate.paths.map((path) =>
          path.points.map((point) => [
            Number(point.xMm.toFixed(9)),
            Number(point.yMm.toFixed(9)),
          ]),
        ),
      ).toEqual(golden.expected.paths);
    });
  }
});
