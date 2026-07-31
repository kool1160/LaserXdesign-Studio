import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import {
  GRID_TRACE_ENGINE_ID,
  GRID_TRACE_ENGINE_VERSION,
  MAX_RASTER_TRACE_PIXELS,
  inspectRasterSource,
  runRasterTraceTask,
  settingsForRasterTracePreset,
  type DecodedRaster,
} from "../src/index.js";

interface GoldenCase {
  id: string;
  file: string;
  widthPx: number;
  heightPx: number;
  sha256: string;
  reviewEvidence: string;
  settings: {
    outputWidthMm: number;
    threshold: number;
    speckleAreaPx: number;
    simplificationToleranceMm: number;
  };
  expected: {
    pathCount: number;
    nodeCount: number;
    traceWidthPx: number;
    traceHeightPx: number;
    removedSpeckleCount: number;
    removedSpeckleAreaPx: number;
    warningCodes: string[];
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
  jpegEvidence: {
    file: string;
    widthPx: number;
    heightPx: number;
    sha256: string;
  };
  cases: GoldenCase[];
};

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) * 0x1000000) +
    ((bytes[offset + 1] ?? 0) << 16) +
    ((bytes[offset + 2] ?? 0) << 8) +
    (bytes[offset + 3] ?? 0)
  );
}

function decodeGeneratedPng(bytes: Uint8Array): DecodedRaster {
  let widthPx = 0;
  let heightPx = 0;
  const idat: Uint8Array[] = [];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (type === "IHDR") {
      widthPx = readUint32(bytes, dataStart);
      heightPx = readUint32(bytes, dataStart + 4);
      if (
        bytes[dataStart + 8] !== 8 ||
        bytes[dataStart + 9] !== 6 ||
        bytes[dataStart + 12] !== 0
      ) {
        throw new Error("Generated M07 PNG must be non-interlaced 8-bit RGBA.");
      }
    } else if (type === "IDAT") {
      idat.push(bytes.slice(dataStart, dataEnd));
    }
    offset = dataEnd + 4;
  }
  const raw = new Uint8Array(
    inflateSync(Buffer.concat(idat.map((chunk) => Buffer.from(chunk)))),
  );
  const stride = widthPx * 4;
  const rgba = new Uint8Array(widthPx * heightPx * 4);
  for (let y = 0; y < heightPx; y += 1) {
    const rawOffset = y * (stride + 1);
    if (raw[rawOffset] !== 0) {
      throw new Error("Generated M07 PNG must use deterministic filter-zero rows.");
    }
    rgba.set(raw.subarray(rawOffset + 1, rawOffset + 1 + stride), y * stride);
  }
  return { widthPx, heightPx, rgba };
}

function fixtureBytes(file: string): Uint8Array {
  return new Uint8Array(
    readFileSync(new URL(`../../../fixtures/images/${file}`, import.meta.url)),
  );
}

describe("reviewed M07 raster trace goldens", () => {
  it("pins the reviewed engine identity and a real bounded JPEG", () => {
    expect(fixture).toMatchObject({
      schemaVersion: 2,
      engine: { id: GRID_TRACE_ENGINE_ID, version: GRID_TRACE_ENGINE_VERSION },
    });
    const jpeg = fixtureBytes(fixture.jpegEvidence.file);
    expect(createHash("sha256").update(jpeg).digest("hex")).toBe(
      fixture.jpegEvidence.sha256,
    );
    expect(inspectRasterSource(jpeg, "jpeg")).toMatchObject({
      format: "jpeg",
      widthPx: fixture.jpegEvidence.widthPx,
      heightPx: fixture.jpegEvidence.heightPx,
    });
  });

  for (const golden of fixture.cases) {
    it(`matches ${golden.id} file geometry and filtering evidence`, () => {
      const bytes = fixtureBytes(golden.file);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(golden.sha256);
      const source = inspectRasterSource(bytes, "png");
      expect(source).toMatchObject({
        widthPx: golden.widthPx,
        heightPx: golden.heightPx,
      });
      const image = decodeGeneratedPng(bytes);
      const distinctValues = new Set(
        Array.from({ length: image.widthPx * image.heightPx }, (_unused, index) =>
          image.rgba[index * 4] ?? 0,
        ),
      );
      if (golden.id === "noisy-photo") expect(distinctValues.size).toBeGreaterThan(40);
      if (golden.id === "anti-aliased-text") {
        expect([...distinctValues].some((value) => value > 24 && value < 248)).toBe(true);
      }
      if (golden.id === "high-resolution") {
        expect(image.widthPx * image.heightPx).toBeGreaterThan(MAX_RASTER_TRACE_PIXELS);
      }
      const settings = {
        ...settingsForRasterTracePreset("balanced"),
        ...golden.settings,
        blurRadiusPx: 0,
        denoiseRadiusPx: 0,
        smoothingPasses: 0,
      };
      const result = runRasterTraceTask({
        operationId: `golden-${golden.id}`,
        source,
        image,
        settings,
      });
      const actual = {
        pathCount: result.candidate.summary.pathCount,
        nodeCount: result.candidate.summary.nodeCount,
        traceWidthPx: result.candidate.summary.traceWidthPx,
        traceHeightPx: result.candidate.summary.traceHeightPx,
        removedSpeckleCount: result.candidate.summary.removedSpeckleCount,
        removedSpeckleAreaPx: result.candidate.summary.removedSpeckleAreaPx,
        warningCodes: result.candidate.warnings.map((warning) => warning.code),
        paths: result.candidate.paths.map((path) =>
          path.points.map((point) => [
            Number(point.xMm.toFixed(6)),
            Number(point.yMm.toFixed(6)),
          ]),
        ),
      };
      console.info(`M07 real golden ${golden.id}`, JSON.stringify(actual));
      expect(actual).toEqual(golden.expected);
    }, 30_000);
  }
});
