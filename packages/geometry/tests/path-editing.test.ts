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
});
