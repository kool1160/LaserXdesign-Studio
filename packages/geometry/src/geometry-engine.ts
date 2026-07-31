import {
  EndType,
  FillRule,
  JoinType,
  difference,
  inflatePaths,
  intersect,
  trimCollinear,
  union,
  xor,
  type Path64,
  type Paths64,
} from "clipper2-ts";

import type { PointMm } from "./index.js";

export const GEOMETRY_ENGINE_SCALE_PER_MM = 1_000_000;
export const GEOMETRY_ENGINE_TOLERANCE_MM = 1 / GEOMETRY_ENGINE_SCALE_PER_MM;
export const GEOMETRY_ENGINE_MAX_ABS_MM =
  Number.MAX_SAFE_INTEGER / GEOMETRY_ENGINE_SCALE_PER_MM;

export type BooleanOperation = "union" | "subtract" | "intersect" | "xor";
export type OffsetJoin = "miter" | "round" | "square";

export interface EngineContour {
  closed: boolean;
  points: PointMm[];
}

export interface GeometryEngineResult {
  contours: EngineContour[];
  warnings: string[];
}

export interface GeometryEngineMetadata {
  adapter: string;
  engine: string;
  version: string;
  license: string;
  coordinateScalePerMm: number;
}

export interface GeometryEngine {
  readonly metadata: GeometryEngineMetadata;
  boolean(
    operation: BooleanOperation,
    contours: readonly EngineContour[],
  ): GeometryEngineResult;
  offset(
    contours: readonly EngineContour[],
    distanceMm: number,
    join: OffsetJoin,
  ): GeometryEngineResult;
}

function assertClosedContours(contours: readonly EngineContour[]): void {
  if (contours.length === 0) {
    throw new RangeError("Geometry operations require at least one contour.");
  }
  for (const contour of contours) {
    if (!contour.closed || contour.points.length < 3) {
      throw new RangeError("Boolean and offset operations require closed contours.");
    }
  }
}

function toEngineCoordinate(valueMm: number): number {
  if (!Number.isFinite(valueMm) || Math.abs(valueMm) > GEOMETRY_ENGINE_MAX_ABS_MM) {
    throw new RangeError("Geometry coordinate is outside the supported finite range.");
  }
  return Math.round(valueMm * GEOMETRY_ENGINE_SCALE_PER_MM);
}

function toPaths(contours: readonly EngineContour[]): Paths64 {
  return contours.map((contour) =>
    contour.points.map((point) => ({
      x: toEngineCoordinate(point.xMm),
      y: toEngineCoordinate(point.yMm),
    })),
  );
}

function comparePoints(first: PointMm, second: PointMm): number {
  return first.xMm - second.xMm || first.yMm - second.yMm;
}

function canonicalizePath(path: Path64): EngineContour | null {
  const points = trimCollinear(path, false).map((point) => ({
    xMm: point.x / GEOMETRY_ENGINE_SCALE_PER_MM,
    yMm: point.y / GEOMETRY_ENGINE_SCALE_PER_MM,
  }));
  if (points.length < 3) {
    return null;
  }
  let firstIndex = 0;
  for (let index = 1; index < points.length; index += 1) {
    if (comparePoints(points[index] as PointMm, points[firstIndex] as PointMm) < 0) {
      firstIndex = index;
    }
  }
  return {
    closed: true,
    points: [...points.slice(firstIndex), ...points.slice(0, firstIndex)],
  };
}

function contourArea(contour: EngineContour): number {
  return contour.points.reduce((sum, point, index) => {
    const next = contour.points[(index + 1) % contour.points.length] as PointMm;
    return sum + point.xMm * next.yMm - next.xMm * point.yMm;
  }, 0) / 2;
}

function normalizeResult(paths: Paths64): GeometryEngineResult {
  const contours = paths
    .map(canonicalizePath)
    .filter((contour): contour is EngineContour => contour !== null)
    .sort((first, second) => {
      const firstPoint = first.points[0] as PointMm;
      const secondPoint = second.points[0] as PointMm;
      return (
        comparePoints(firstPoint, secondPoint) ||
        Math.abs(contourArea(second)) - Math.abs(contourArea(first)) ||
        first.points.length - second.points.length
      );
    });
  return {
    contours,
    warnings:
      contours.length === 0
        ? ["The operation produced no closed contours."]
        : [],
  };
}

function booleanPaths(
  operation: BooleanOperation,
  paths: Paths64,
): Paths64 {
  const first = paths[0];
  if (first === undefined) {
    return [];
  }
  if (operation === "union") {
    return union(paths, FillRule.NonZero);
  }
  if (paths.length < 2) {
    throw new RangeError(`${operation} requires at least two contours.`);
  }
  const rest = paths.slice(1);
  if (operation === "subtract") {
    return difference([first], union(rest, FillRule.NonZero), FillRule.NonZero);
  }
  return rest.reduce<Paths64>(
    (current, path) =>
      operation === "intersect"
        ? intersect(current, [path], FillRule.NonZero)
        : xor(current, [path], FillRule.NonZero),
    [first],
  );
}

export class Clipper2GeometryEngine implements GeometryEngine {
  public readonly metadata: GeometryEngineMetadata = {
    adapter: "laserx-geometry-engine-v1",
    engine: "clipper2-ts",
    version: "2.0.1-18",
    license: "BSL-1.0",
    coordinateScalePerMm: GEOMETRY_ENGINE_SCALE_PER_MM,
  };

  public boolean(
    operation: BooleanOperation,
    contours: readonly EngineContour[],
  ): GeometryEngineResult {
    assertClosedContours(contours);
    return normalizeResult(booleanPaths(operation, toPaths(contours)));
  }

  public offset(
    contours: readonly EngineContour[],
    distanceMm: number,
    join: OffsetJoin,
  ): GeometryEngineResult {
    assertClosedContours(contours);
    if (!Number.isFinite(distanceMm) || distanceMm === 0) {
      throw new RangeError("Offset distance must be finite and nonzero.");
    }
    const joinType =
      join === "round"
        ? JoinType.Round
        : join === "square"
          ? JoinType.Square
          : JoinType.Miter;
    return normalizeResult(
      inflatePaths(
        toPaths(contours),
        toEngineCoordinate(distanceMm),
        joinType,
        EndType.Polygon,
        2,
        Math.max(1, toEngineCoordinate(0.002)),
      ),
    );
  }
}

export const defaultGeometryEngine: GeometryEngine =
  new Clipper2GeometryEngine();
