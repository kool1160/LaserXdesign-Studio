import { describe, expect, it } from "vitest";

import {
  COORDINATE_TOLERANCE_MM,
  IDENTITY_AFFINE_TRANSFORM,
  applyAffineTransform,
  composeAffineTransforms,
  invertAffineTransform,
  pointInPolygon,
  pointInCompoundPolygonEvenOdd,
  pointInCompoundPolygonUnionEvenOdd,
  rotationTransformAt,
  scaleTransformAt,
  transformBounds,
  translationTransform,
} from "../src/index.js";

describe("affine transforms", () => {
  it("composes parent and child transforms in Cartesian millimeters", () => {
    const transform = composeAffineTransforms(
      translationTransform(10, 20),
      rotationTransformAt(90, { xMm: 0, yMm: 0 }),
    );
    expect(applyAffineTransform({ xMm: 5, yMm: 0 }, transform)).toEqual({
      xMm: 10,
      yMm: 25,
    });
  });

  it("scales around an explicit pivot without moving that pivot", () => {
    const pivot = { xMm: 25, yMm: 40 };
    const transform = scaleTransformAt(2, 0.5, pivot);
    expect(applyAffineTransform(pivot, transform)).toEqual(pivot);
  });

  it("transforms all four bounds corners for rotation and mirror", () => {
    const bounds = { minXmm: 0, minYmm: 0, maxXmm: 20, maxYmm: 10 };
    expect(
      transformBounds(
        bounds,
        rotationTransformAt(90, { xMm: 10, yMm: 5 }),
      ),
    ).toEqual({
      minXmm: 5,
      minYmm: -5,
      maxXmm: 15,
      maxYmm: 15,
    });
  });

  it("keeps repeated inverse transforms within coordinate tolerance", () => {
    let transform = { ...IDENTITY_AFFINE_TRANSFORM };
    for (let index = 0; index < 100; index += 1) {
      transform = composeAffineTransforms(
        rotationTransformAt(3.6, { xMm: 50, yMm: 50 }),
        transform,
      );
    }
    const point = applyAffineTransform({ xMm: 75, yMm: 25 }, transform);
    expect(Math.abs(point.xMm - 75)).toBeLessThanOrEqual(
      COORDINATE_TOLERANCE_MM,
    );
    expect(Math.abs(point.yMm - 25)).toBeLessThanOrEqual(
      COORDINATE_TOLERANCE_MM,
    );
  });

  it("inverts affine transforms and rejects singular matrices", () => {
    const transform = composeAffineTransforms(
      translationTransform(20, -5),
      rotationTransformAt(37, { xMm: 4, yMm: 8 }),
    );
    const point = { xMm: 12, yMm: 16 };
    const world = applyAffineTransform(point, transform);
    const roundTrip = applyAffineTransform(
      world,
      invertAffineTransform(transform),
    );
    expect(roundTrip.xMm).toBeCloseTo(point.xMm, 9);
    expect(roundTrip.yMm).toBeCloseTo(point.yMm, 9);
    expect(() =>
      invertAffineTransform({
        a: 1,
        b: 0,
        c: 1,
        d: 0,
        eMm: 0,
        fMm: 0,
      }),
    ).toThrow("invertible");
  });

  it("tests polygon interiors without treating the full bounds as filled", () => {
    const triangle = [
      { xMm: 0, yMm: 0 },
      { xMm: 10, yMm: 0 },
      { xMm: 0, yMm: 10 },
    ];
    expect(pointInPolygon({ xMm: 2, yMm: 2 }, triangle)).toBe(true);
    expect(pointInPolygon({ xMm: 8, yMm: 8 }, triangle)).toBe(false);
  });

  it("applies even-odd compound fill semantics to enclosed counters", () => {
    const outer = [
      { xMm: 0, yMm: 0 },
      { xMm: 10, yMm: 0 },
      { xMm: 10, yMm: 10 },
      { xMm: 0, yMm: 10 },
    ];
    const counter = [
      { xMm: 3, yMm: 3 },
      { xMm: 7, yMm: 3 },
      { xMm: 7, yMm: 7 },
      { xMm: 3, yMm: 7 },
    ];
    expect(
      pointInCompoundPolygonEvenOdd({ xMm: 1, yMm: 5 }, [outer, counter]),
    ).toBe(true);
    expect(
      pointInCompoundPolygonEvenOdd({ xMm: 5, yMm: 5 }, [outer, counter]),
    ).toBe(false);
  });

  it("unions glyph compounds without XORing their overlap", () => {
    const outer = [
      { xMm: 0, yMm: 0 },
      { xMm: 10, yMm: 0 },
      { xMm: 10, yMm: 10 },
      { xMm: 0, yMm: 10 },
    ];
    const counter = [
      { xMm: 3, yMm: 3 },
      { xMm: 7, yMm: 3 },
      { xMm: 7, yMm: 7 },
      { xMm: 3, yMm: 7 },
    ];
    const overlappingGlyph = [
      { xMm: 8, yMm: 0 },
      { xMm: 14, yMm: 0 },
      { xMm: 14, yMm: 10 },
      { xMm: 8, yMm: 10 },
    ];
    const compounds = [[outer, counter], [overlappingGlyph]];
    expect(
      pointInCompoundPolygonUnionEvenOdd({ xMm: 5, yMm: 5 }, compounds),
    ).toBe(false);
    expect(
      pointInCompoundPolygonUnionEvenOdd({ xMm: 9, yMm: 5 }, compounds),
    ).toBe(true);
  });
});
