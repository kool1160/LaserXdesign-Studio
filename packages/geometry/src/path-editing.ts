import type { PointMm } from "./index.js";

export const PATH_EDIT_TOLERANCE_MM = 1e-6;
export const DEFAULT_CURVE_FLATTENING_TOLERANCE_MM = 0.01;

export interface PathControlHandles {
  incoming: PointMm | null;
  outgoing: PointMm | null;
}

export interface EditablePathGeometry {
  closed: boolean;
  points: PointMm[];
  handles?: PathControlHandles[] | undefined;
}

export interface FlattenedPathPoint extends PointMm {
  sourceSegmentIndex: number;
}

export interface PathIntersection {
  firstSegmentIndex: number;
  secondSegmentIndex: number;
  point: PointMm;
}

export interface PathCleanupResult {
  path: EditablePathGeometry;
  removedNodeCount: number;
  removedNodes: PathCleanupRemoval[];
  intersections: PathIntersection[];
  warnings: string[];
}

export type PathCleanupRemovalReason =
  | "zero-length"
  | "redundant-collinear";

export interface PathCleanupRemoval {
  sourceNodeIndex: number;
  reason: PathCleanupRemovalReason;
}

export interface PathCleanupOptions {
  allowedRemovals?: readonly PathCleanupRemoval[] | undefined;
}

function assertFinitePoint(point: PointMm, label: string): void {
  if (!Number.isFinite(point.xMm) || !Number.isFinite(point.yMm)) {
    throw new RangeError(`${label} must contain finite coordinates.`);
  }
}

function copyPoint(point: PointMm): PointMm {
  return { xMm: point.xMm, yMm: point.yMm };
}

function pointsEqual(
  first: PointMm,
  second: PointMm,
  toleranceMm = PATH_EDIT_TOLERANCE_MM,
): boolean {
  return (
    Math.abs(first.xMm - second.xMm) <= toleranceMm &&
    Math.abs(first.yMm - second.yMm) <= toleranceMm
  );
}

function lerp(first: PointMm, second: PointMm, ratio: number): PointMm {
  return {
    xMm: first.xMm + (second.xMm - first.xMm) * ratio,
    yMm: first.yMm + (second.yMm - first.yMm) * ratio,
  };
}

function distancePointToSegment(
  point: PointMm,
  start: PointMm,
  end: PointMm,
): number {
  const deltaX = end.xMm - start.xMm;
  const deltaY = end.yMm - start.yMm;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  if (lengthSquared === 0) {
    return Math.hypot(point.xMm - start.xMm, point.yMm - start.yMm);
  }
  const ratio = Math.max(
    0,
    Math.min(
      1,
      ((point.xMm - start.xMm) * deltaX +
        (point.yMm - start.yMm) * deltaY) /
        lengthSquared,
    ),
  );
  return Math.hypot(
    point.xMm - (start.xMm + ratio * deltaX),
    point.yMm - (start.yMm + ratio * deltaY),
  );
}

function copyHandles(
  handles: readonly PathControlHandles[] | undefined,
  pointCount: number,
): PathControlHandles[] {
  if (handles !== undefined && handles.length !== pointCount) {
    throw new RangeError("Path handles must align one-to-one with path nodes.");
  }
  return Array.from({ length: pointCount }, (_unused, index) => {
    const handle = handles?.[index];
    return {
      incoming:
        handle?.incoming === null || handle?.incoming === undefined
          ? null
          : copyPoint(handle.incoming),
      outgoing:
        handle?.outgoing === null || handle?.outgoing === undefined
          ? null
          : copyPoint(handle.outgoing),
    };
  });
}

function compactHandles(
  handles: readonly PathControlHandles[],
): PathControlHandles[] | undefined {
  return handles.some(
    (handle) => handle.incoming !== null || handle.outgoing !== null,
  )
    ? handles.map((handle) => ({
        incoming:
          handle.incoming === null ? null : copyPoint(handle.incoming),
        outgoing:
          handle.outgoing === null ? null : copyPoint(handle.outgoing),
      }))
    : undefined;
}

function handlesAreEmpty(handles: PathControlHandles): boolean {
  return handles.incoming === null && handles.outgoing === null;
}

export function copyEditablePath(
  path: EditablePathGeometry,
): EditablePathGeometry {
  validateEditablePath(path);
  const handles = copyHandles(path.handles, path.points.length);
  return {
    closed: path.closed,
    points: path.points.map(copyPoint),
    ...(compactHandles(handles) === undefined
      ? {}
      : { handles: compactHandles(handles) }),
  };
}

export function validateEditablePath(path: EditablePathGeometry): void {
  const minimum = path.closed ? 3 : 2;
  if (path.points.length < minimum) {
    throw new RangeError(
      `A ${path.closed ? "closed" : "open"} path requires at least ${String(minimum)} nodes.`,
    );
  }
  path.points.forEach((point, index) =>
    assertFinitePoint(point, `Path node ${String(index)}`),
  );
  const handles = copyHandles(path.handles, path.points.length);
  handles.forEach((handle, index) => {
    if (handle.incoming !== null) {
      assertFinitePoint(handle.incoming, `Incoming handle ${String(index)}`);
    }
    if (handle.outgoing !== null) {
      assertFinitePoint(handle.outgoing, `Outgoing handle ${String(index)}`);
    }
  });
}

export function pathSegmentCount(path: EditablePathGeometry): number {
  validateEditablePath(path);
  return path.closed ? path.points.length : path.points.length - 1;
}

function segmentNodes(
  path: EditablePathGeometry,
  segmentIndex: number,
): {
  startIndex: number;
  endIndex: number;
  start: PointMm;
  control1: PointMm;
  control2: PointMm;
  end: PointMm;
  curved: boolean;
} {
  const count = pathSegmentCount(path);
  if (!Number.isInteger(segmentIndex) || segmentIndex < 0 || segmentIndex >= count) {
    throw new RangeError("Path segment index is out of range.");
  }
  const startIndex = segmentIndex;
  const endIndex = (segmentIndex + 1) % path.points.length;
  const start = path.points[startIndex] as PointMm;
  const end = path.points[endIndex] as PointMm;
  const startHandles = path.handles?.[startIndex];
  const endHandles = path.handles?.[endIndex];
  return {
    startIndex,
    endIndex,
    start,
    control1: startHandles?.outgoing ?? start,
    control2: endHandles?.incoming ?? end,
    end,
    curved:
      startHandles?.outgoing !== null && startHandles?.outgoing !== undefined ||
      endHandles?.incoming !== null && endHandles?.incoming !== undefined,
  };
}

export function evaluatePathSegment(
  path: EditablePathGeometry,
  segmentIndex: number,
  ratio: number,
): PointMm {
  if (!Number.isFinite(ratio) || ratio < 0 || ratio > 1) {
    throw new RangeError("Path segment ratio must be between zero and one.");
  }
  const segment = segmentNodes(path, segmentIndex);
  if (!segment.curved) {
    return lerp(segment.start, segment.end, ratio);
  }
  const first = lerp(segment.start, segment.control1, ratio);
  const second = lerp(segment.control1, segment.control2, ratio);
  const third = lerp(segment.control2, segment.end, ratio);
  return lerp(lerp(first, second, ratio), lerp(second, third, ratio), ratio);
}

export function addNodeToPathSegment(
  source: EditablePathGeometry,
  segmentIndex: number,
  ratio = 0.5,
): { path: EditablePathGeometry; insertedNodeIndex: number } {
  if (!Number.isFinite(ratio) || ratio <= 0 || ratio >= 1) {
    throw new RangeError("Inserted node ratio must be strictly between zero and one.");
  }
  const path = copyEditablePath(source);
  const segment = segmentNodes(path, segmentIndex);
  const handles = copyHandles(path.handles, path.points.length);
  const first = lerp(segment.start, segment.control1, ratio);
  const second = lerp(segment.control1, segment.control2, ratio);
  const third = lerp(segment.control2, segment.end, ratio);
  const before = lerp(first, second, ratio);
  const after = lerp(second, third, ratio);
  const inserted = lerp(before, after, ratio);
  const insertedNodeIndex = segment.endIndex === 0 ? path.points.length : segment.endIndex;

  path.points.splice(insertedNodeIndex, 0, inserted);
  if (segment.curved) {
    handles[segment.startIndex] = {
      ...(handles[segment.startIndex] as PathControlHandles),
      outgoing: first,
    };
    handles[segment.endIndex] = {
      ...(handles[segment.endIndex] as PathControlHandles),
      incoming: third,
    };
    handles.splice(insertedNodeIndex, 0, {
      incoming: before,
      outgoing: after,
    });
  } else {
    handles.splice(insertedNodeIndex, 0, {
      incoming: null,
      outgoing: null,
    });
  }
  const compacted = compactHandles(handles);
  return {
    path: {
      ...path,
      ...(compacted === undefined ? { handles: undefined } : { handles: compacted }),
    },
    insertedNodeIndex,
  };
}

export function movePathNodes(
  source: EditablePathGeometry,
  nodeIndices: readonly number[],
  delta: PointMm,
): EditablePathGeometry {
  assertFinitePoint(delta, "Node movement");
  const path = copyEditablePath(source);
  const selected = new Set(nodeIndices);
  if (
    selected.size === 0 ||
    [...selected].some(
      (index) => !Number.isInteger(index) || index < 0 || index >= path.points.length,
    )
  ) {
    throw new RangeError("Selected path node indices are invalid.");
  }
  const handles = copyHandles(path.handles, path.points.length);
  for (const index of selected) {
    const point = path.points[index] as PointMm;
    path.points[index] = {
      xMm: point.xMm + delta.xMm,
      yMm: point.yMm + delta.yMm,
    };
    const handle = handles[index] as PathControlHandles;
    if (handle.incoming !== null) {
      handle.incoming = {
        xMm: handle.incoming.xMm + delta.xMm,
        yMm: handle.incoming.yMm + delta.yMm,
      };
    }
    if (handle.outgoing !== null) {
      handle.outgoing = {
        xMm: handle.outgoing.xMm + delta.xMm,
        yMm: handle.outgoing.yMm + delta.yMm,
      };
    }
  }
  const compacted = compactHandles(handles);
  return {
    ...path,
    ...(compacted === undefined ? { handles: undefined } : { handles: compacted }),
  };
}

export function setPathNodeHandle(
  source: EditablePathGeometry,
  nodeIndex: number,
  kind: "incoming" | "outgoing",
  point: PointMm | null,
): EditablePathGeometry {
  const path = copyEditablePath(source);
  if (!Number.isInteger(nodeIndex) || nodeIndex < 0 || nodeIndex >= path.points.length) {
    throw new RangeError("Path node index is out of range.");
  }
  if (point !== null) {
    assertFinitePoint(point, "Path handle");
  }
  const handles = copyHandles(path.handles, path.points.length);
  (handles[nodeIndex] as PathControlHandles)[kind] =
    point === null ? null : copyPoint(point);
  const compacted = compactHandles(handles);
  return {
    ...path,
    ...(compacted === undefined ? { handles: undefined } : { handles: compacted }),
  };
}

export function deletePathNodes(
  source: EditablePathGeometry,
  nodeIndices: readonly number[],
): EditablePathGeometry {
  const path = copyEditablePath(source);
  const selected = new Set(nodeIndices);
  if (
    selected.size === 0 ||
    [...selected].some(
      (index) => !Number.isInteger(index) || index < 0 || index >= path.points.length,
    )
  ) {
    throw new RangeError("Selected path node indices are invalid.");
  }
  const minimum = path.closed ? 3 : 2;
  if (path.points.length - selected.size < minimum) {
    throw new RangeError(
      `Deleting these nodes would leave fewer than ${String(minimum)} path nodes.`,
    );
  }
  const handles = copyHandles(path.handles, path.points.length);
  const points = path.points.filter((_point, index) => !selected.has(index));
  const nextHandles = handles.filter((_handle, index) => !selected.has(index));
  const compacted = compactHandles(nextHandles);
  return {
    closed: path.closed,
    points,
    ...(compacted === undefined ? {} : { handles: compacted }),
  };
}

export function reverseEditablePath(
  source: EditablePathGeometry,
): EditablePathGeometry {
  const path = copyEditablePath(source);
  const handles = copyHandles(path.handles, path.points.length)
    .reverse()
    .map((handle) => ({
      incoming: handle.outgoing === null ? null : copyPoint(handle.outgoing),
      outgoing: handle.incoming === null ? null : copyPoint(handle.incoming),
    }));
  const compacted = compactHandles(handles);
  return {
    closed: path.closed,
    points: path.points.reverse(),
    ...(compacted === undefined ? {} : { handles: compacted }),
  };
}

export function setEditablePathClosed(
  source: EditablePathGeometry,
  closed: boolean,
): EditablePathGeometry {
  const path = copyEditablePath(source);
  if (closed && path.points.length < 3) {
    throw new RangeError("Closing a path requires at least three nodes.");
  }
  return { ...path, closed };
}

function flattenCubic(
  start: PointMm,
  control1: PointMm,
  control2: PointMm,
  end: PointMm,
  toleranceMm: number,
  depth: number,
  emit: (point: PointMm) => void,
): void {
  const flatness = Math.max(
    distancePointToSegment(control1, start, end),
    distancePointToSegment(control2, start, end),
  );
  if (flatness <= toleranceMm || depth >= 20) {
    emit(copyPoint(end));
    return;
  }
  const first = lerp(start, control1, 0.5);
  const second = lerp(control1, control2, 0.5);
  const third = lerp(control2, end, 0.5);
  const before = lerp(first, second, 0.5);
  const after = lerp(second, third, 0.5);
  const middle = lerp(before, after, 0.5);
  flattenCubic(
    start,
    first,
    before,
    middle,
    toleranceMm,
    depth + 1,
    emit,
  );
  flattenCubic(
    middle,
    after,
    third,
    end,
    toleranceMm,
    depth + 1,
    emit,
  );
}

export function flattenEditablePath(
  source: EditablePathGeometry,
  toleranceMm = DEFAULT_CURVE_FLATTENING_TOLERANCE_MM,
): FlattenedPathPoint[] {
  if (!Number.isFinite(toleranceMm) || toleranceMm <= 0) {
    throw new RangeError("Curve flattening tolerance must be positive and finite.");
  }
  const path = copyEditablePath(source);
  const first = path.points[0] as PointMm;
  const flattened: FlattenedPathPoint[] = [
    { ...first, sourceSegmentIndex: 0 },
  ];
  for (let segmentIndex = 0; segmentIndex < pathSegmentCount(path); segmentIndex += 1) {
    const segment = segmentNodes(path, segmentIndex);
    const emitted: PointMm[] = [];
    if (segment.curved) {
      flattenCubic(
        segment.start,
        segment.control1,
        segment.control2,
        segment.end,
        toleranceMm,
        0,
        (point) => emitted.push(point),
      );
    } else {
      emitted.push(copyPoint(segment.end));
    }
    for (const point of emitted) {
      if (
        path.closed &&
        segmentIndex === pathSegmentCount(path) - 1 &&
        pointsEqual(point, first)
      ) {
        continue;
      }
      flattened.push({ ...point, sourceSegmentIndex: segmentIndex });
    }
  }
  return flattened;
}

function pointLineDistance(point: PointMm, start: PointMm, end: PointMm): number {
  return distancePointToSegment(point, start, end);
}

function simplifyOpenPoints(
  points: readonly PointMm[],
  toleranceMm: number,
): PointMm[] {
  if (points.length <= 2) {
    return points.map(copyPoint);
  }
  const start = points[0] as PointMm;
  const end = points.at(-1) as PointMm;
  let maximumDistance = -1;
  let maximumIndex = -1;
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = pointLineDistance(points[index] as PointMm, start, end);
    if (distance > maximumDistance) {
      maximumDistance = distance;
      maximumIndex = index;
    }
  }
  if (maximumDistance <= toleranceMm || maximumIndex < 0) {
    return [copyPoint(start), copyPoint(end)];
  }
  const left = simplifyOpenPoints(points.slice(0, maximumIndex + 1), toleranceMm);
  const right = simplifyOpenPoints(points.slice(maximumIndex), toleranceMm);
  return [...left.slice(0, -1), ...right];
}

export function simplifyEditablePath(
  source: EditablePathGeometry,
  toleranceMm: number,
): EditablePathGeometry {
  if (!Number.isFinite(toleranceMm) || toleranceMm <= 0) {
    throw new RangeError("Simplification tolerance must be positive and finite.");
  }
  const flattened = flattenEditablePath(source, toleranceMm / 2).map(
    (point) => ({ xMm: point.xMm, yMm: point.yMm }),
  );
  let points: PointMm[];
  if (source.closed) {
    const first = flattened[0] as PointMm;
    points = simplifyOpenPoints([...flattened, first], toleranceMm / 2).slice(0, -1);
    if (points.length < 3) {
      points = flattened.slice(0, 3).map(copyPoint);
    }
  } else {
    points = simplifyOpenPoints(flattened, toleranceMm / 2);
  }
  return { closed: source.closed, points };
}

function segmentIntersection(
  firstStart: PointMm,
  firstEnd: PointMm,
  secondStart: PointMm,
  secondEnd: PointMm,
  toleranceMm: number,
): PointMm | null {
  const firstDelta = {
    xMm: firstEnd.xMm - firstStart.xMm,
    yMm: firstEnd.yMm - firstStart.yMm,
  };
  const secondDelta = {
    xMm: secondEnd.xMm - secondStart.xMm,
    yMm: secondEnd.yMm - secondStart.yMm,
  };
  const denominator = firstDelta.xMm * secondDelta.yMm - firstDelta.yMm * secondDelta.xMm;
  if (Math.abs(denominator) <= toleranceMm * toleranceMm) {
    return null;
  }
  const difference = {
    xMm: secondStart.xMm - firstStart.xMm,
    yMm: secondStart.yMm - firstStart.yMm,
  };
  const firstRatio =
    (difference.xMm * secondDelta.yMm - difference.yMm * secondDelta.xMm) /
    denominator;
  const secondRatio =
    (difference.xMm * firstDelta.yMm - difference.yMm * firstDelta.xMm) /
    denominator;
  if (
    firstRatio < 0 ||
    firstRatio > 1 ||
    secondRatio < 0 ||
    secondRatio > 1
  ) {
    return null;
  }
  const point = {
    xMm: firstStart.xMm + firstRatio * firstDelta.xMm,
    yMm: firstStart.yMm + firstRatio * firstDelta.yMm,
  };
  if (
    [firstStart, firstEnd, secondStart, secondEnd].some(
      (endpoint) =>
        Math.hypot(point.xMm - endpoint.xMm, point.yMm - endpoint.yMm) <=
        toleranceMm,
    )
  ) {
    return null;
  }
  return point;
}

export function findPathSelfIntersections(
  source: EditablePathGeometry,
  toleranceMm = PATH_EDIT_TOLERANCE_MM,
): PathIntersection[] {
  const points = flattenEditablePath(source, Math.max(toleranceMm, 0.001));
  const segments = points
    .map((point, index) => {
      const end = points[(index + 1) % points.length] as FlattenedPathPoint;
      return {
        start: point,
        end,
        sourceSegmentIndex:
          source.closed && index === points.length - 1
            ? pathSegmentCount(source) - 1
            : end.sourceSegmentIndex,
      };
    })
    .slice(0, source.closed ? points.length : points.length - 1);
  const intersections: PathIntersection[] = [];
  for (let firstIndex = 0; firstIndex < segments.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < segments.length; secondIndex += 1) {
      const first = segments[firstIndex];
      const second = segments[secondIndex];
      if (
        first === undefined ||
        second === undefined ||
        first.sourceSegmentIndex === second.sourceSegmentIndex ||
        Math.abs(first.sourceSegmentIndex - second.sourceSegmentIndex) === 1 ||
        (source.closed &&
          new Set([first.sourceSegmentIndex, second.sourceSegmentIndex]).has(0) &&
          new Set([first.sourceSegmentIndex, second.sourceSegmentIndex]).has(
            pathSegmentCount(source) - 1,
          ))
      ) {
        continue;
      }
      const point = segmentIntersection(
        first.start,
        first.end,
        second.start,
        second.end,
        toleranceMm,
      );
      if (point !== null) {
        intersections.push({
          firstSegmentIndex: first.sourceSegmentIndex,
          secondSegmentIndex: second.sourceSegmentIndex,
          point,
        });
      }
    }
  }
  return intersections.filter(
    (candidate, index) =>
      intersections.findIndex(
        (other) =>
          other.firstSegmentIndex === candidate.firstSegmentIndex &&
          other.secondSegmentIndex === candidate.secondSegmentIndex &&
          pointsEqual(other.point, candidate.point, toleranceMm),
      ) === index,
  );
}

export function cleanupEditablePath(
  source: EditablePathGeometry,
  toleranceMm: number,
  options: PathCleanupOptions = {},
): PathCleanupResult {
  if (!Number.isFinite(toleranceMm) || toleranceMm <= 0) {
    throw new RangeError("Cleanup tolerance must be positive and finite.");
  }
  const path = copyEditablePath(source);
  const removalKey = (removal: PathCleanupRemoval): string =>
    `${removal.reason}:${String(removal.sourceNodeIndex)}`;
  const allowedRemovalKeys =
    options.allowedRemovals === undefined
      ? null
      : new Set(
          options.allowedRemovals.map((removal) => {
            if (
              !Number.isInteger(removal.sourceNodeIndex) ||
              removal.sourceNodeIndex < 0 ||
              removal.sourceNodeIndex >= path.points.length
            ) {
              throw new RangeError(
                "Allowed cleanup removals must reference a source path node.",
              );
            }
            return removalKey(removal);
          }),
        );
  const canRemove = (removal: PathCleanupRemoval): boolean =>
    allowedRemovalKeys === null || allowedRemovalKeys.has(removalKey(removal));
  const handles = copyHandles(path.handles, path.points.length);
  const retainedPoints: PointMm[] = [];
  const retainedHandles: PathControlHandles[] = [];
  const retainedSourceNodeIndices: number[] = [];
  const removedNodes: PathCleanupRemoval[] = [];
  for (let index = 0; index < path.points.length; index += 1) {
    const point = path.points[index] as PointMm;
    const previous = retainedPoints.at(-1);
    const handle = handles[index] as PathControlHandles;
    const previousHandle = retainedHandles.at(-1);
    const removal = {
      sourceNodeIndex: index,
      reason: "zero-length",
    } satisfies PathCleanupRemoval;
    if (
      previous !== undefined &&
      previousHandle !== undefined &&
      pointsEqual(previous, point, toleranceMm) &&
      handlesAreEmpty(previousHandle) &&
      handlesAreEmpty(handle) &&
      canRemove(removal)
    ) {
      removedNodes.push(removal);
      continue;
    }
    retainedPoints.push(copyPoint(point));
    retainedHandles.push(handle);
    retainedSourceNodeIndices.push(index);
  }
  const firstRetainedHandle = retainedHandles[0];
  const lastRetainedHandle = retainedHandles.at(-1);
  const lastRetainedSourceNodeIndex = retainedSourceNodeIndices.at(-1);
  const closingRemoval =
    lastRetainedSourceNodeIndex === undefined
      ? null
      : ({
          sourceNodeIndex: lastRetainedSourceNodeIndex,
          reason: "zero-length",
        } satisfies PathCleanupRemoval);
  if (
    path.closed &&
    retainedPoints.length > 3 &&
    firstRetainedHandle !== undefined &&
    lastRetainedHandle !== undefined &&
    closingRemoval !== null &&
    pointsEqual(retainedPoints[0] as PointMm, retainedPoints.at(-1) as PointMm, toleranceMm) &&
    handlesAreEmpty(firstRetainedHandle) &&
    handlesAreEmpty(lastRetainedHandle) &&
    canRemove(closingRemoval)
  ) {
    retainedPoints.pop();
    retainedHandles.pop();
    retainedSourceNodeIndices.pop();
    removedNodes.push(closingRemoval);
  }
  let changed = true;
  while (changed && retainedPoints.length > (path.closed ? 3 : 2)) {
    changed = false;
    for (let index = 0; index < retainedPoints.length; index += 1) {
      if (!path.closed && (index === 0 || index === retainedPoints.length - 1)) {
        continue;
      }
      const previousIndex = (index - 1 + retainedPoints.length) % retainedPoints.length;
      const nextIndex = (index + 1) % retainedPoints.length;
      const previousHandle = retainedHandles[previousIndex] as PathControlHandles;
      const handle = retainedHandles[index] as PathControlHandles;
      const nextHandle = retainedHandles[nextIndex] as PathControlHandles;
      const sourceNodeIndex = retainedSourceNodeIndices[index];
      if (sourceNodeIndex === undefined) continue;
      const removal = {
        sourceNodeIndex,
        reason: "redundant-collinear",
      } satisfies PathCleanupRemoval;
      if (
        handlesAreEmpty(handle) &&
        previousHandle.outgoing === null &&
        nextHandle.incoming === null &&
        distancePointToSegment(
          retainedPoints[index] as PointMm,
          retainedPoints[previousIndex] as PointMm,
          retainedPoints[nextIndex] as PointMm,
        ) <= toleranceMm &&
        canRemove(removal)
      ) {
        retainedPoints.splice(index, 1);
        retainedHandles.splice(index, 1);
        retainedSourceNodeIndices.splice(index, 1);
        removedNodes.push(removal);
        changed = true;
        break;
      }
    }
  }
  const compacted = compactHandles(retainedHandles);
  const cleaned: EditablePathGeometry = {
    closed: path.closed,
    points: retainedPoints,
    ...(compacted === undefined ? {} : { handles: compacted }),
  };
  const intersections = findPathSelfIntersections(cleaned, toleranceMm);
  const removedNodeCount = removedNodes.length;
  return {
    path: cleaned,
    removedNodeCount,
    removedNodes,
    intersections,
    warnings: [
      ...(removedNodeCount > 0
        ? [`Removed ${String(removedNodeCount)} duplicate or collinear node${removedNodeCount === 1 ? "" : "s"}.`]
        : []),
      ...(intersections.length > 0
        ? [`Detected ${String(intersections.length)} self-intersection${intersections.length === 1 ? "" : "s"}; none were silently removed.`]
        : []),
    ],
  };
}

export interface JoinPathPreview {
  distanceMm: number;
  withinTolerance: boolean;
  midpoint: PointMm;
}

export function previewPathJoin(
  first: EditablePathGeometry,
  firstEnd: "start" | "end",
  second: EditablePathGeometry,
  secondEnd: "start" | "end",
  toleranceMm: number,
): JoinPathPreview {
  if (first.closed || second.closed) {
    throw new RangeError("Only open path endpoints can be joined.");
  }
  if (!Number.isFinite(toleranceMm) || toleranceMm < 0) {
    throw new RangeError("Join tolerance must be finite and nonnegative.");
  }
  const firstPoint =
    firstEnd === "start" ? (first.points[0] as PointMm) : (first.points.at(-1) as PointMm);
  const secondPoint =
    secondEnd === "start" ? (second.points[0] as PointMm) : (second.points.at(-1) as PointMm);
  const distanceMm = Math.hypot(
    firstPoint.xMm - secondPoint.xMm,
    firstPoint.yMm - secondPoint.yMm,
  );
  return {
    distanceMm,
    withinTolerance: distanceMm <= toleranceMm,
    midpoint: {
      xMm: (firstPoint.xMm + secondPoint.xMm) / 2,
      yMm: (firstPoint.yMm + secondPoint.yMm) / 2,
    },
  };
}

export function joinEditablePaths(
  firstSource: EditablePathGeometry,
  firstEnd: "start" | "end",
  secondSource: EditablePathGeometry,
  secondEnd: "start" | "end",
  toleranceMm: number,
): EditablePathGeometry {
  const preview = previewPathJoin(firstSource, firstEnd, secondSource, secondEnd, toleranceMm);
  if (!preview.withinTolerance) {
    throw new RangeError(
      `Path endpoints are ${preview.distanceMm.toFixed(3)} mm apart, outside the ${toleranceMm.toFixed(3)} mm tolerance.`,
    );
  }
  const first = firstEnd === "end" ? copyEditablePath(firstSource) : reverseEditablePath(firstSource);
  const second = secondEnd === "start" ? copyEditablePath(secondSource) : reverseEditablePath(secondSource);
  const firstHandles = copyHandles(first.handles, first.points.length);
  const secondHandles = copyHandles(second.handles, second.points.length);
  const firstLast = first.points.length - 1;
  const firstAnchor = first.points[firstLast] as PointMm;
  const secondAnchor = second.points[0] as PointMm;
  const translateControl = (
    control: PointMm | null,
    anchor: PointMm,
  ): PointMm | null =>
    control === null
      ? null
      : {
          xMm: control.xMm + preview.midpoint.xMm - anchor.xMm,
          yMm: control.yMm + preview.midpoint.yMm - anchor.yMm,
        };
  firstHandles[firstLast] = {
    incoming: translateControl(
      (firstHandles[firstLast] as PathControlHandles).incoming,
      firstAnchor,
    ),
    outgoing: translateControl(
      (secondHandles[0] as PathControlHandles).outgoing,
      secondAnchor,
    ),
  };
  first.points[firstLast] = copyPoint(preview.midpoint);
  second.points[0] = copyPoint(preview.midpoint);
  const joinedHandles = [...firstHandles, ...secondHandles.slice(1)];
  const compacted = compactHandles(joinedHandles);
  return {
    closed: false,
    points: [...first.points, ...second.points.slice(1)].map(copyPoint),
    ...(compacted === undefined ? {} : { handles: compacted }),
  };
}

export function splitOpenPathAtNode(
  source: EditablePathGeometry,
  nodeIndex: number,
): [EditablePathGeometry, EditablePathGeometry] {
  const path = copyEditablePath(source);
  if (path.closed) {
    throw new RangeError("Open the path before splitting it into two paths.");
  }
  if (!Number.isInteger(nodeIndex) || nodeIndex <= 0 || nodeIndex >= path.points.length - 1) {
    throw new RangeError("Split node must be an interior node of an open path.");
  }
  const handles = copyHandles(path.handles, path.points.length);
  const firstHandles = handles.slice(0, nodeIndex + 1);
  const secondHandles = handles.slice(nodeIndex);
  (firstHandles.at(-1) as PathControlHandles).outgoing = null;
  (secondHandles[0] as PathControlHandles).incoming = null;
  const compactFirst = compactHandles(firstHandles);
  const compactSecond = compactHandles(secondHandles);
  return [
    {
      closed: false,
      points: path.points.slice(0, nodeIndex + 1).map(copyPoint),
      ...(compactFirst === undefined ? {} : { handles: compactFirst }),
    },
    {
      closed: false,
      points: path.points.slice(nodeIndex).map(copyPoint),
      ...(compactSecond === undefined ? {} : { handles: compactSecond }),
    },
  ];
}
