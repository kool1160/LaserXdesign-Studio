import {
  createBlankProject,
  flattenDocumentForInterchange,
  type DocumentObject,
} from "../src/index.js";
import {
  applyAffineTransform,
  composeAffineTransforms,
  distancePointToSegment,
  evaluatePathSegment,
  type AffineTransformMm,
  type EditablePathGeometry,
  type PointMm,
} from "@laserx/geometry";
import { describe, expect, it } from "vitest";

const INTERCHANGE_TOLERANCE_MM = 0.01;
const CURVE: EditablePathGeometry = {
  closed: false,
  points: [
    { xMm: 0, yMm: 0 },
    { xMm: 100, yMm: 0 },
  ],
  handles: [
    { incoming: null, outgoing: { xMm: 0, yMm: 80 } },
    { incoming: { xMm: 100, yMm: 80 }, outgoing: null },
  ],
};

function distanceToPolyline(
  point: PointMm,
  points: readonly PointMm[],
  closed: boolean,
): number {
  const segmentCount = closed ? points.length : points.length - 1;
  let minimum = Number.POSITIVE_INFINITY;
  for (let index = 0; index < segmentCount; index += 1) {
    minimum = Math.min(
      minimum,
      distancePointToSegment(
        point,
        points[index] as PointMm,
        points[(index + 1) % points.length] as PointMm,
      ),
    );
  }
  return minimum;
}

function expectCubicWorldTolerance(
  transform: AffineTransformMm,
  flattened: readonly PointMm[],
): PointMm[] {
  const samples = Array.from({ length: 2_001 }, (_unused, index) =>
    applyAffineTransform(evaluatePathSegment(CURVE, 0, index / 2_000), transform),
  );
  const maximumDeviation = Math.max(
    ...samples.map((point) => distanceToPolyline(point, flattened, false)),
  );
  expect(maximumDeviation).toBeLessThanOrEqual(INTERCHANGE_TOLERANCE_MM + 1e-9);
  return samples;
}

function expectEllipseWorldTolerance(
  transform: AffineTransformMm,
  flattened: readonly PointMm[],
): PointMm[] {
  const center = { xMm: 50, yMm: 30 };
  const radiusXmm = 30;
  const radiusYmm = 12;
  const samples: PointMm[] = [];
  let maximumDeviation = 0;
  for (let segmentIndex = 0; segmentIndex < flattened.length; segmentIndex += 1) {
    const start = flattened[segmentIndex] as PointMm;
    const end = flattened[(segmentIndex + 1) % flattened.length] as PointMm;
    for (let sampleIndex = 0; sampleIndex <= 8; sampleIndex += 1) {
      const ratio = sampleIndex / 8;
      const angle =
        ((segmentIndex + ratio) / flattened.length) * Math.PI * 2;
      const point = applyAffineTransform(
        {
          xMm: center.xMm + Math.cos(angle) * radiusXmm,
          yMm: center.yMm + Math.sin(angle) * radiusYmm,
        },
        transform,
      );
      samples.push(point);
      maximumDeviation = Math.max(
        maximumDeviation,
        distancePointToSegment(point, start, end),
      );
    }
  }
  expect(maximumDeviation).toBeLessThanOrEqual(INTERCHANGE_TOLERANCE_MM + 1e-9);
  return samples;
}

function sampledBounds(points: readonly PointMm[]) {
  return points.reduce(
    (bounds, point) => ({
      minXmm: Math.min(bounds.minXmm, point.xMm),
      minYmm: Math.min(bounds.minYmm, point.yMm),
      maxXmm: Math.max(bounds.maxXmm, point.xMm),
      maxYmm: Math.max(bounds.maxYmm, point.yMm),
    }),
    {
      minXmm: Number.POSITIVE_INFINITY,
      minYmm: Number.POSITIVE_INFINITY,
      maxXmm: Number.NEGATIVE_INFINITY,
      maxYmm: Number.NEGATIVE_INFINITY,
    },
  );
}

describe("document interchange flattening", () => {
  it("normalizes nested transforms and reports hidden geometry", () => {
    const visibleLayerId = "00000000-0000-5000-8000-000000000001";
    const hiddenLayerId = "00000000-0000-5000-8000-000000000002";
    const project = createBlankProject({
      id: "00000000-0000-5000-8000-000000000003",
      now: "2026-07-31T00:00:00.000Z",
      layers: [
        { id: visibleLayerId, name: "Cut", visible: true, locked: false },
        { id: hiddenLayerId, name: "Notes", visible: false, locked: false },
      ],
      activeLayerId: visibleLayerId,
      objects: [
        {
          id: "00000000-0000-5000-8000-000000000004",
          type: "group",
          layerId: visibleLayerId,
          transform: { a: 1, b: 0, c: 0, d: 1, eMm: 10, fMm: 20 },
          children: [{
            id: "00000000-0000-5000-8000-000000000005",
            type: "line",
            layerId: visibleLayerId,
            transform: { a: 2, b: 0, c: 0, d: 2, eMm: 0, fMm: 0 },
            start: { xMm: 0, yMm: 0 },
            end: { xMm: 5, yMm: 10 },
          }],
        },
        {
          id: "00000000-0000-5000-8000-000000000006",
          type: "line",
          layerId: hiddenLayerId,
          transform: { a: 1, b: 0, c: 0, d: 1, eMm: 0, fMm: 0 },
          start: { xMm: 0, yMm: 0 },
          end: { xMm: 100, yMm: 100 },
        },
      ],
    });

    const result = flattenDocumentForInterchange(project.document);
    expect(result.paths).toEqual([{ layerName: "Cut", closed: false, points: [
      { xMm: 10, yMm: 20 },
      { xMm: 20, yMm: 40 },
    ] }]);
    expect(result.bounds).toEqual({ minXmm: 10, minYmm: 20, maxXmm: 20, maxYmm: 40 });
    expect(result.warnings).toMatchObject([{ code: "hidden-objects-skipped" }]);
  });

  it("rejects non-positive interchange tolerances", () => {
    const project = createBlankProject({
      id: "00000000-0000-5000-8000-000000000011",
      now: "2026-07-31T00:00:00.000Z",
    });
    expect(() => flattenDocumentForInterchange(project.document, 0)).toThrow(/positive/u);
  });

  it.each([
    {
      name: "large uniform scale",
      child: { a: 25, b: 0, c: 0, d: 25, eMm: 10, fMm: -20 },
    },
    {
      name: "nonuniform scale",
      child: { a: 40, b: 0, c: 0, d: 3, eMm: -15, fMm: 25 },
    },
    {
      name: "shear",
      child: { a: 1, b: 0.5, c: 18, d: 1, eMm: 5, fMm: 7 },
    },
    {
      name: "nested group transforms",
      parent: { a: 3, b: 1, c: 0.5, d: 2, eMm: 11, fMm: -9 },
      child: { a: 4, b: 0, c: 1, d: 5, eMm: 2, fMm: 6 },
    },
  ] as Array<{
    name: string;
    child: AffineTransformMm;
    parent?: AffineTransformMm;
  }>)("keeps cubic and ellipse export deviation in world millimeters under $name", ({ child, parent }) => {
    const layerId = "00000000-0000-5000-8000-000000000021";
    const path: DocumentObject = {
      id: "00000000-0000-5000-8000-000000000022",
      type: "path",
      layerId,
      transform: child,
      ...CURVE,
    };
    const ellipse: DocumentObject = {
      id: "00000000-0000-5000-8000-000000000023",
      type: "ellipse",
      layerId,
      transform: child,
      center: { xMm: 50, yMm: 30 },
      radiusXmm: 30,
      radiusYmm: 12,
    };
    const objects: DocumentObject[] = parent === undefined
      ? [path, ellipse]
      : [{
          id: "00000000-0000-5000-8000-000000000024",
          type: "group",
          layerId,
          transform: parent,
          children: [path, ellipse],
        }];
    const project = createBlankProject({
      id: "00000000-0000-5000-8000-000000000025",
      now: "2026-07-31T00:00:00.000Z",
      layers: [{ id: layerId, name: "Cut", visible: true, locked: false }],
      activeLayerId: layerId,
      objects,
    });

    const result = flattenDocumentForInterchange(
      project.document,
      INTERCHANGE_TOLERANCE_MM,
    );
    const worldTransform = parent === undefined
      ? child
      : composeAffineTransforms(parent, child);
    const cubicSamples = expectCubicWorldTolerance(
      worldTransform,
      result.paths[0]?.points ?? [],
    );
    const ellipseSamples = expectEllipseWorldTolerance(
      worldTransform,
      result.paths[1]?.points ?? [],
    );
    const expectedBounds = sampledBounds([...cubicSamples, ...ellipseSamples]);
    expect(result.bounds).not.toBeNull();
    expect(Math.abs((result.bounds?.minXmm ?? 0) - expectedBounds.minXmm))
      .toBeLessThanOrEqual(INTERCHANGE_TOLERANCE_MM);
    expect(Math.abs((result.bounds?.minYmm ?? 0) - expectedBounds.minYmm))
      .toBeLessThanOrEqual(INTERCHANGE_TOLERANCE_MM);
    expect(Math.abs((result.bounds?.maxXmm ?? 0) - expectedBounds.maxXmm))
      .toBeLessThanOrEqual(INTERCHANGE_TOLERANCE_MM);
    expect(Math.abs((result.bounds?.maxYmm ?? 0) - expectedBounds.maxYmm))
      .toBeLessThanOrEqual(INTERCHANGE_TOLERANCE_MM);
  });
});
