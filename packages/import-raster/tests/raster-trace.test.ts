import { performance } from "node:perf_hooks";

import { describe, expect, it } from "vitest";

import {
  maximumClosedPathDeviation,
  inspectRasterSource,
  runRasterTraceTask,
  settingsForRasterTracePreset,
  type DecodedRaster,
} from "../src/index.js";

function rasterFromRows(rows: readonly string[]): DecodedRaster {
  const widthPx = rows[0]?.length ?? 0;
  const heightPx = rows.length;
  const rgba = new Uint8Array(widthPx * heightPx * 4);
  rows.forEach((row, y) => {
    expect(row).toHaveLength(widthPx);
    Array.from({ length: row.length }, (_unused, x) => row.charAt(x)).forEach((pixel, x) => {
      const offset = (y * widthPx + x) * 4;
      const value = pixel === "#" ? 0 : pixel === "+" ? 120 : 255;
      rgba[offset] = value;
      rgba[offset + 1] = value;
      rgba[offset + 2] = value;
      rgba[offset + 3] = 255;
    });
  });
  return { widthPx, heightPx, rgba };
}

function request(image: DecodedRaster) {
  return {
    operationId: "trace-test",
    source: {
      format: "png" as const,
      widthPx: image.widthPx,
      heightPx: image.heightPx,
      sourceBytes: 100,
      decodedBytes: image.rgba.byteLength,
    },
    image,
    settings: {
      ...settingsForRasterTracePreset("balanced"),
      outputWidthMm: image.widthPx * 10,
      blurRadiusPx: 0,
      denoiseRadiusPx: 0,
      speckleAreaPx: 1,
      smoothingPasses: 0,
      simplificationToleranceMm: 0.1,
    },
  };
}

function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  bytes.set([0, 0, 0, 13, 73, 72, 68, 82], 8);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  bytes[24] = 8;
  bytes[25] = 6;
  return bytes;
}

describe("raster source safeguards", () => {
  it("inspects bounded PNG and JPEG dimensions before decode", () => {
    expect(inspectRasterSource(pngHeader(640, 480), "png")).toMatchObject({
      format: "png",
      widthPx: 640,
      heightPx: 480,
      decodedBytes: 1_228_800,
    });
    const jpeg = new Uint8Array([
      0xff, 0xd8,
      0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0xe0, 0x02, 0x80,
      0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
      0xff, 0xd9,
    ]);
    expect(inspectRasterSource(jpeg, "jpeg")).toMatchObject({
      format: "jpeg",
      widthPx: 640,
      heightPx: 480,
    });
  });

  it("rejects type confusion, animation, and decoded pixel bombs", () => {
    expect(() => inspectRasterSource(pngHeader(640, 480), "jpeg")).toThrow(/extension/u);
    expect(() => inspectRasterSource(pngHeader(5_000, 5_000), "png")).toThrow(/pixel memory/u);
    const animated = new Uint8Array(53);
    animated.set(pngHeader(8, 8));
    animated.set([0, 0, 0, 8, 97, 99, 84, 76], 33);
    expect(() => inspectRasterSource(animated, "png")).toThrow(/Animated PNG/u);
  });
});

describe("deterministic raster trace engine", () => {
  it("traces a clean logo into editable millimeter paths deterministically", () => {
    const input = request(
      rasterFromRows([
        "........",
        "........",
        "..####..",
        "..####..",
        "..####..",
        "..####..",
        "........",
        "........",
      ]),
    );
    const first = runRasterTraceTask(input);
    const second = runRasterTraceTask({
      ...input,
      image: { ...input.image, rgba: input.image.rgba.slice() },
    });
    expect(first.candidate).toEqual(second.candidate);
    expect(first.candidate.paths).toEqual([
      {
        layerName: "Raster Trace",
        closed: true,
        points: [
          { xMm: 20, yMm: 60 },
          { xMm: 60, yMm: 60 },
          { xMm: 60, yMm: 20 },
          { xMm: 20, yMm: 20 },
        ],
      },
    ]);
    expect(first.candidate.summary).toMatchObject({
      pathCount: 1,
      nodeCount: 4,
      outputWidthMm: 80,
      outputHeightMm: 80,
    });
  });

  it("reports exactly which sub-threshold foreground islands were removed", () => {
    const input = request(
      rasterFromRows([
        "..........",
        ".#........",
        "..........",
        "...####...",
        "...####...",
        "...####...",
        "...####...",
        "..........",
        "..........",
        "..........",
      ]),
    );
    input.settings.speckleAreaPx = 2;
    const result = runRasterTraceTask(input);
    expect(result.candidate.summary).toMatchObject({
      removedSpeckleCount: 1,
      removedSpeckleAreaPx: 1,
      speckleThresholdPx: 2,
      pathCount: 1,
    });
    expect(result.candidate.warnings.map((warning) => warning.code)).toContain(
      "raster-speckles-removed",
    );
  });

  it("keeps simplification inside the selected millimeter deviation", () => {
    const source = Array.from({ length: 80 }, (_unused, index) => {
      const angle = index / 80 * Math.PI * 2;
      return {
        xMm: Math.cos(angle) * (20 + Math.sin(angle * 7) * 0.2),
        yMm: Math.sin(angle) * (20 + Math.sin(angle * 7) * 0.2),
      };
    });
    const simplified = source.filter((_point, index) => index % 4 === 0);
    expect(maximumClosedPathDeviation(source, simplified)).toBeLessThan(0.5);
  });

  it("records a gross performance bound for a representative noisy raster", () => {
    const widthPx = 512;
    const heightPx = 512;
    const rgba = new Uint8Array(widthPx * heightPx * 4);
    for (let y = 0; y < heightPx; y += 1) {
      for (let x = 0; x < widthPx; x += 1) {
        const offset = (y * widthPx + x) * 4;
        const logo = x > 70 && x < 442 && y > 70 && y < 442;
        const isolatedNoise = !logo && (x * 17 + y * 31) % 997 === 0;
        const foreground = logo || isolatedNoise;
        const value = foreground ? 40 : 235;
        rgba[offset] = value;
        rgba[offset + 1] = value;
        rgba[offset + 2] = value;
        rgba[offset + 3] = 255;
      }
    }
    const input = request({ widthPx, heightPx, rgba });
    input.settings.speckleAreaPx = 8;
    input.settings.simplificationToleranceMm = 0.25;
    const startedAt = performance.now();
    const result = runRasterTraceTask(input);
    const durationMs = performance.now() - startedAt;
    console.info("M07 raster performance", JSON.stringify({ durationMs }));
    expect(result.candidate.summary.pathCount).toBeGreaterThan(0);
    expect(durationMs).toBeLessThan(5_000);
  });
});
