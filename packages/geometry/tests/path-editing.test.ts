import { describe, expect, it } from "vitest";

import {
  addNodeToPathSegment,
  cleanupEditablePath,
  evaluatePathSegment,
  findPathSelfIntersections,
  joinEditablePaths,
  movePathNodes,
  reverseEditablePath,
  setPathNodeHandle,
  simplifyEditablePath,
  splitOpenPathAtNode,
  type EditablePathGeometry,
  type PointMm,
} from "../src/index.js";

function maximumDistanceToPolyline(
  samples: readonly PointMm[],
  simplified: readonly PointMm[],
): number {
  const distance = (point: PointMm, start: PointMm, end: PointMm): number => {
    const dx = end.xMm - start.xMm;
    const dy = end.yMm - start.yMm;
    const lengthSquared = dx * dx + dy * dy;
    const ratio =
      lengthSquared === 0
        ? 0
        : Math.max(
            0,
            Math.min(
              1,
              ((point.xMm - start.xMm) * dx +
                (point.yMm - start.yMm) * dy) /
                lengthSquared,
            ),
          );
    return Math.hypot(
      point.xMm - (start.xMm + ratio * dx),
      point.yMm - (start.yMm + ratio * dy),
    );
  };
  return Math.max(
    ...samples.map((sample) =>
      Math.min(
        ...simplified.slice(1).map((end, index) =>
          distance(sample, simplified[index] as PointMm, end),
        ),
      ),
    ),
  );
}

function samplePathSegments(path: EditablePathGeometry): PointMm[][] {
  const segmentCount = path.closed ? path.points.length : path.points.length - 1;
  return Array.from({ length: segmentCount }, (_unused, segmentIndex) =>
    [0.25, 0.5, 0.75].map((ratio) =>
      evaluatePathSegment(path, segmentIndex, ratio),
    ),
  );
}

describe("editable path geometry", () => {
  it("splits cubic segments without changing their evaluated shape", () => {
    const curved: EditablePathGeometry = {
      closed: false,
      points: [
        { xMm: 0, yMm: 0 },
        { xMm: 12, yMm: 0 },
      ],
      handles: [
        { incoming: null, outgoing: { xMm: 3, yMm: 8 } },
        { incoming: { xMm: 9, yMm: 8 }, outgoing: null },
      ],
    };
    const midpoint = evaluatePathSegment(curved, 0, 0.5);
    const split = addNodeToPathSegment(curved, 0, 0.5);
    expect(split.insertedNodeIndex).toBe(1);
    expect(split.path.points[1]).toEqual(midpoint);
    expect(evaluatePathSegment(split.path, 0, 1)).toEqual(midpoint);
    expect(evaluatePathSegment(split.path, 1, 0)).toEqual(midpoint);
  });

  it("moves anchors with their handles and reverses handle direction", () => {
    const source = setPathNodeHandle(
      {
        closed: false,
        points: [
          { xMm: 0, yMm: 0 },
          { xMm: 10, yMm: 0 },
        ],
      },
      0,
      "outgoing",
      { xMm: 2, yMm: 3 },
    );
    const moved = movePathNodes(source, [0], { xMm: 5, yMm: -2 });
    expect(moved.points[0]).toEqual({ xMm: 5, yMm: -2 });
    expect(moved.handles?.[0]?.outgoing).toEqual({ xMm: 7, yMm: 1 });
    const reversed = reverseEditablePath(moved);
    expect(reversed.handles?.at(-1)?.incoming).toEqual({ xMm: 7, yMm: 1 });
  });

  it("joins only endpoints within tolerance and reports the preview distance", () => {
    const first = {
      closed: false,
      points: [
        { xMm: 0, yMm: 0 },
        { xMm: 10, yMm: 0 },
      ],
    } satisfies EditablePathGeometry;
    const second = {
      closed: false,
      points: [
        { xMm: 10.05, yMm: 0 },
        { xMm: 20, yMm: 0 },
      ],
    } satisfies EditablePathGeometry;
    expect(joinEditablePaths(first, "end", second, "start", 0.1).points).toEqual([
      { xMm: 0, yMm: 0 },
      { xMm: 10.025, yMm: 0 },
      { xMm: 20, yMm: 0 },
    ]);
    expect(() =>
      joinEditablePaths(first, "end", second, "start", 0.01),
    ).toThrow(/outside/);
  });

  it("translates adjacent cubic controls with joined endpoint anchors", () => {
    const first = {
      closed: false,
      points: [
        { xMm: 0, yMm: 0 },
        { xMm: 10, yMm: 0 },
      ],
      handles: [
        { incoming: null, outgoing: { xMm: 2, yMm: 4 } },
        { incoming: { xMm: 8, yMm: 3 }, outgoing: null },
      ],
    } satisfies EditablePathGeometry;
    const second = {
      closed: false,
      points: [
        { xMm: 10.1, yMm: 0 },
        { xMm: 20, yMm: 0 },
      ],
      handles: [
        { incoming: null, outgoing: { xMm: 12.1, yMm: -3 } },
        { incoming: { xMm: 18, yMm: -3 }, outgoing: null },
      ],
    } satisfies EditablePathGeometry;

    const joined = joinEditablePaths(first, "end", second, "start", 0.2);
    const anchor = joined.points[1] as PointMm;
    const handles = joined.handles?.[1];
    expect(anchor).toEqual({ xMm: 10.05, yMm: 0 });
    expect((handles?.incoming?.xMm ?? 0) - anchor.xMm).toBeCloseTo(-2, 12);
    expect((handles?.incoming?.yMm ?? 0) - anchor.yMm).toBeCloseTo(3, 12);
    expect((handles?.outgoing?.xMm ?? 0) - anchor.xMm).toBeCloseTo(2, 12);
    expect((handles?.outgoing?.yMm ?? 0) - anchor.yMm).toBeCloseTo(-3, 12);
  });

  it("splits an open path while preserving the original split point", () => {
    const [first, second] = splitOpenPathAtNode(
      {
        closed: false,
        points: [
          { xMm: 0, yMm: 0 },
          { xMm: 5, yMm: 4 },
          { xMm: 10, yMm: 0 },
        ],
      },
      1,
    );
    expect(first.points.at(-1)).toEqual(second.points[0]);
    expect(first.points).toHaveLength(2);
    expect(second.points).toHaveLength(2);
  });

  it("simplifies within the selected maximum deviation", () => {
    const samples = Array.from({ length: 101 }, (_unused, index) => ({
      xMm: index / 10,
      yMm: Math.sin(index / 10) * 0.08,
    }));
    const toleranceMm = 0.1;
    const simplified = simplifyEditablePath(
      { closed: false, points: samples },
      toleranceMm,
    );
    expect(simplified.points.length).toBeLessThan(samples.length);
    expect(maximumDistanceToPolyline(samples, simplified.points)).toBeLessThanOrEqual(
      toleranceMm,
    );
  });

  it("cleans duplicates and collinear nodes without hiding self-intersections", () => {
    const result = cleanupEditablePath(
      {
        closed: true,
        points: [
          { xMm: 0, yMm: 0 },
          { xMm: 5, yMm: 5 },
          { xMm: 5, yMm: 5 },
          { xMm: 0, yMm: 5 },
          { xMm: 5, yMm: 0 },
        ],
      },
      0.001,
    );
    expect(result.removedNodeCount).toBe(1);
    expect(result.intersections).toHaveLength(1);
    expect(result.warnings.join(" ")).toMatch(/self-intersection/);
    expect(findPathSelfIntersections(result.path)).toEqual(result.intersections);
  });

  it("retains a handle-free collinear anchor between curved segments", () => {
    const source = {
      closed: false,
      points: [
        { xMm: 0, yMm: 0 },
        { xMm: 10, yMm: 0 },
        { xMm: 20, yMm: 0 },
      ],
      handles: [
        { incoming: null, outgoing: { xMm: 3, yMm: 9 } },
        { incoming: null, outgoing: null },
        { incoming: { xMm: 17, yMm: -9 }, outgoing: null },
      ],
    } satisfies EditablePathGeometry;
    const samples = samplePathSegments(source);

    const result = cleanupEditablePath(source, 0.001);

    expect(result.removedNodeCount).toBe(0);
    expect(result.path).toEqual(source);
    expect(samplePathSegments(result.path)).toEqual(samples);
  });

  it("retains handled near-duplicate anchors and their curve transition", () => {
    const source = {
      closed: false,
      points: [
        { xMm: 0, yMm: 0 },
        { xMm: 10, yMm: 0 },
        { xMm: 10.0005, yMm: 0 },
        { xMm: 20, yMm: 0 },
      ],
      handles: [
        { incoming: null, outgoing: null },
        { incoming: null, outgoing: { xMm: 10, yMm: 5 } },
        {
          incoming: { xMm: 10.0005, yMm: -5 },
          outgoing: { xMm: 14, yMm: -4 },
        },
        { incoming: { xMm: 17, yMm: -4 }, outgoing: null },
      ],
    } satisfies EditablePathGeometry;
    const samples = samplePathSegments(source);

    const result = cleanupEditablePath(source, 0.001);

    expect(result.removedNodeCount).toBe(0);
    expect(result.path).toEqual(source);
    expect(samplePathSegments(result.path)).toEqual(samples);
  });

  it("keeps a short-segment node beyond the cleanup distance in millimeters", () => {
    const result = cleanupEditablePath(
      {
        closed: false,
        points: [
          { xMm: 0, yMm: 0 },
          { xMm: 0.05, yMm: 0.02 },
          { xMm: 0.1, yMm: 0 },
        ],
      },
      0.01,
    );
    expect(result.removedNodeCount).toBe(0);
    expect(result.path.points).toHaveLength(3);
  });

  it("reports a long-segment intersection outside the endpoint distance", () => {
    const intersections = findPathSelfIntersections(
      {
        closed: false,
        points: [
          { xMm: 0, yMm: 0 },
          { xMm: 100, yMm: 0 },
          { xMm: 100, yMm: 10 },
          { xMm: 0.5, yMm: 10 },
          { xMm: 0.5, yMm: -10 },
        ],
      },
      0.01,
    );
    expect(intersections).toEqual([
      {
        firstSegmentIndex: 0,
        secondSegmentIndex: 3,
        point: { xMm: 0.5, yMm: 0 },
      },
    ]);
  });
});
