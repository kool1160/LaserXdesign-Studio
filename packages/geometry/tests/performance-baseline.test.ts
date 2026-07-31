import { performance } from "node:perf_hooks";

import { describe, expect, it } from "vitest";

import {
  Clipper2GeometryEngine,
  type EngineContour,
} from "../src/index.js";

const SAMPLE_COUNT = 7;
const GROSS_REGRESSION_LIMIT_MS = 5_000;

function rectangleGrid(): EngineContour[] {
  return Array.from({ length: 400 }, (_, index) => {
    const column = index % 20;
    const row = Math.floor(index / 20);
    const xMm = column;
    const yMm = row;
    return {
      closed: true,
      points: [
        { xMm, yMm },
        { xMm: xMm + 1.2, yMm },
        { xMm: xMm + 1.2, yMm: yMm + 1.2 },
        { xMm, yMm: yMm + 1.2 },
      ],
    };
  });
}

function radialContour(nodeCount: number): EngineContour {
  return {
    closed: true,
    points: Array.from({ length: nodeCount }, (_, index) => {
      const radians = (index / nodeCount) * Math.PI * 2;
      const radiusMm = 100 + Math.sin(radians * 17) * 4;
      return {
        xMm: Math.cos(radians) * radiusMm,
        yMm: Math.sin(radians) * radiusMm,
      };
    }),
  };
}

function sample(operation: () => number): { medianMs: number; maxMs: number } {
  operation();
  const durations = Array.from({ length: SAMPLE_COUNT }, () => {
    const startedAt = performance.now();
    expect(operation()).toBeGreaterThan(0);
    return performance.now() - startedAt;
  }).sort((first, second) => first - second);
  return {
    medianMs: durations[Math.floor(durations.length / 2)] as number,
    maxMs: durations.at(-1) as number,
  };
}

describe("M05 geometry performance baseline", () => {
  it("records representative boolean and high-node offset timings", () => {
    const engine = new Clipper2GeometryEngine();
    const unionInput = rectangleGrid();
    const offsetInput = radialContour(4_096);
    const union = sample(
      () => engine.boolean("union", unionInput).contours.length,
    );
    const offset = sample(
      () => engine.offset([offsetInput], 2, "round").contours.length,
    );

    console.info(
      "M05 geometry performance",
      JSON.stringify({
        sampleCount: SAMPLE_COUNT,
        union400Rectangles: union,
        offset4096Nodes: offset,
      }),
    );
    expect(union.maxMs).toBeLessThan(GROSS_REGRESSION_LIMIT_MS);
    expect(offset.maxMs).toBeLessThan(GROSS_REGRESSION_LIMIT_MS);
  });
});
