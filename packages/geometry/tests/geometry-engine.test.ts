import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  Clipper2GeometryEngine,
  type BooleanOperation,
  type EngineContour,
  type OffsetJoin,
} from "../src/index.js";

interface GoldenCase {
  name: string;
  request:
    | { kind: "boolean"; operation: BooleanOperation }
    | { kind: "offset"; distanceMm: number; join: OffsetJoin };
  contours: Array<Array<[number, number]>>;
  expected: Array<Array<[number, number]>>;
}

const fixture = JSON.parse(
  readFileSync(
    new URL("../../../fixtures/geometry/m05-boolean-offset-goldens.json", import.meta.url),
    "utf8",
  ),
) as { cases: GoldenCase[] };

function contours(value: GoldenCase["contours"]): EngineContour[] {
  return value.map((points) => ({
    closed: true,
    points: points.map(([xMm, yMm]) => ({ xMm, yMm })),
  }));
}

function tuples(value: readonly EngineContour[]): GoldenCase["expected"] {
  return value.map((contour) =>
    contour.points.map((point) => [point.xMm, point.yMm]),
  );
}

describe("Clipper2 geometry engine adapter", () => {
  const engine = new Clipper2GeometryEngine();

  for (const golden of fixture.cases) {
    it(golden.name, () => {
      const input = contours(golden.contours);
      const result =
        golden.request.kind === "boolean"
          ? engine.boolean(golden.request.operation, input)
          : engine.offset(
              input,
              golden.request.distanceMm,
              golden.request.join,
            );
      expect(tuples(result.contours)).toEqual(golden.expected);
      expect(result.warnings).toEqual([]);
    });
  }

  it("exposes pinned, replaceable engine metadata", () => {
    expect(engine.metadata).toEqual({
      adapter: "laserx-geometry-engine-v1",
      engine: "clipper2-ts",
      version: "2.0.1-18",
      license: "BSL-1.0",
      coordinateScalePerMm: 1_000_000,
    });
  });
});
