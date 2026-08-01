import type {
  DocumentObject,
  LaserxDocument,
  ManufacturingSettings,
  PathObject,
} from "@laserx/domain";
import {
  GEOMETRY_ENGINE_TOLERANCE_MM,
  IDENTITY_AFFINE_TRANSFORM,
  applyAffineTransform,
  boundsContainPoint,
  boundsFromPoints,
  composeAffineTransforms,
  findPathSelfIntersections,
  flattenEditablePath,
  maximumAffineStretch,
  pointInPolygon,
  type AffineTransformMm,
  type BoundsMm,
  type EditablePathGeometry,
  type PointMm,
} from "@laserx/geometry";

export const MAX_CUTABILITY_SEGMENTS = 50_000;
export const CUTABILITY_FLATTENING_TOLERANCE_MM = 0.01;

export type CutabilityIssueCode =
  | "OPEN_CONTOUR"
  | "DUPLICATE_SEGMENT"
  | "OVERLAPPING_SEGMENT"
  | "SELF_INTERSECTION"
  | "DISCONNECTED_ISLAND"
  | "ENCLOSED_DROPOUT"
  | "BRIDGE_TOO_NARROW"
  | "FEATURE_TOO_NARROW"
  | "GAP_TOO_SMALL"
  | "CONTOURS_TOO_CLOSE"
  | "KERF_COLLAPSE_RISK"
  | "UNSUPPORTED_GEOMETRY";

export type CutabilitySeverity = "warning" | "error";

export interface CutabilityIssue {
  id: string;
  code: CutabilityIssueCode;
  severity: CutabilitySeverity;
  objectIds: string[];
  objectId: string | null;
  segmentIndices: number[];
  segmentIndex: number | null;
  measuredValueMm: number;
  configuredLimitMm: number;
  location: PointMm;
  message: string;
  suggestion: string;
}

export type RegionDisposition = "retained" | "removed" | "ambiguous";

export interface CutabilityRegion {
  id: string;
  objectId: string;
  contourIndex: number;
  parentRegionId: string | null;
  depth: number;
  disposition: RegionDisposition;
  areaMm2: number;
  bounds: BoundsMm;
  points: PointMm[];
}

export interface CutabilityAnalysisSummary {
  operationId: string | null;
  status: "complete" | "ambiguous";
  documentFingerprint: string;
  analyzedObjectIds: string[];
  settings: ManufacturingSettings;
  pathCount: number;
  closedPathCount: number;
  openPathCount: number;
  segmentCount: number;
  smallestSegmentMm: number | null;
  issueCount: number;
  errorCount: number;
  warningCount: number;
  issues: CutabilityIssue[];
  regions: CutabilityRegion[];
  previewAssumption: string;
  disclaimer: string;
  cutReady: false;
}

export interface CutabilityAnalysisOptions {
  operationId?: string;
  objectIds?: readonly string[];
  onProgress?: (percent: number, stage: CutabilityProgressStage) => void;
}

export type CutabilityProgressStage =
  | "normalizing"
  | "topology"
  | "spacing"
  | "classifying";

export interface NormalizedCutPath {
  id: string;
  objectId: string;
  contourIndex: number;
  closed: boolean;
  points: PointMm[];
}

interface Segment {
  path: NormalizedCutPath;
  index: number;
  start: PointMm;
  end: PointMm;
}

interface ClosestPoints {
  distanceMm: number;
  first: PointMm;
  second: PointMm;
}

function clonePoint(point: PointMm): PointMm {
  return { xMm: point.xMm, yMm: point.yMm };
}

function transformPoints(
  points: readonly PointMm[],
  transform: AffineTransformMm,
): PointMm[] {
  return points.map((point) => applyAffineTransform(point, transform));
}

function ellipsePoints(
  center: PointMm,
  radiusXmm: number,
  radiusYmm: number,
  transform: AffineTransformMm,
): PointMm[] {
  const maximumRadiusMm = Math.max(radiusXmm, radiusYmm);
  const maximumStretch = maximumAffineStretch(transform);
  const localToleranceMm = maximumStretch === 0
    ? CUTABILITY_FLATTENING_TOLERANCE_MM
    : CUTABILITY_FLATTENING_TOLERANCE_MM / maximumStretch;
  const maximumSegmentAngle = 2 * Math.acos(
    Math.max(-1, 1 - localToleranceMm / maximumRadiusMm),
  );
  const requiredCount = maximumSegmentAngle > 0
    ? Math.max(24, Math.ceil((Math.PI * 2) / maximumSegmentAngle))
    : Number.POSITIVE_INFINITY;
  if (!Number.isFinite(requiredCount) || requiredCount > MAX_CUTABILITY_SEGMENTS) {
    throw new RangeError(
      `Manufacturing analysis supports at most ${String(MAX_CUTABILITY_SEGMENTS)} flattened segments per run. Simplify or analyze a smaller selection.`,
    );
  }
  return transformPoints(Array.from({ length: requiredCount }, (_, index) => {
    const angle = (index / requiredCount) * Math.PI * 2;
    return {
      xMm: center.xMm + Math.cos(angle) * radiusXmm,
      yMm: center.yMm + Math.sin(angle) * radiusYmm,
    };
  }), transform);
}

function transformPathForWorldFlattening(
  object: PathObject,
  transform: AffineTransformMm,
): EditablePathGeometry {
  return {
    closed: object.closed,
    points: transformPoints(object.points, transform),
    ...(object.handles === undefined
      ? {}
      : {
          handles: object.handles.map((handles) => ({
            incoming:
              handles.incoming === null
                ? null
                : applyAffineTransform(handles.incoming, transform),
            outgoing:
              handles.outgoing === null
                ? null
                : applyAffineTransform(handles.outgoing, transform),
          })),
        }),
  };
}

function collectObjectPaths(
  object: DocumentObject,
  parentTransform: AffineTransformMm,
  selectedIds: ReadonlySet<string> | null,
  parentSelected: boolean,
): NormalizedCutPath[] {
  const selected = parentSelected || selectedIds === null || selectedIds.has(object.id);
  const transform = composeAffineTransforms(parentTransform, object.transform);
  if (object.type === "group") {
    return object.children.flatMap((child) =>
      collectObjectPaths(child, transform, selectedIds, selected),
    );
  }
  if (!selected) return [];
  const base = { objectId: object.id, contourIndex: 0 };
  switch (object.type) {
    case "line":
      return [{
        ...base,
        id: `${object.id}:0`,
        closed: false,
        points: transformPoints([object.start, object.end], transform),
      }];
    case "rectangle": {
      const { xMm, yMm } = object.origin;
      return [{
        ...base,
        id: `${object.id}:0`,
        closed: true,
        points: transformPoints([
          { xMm, yMm },
          { xMm: xMm + object.widthMm, yMm },
          { xMm: xMm + object.widthMm, yMm: yMm + object.heightMm },
          { xMm, yMm: yMm + object.heightMm },
        ], transform),
      }];
    }
    case "ellipse":
      return [{
        ...base,
        id: `${object.id}:0`,
        closed: true,
        points: ellipsePoints(
          object.center,
          object.radiusXmm,
          object.radiusYmm,
          transform,
        ),
      }];
    case "path":
      return [{
        ...base,
        id: `${object.id}:0`,
        closed: object.closed,
        points: flattenEditablePath(
          transformPathForWorldFlattening(object, transform),
          CUTABILITY_FLATTENING_TOLERANCE_MM,
        ),
      }];
    case "text":
      return object.contours.map((contour, contourIndex) => ({
        objectId: object.id,
        contourIndex,
        id: `${object.id}:${String(contourIndex)}`,
        closed: contour.closed,
        points: transformPoints(
          contour.points.map((point) => ({
            xMm: point.xMm + object.origin.xMm,
            yMm: point.yMm + object.origin.yMm,
          })),
          transform,
        ),
      }));
  }
}

export function normalizeCutPaths(
  document: LaserxDocument,
  objectIds?: readonly string[],
): NormalizedCutPath[] {
  const visibleLayers = new Set(
    document.layers.filter((layer) => layer.visible).map((layer) => layer.id),
  );
  const selectedIds =
    objectIds === undefined || objectIds.length === 0 ? null : new Set(objectIds);
  const paths = document.objects
    .filter((object) => visibleLayers.has(object.layerId))
    .flatMap((object) =>
      collectObjectPaths(
        object,
        IDENTITY_AFFINE_TRANSFORM,
        selectedIds,
        false,
      ),
    );
  const segmentCount = paths.reduce(
    (count, path) => count + Math.max(0, path.closed ? path.points.length : path.points.length - 1),
    0,
  );
  if (segmentCount > MAX_CUTABILITY_SEGMENTS) {
    throw new RangeError(
      `Manufacturing analysis supports at most ${String(MAX_CUTABILITY_SEGMENTS)} flattened segments per run. Simplify or analyze a smaller selection.`,
    );
  }
  return paths;
}

function pathSegments(path: NormalizedCutPath): Segment[] {
  const count = path.closed ? path.points.length : path.points.length - 1;
  return Array.from({ length: Math.max(0, count) }, (_, index) => ({
    path,
    index,
    start: path.points[index] as PointMm,
    end: path.points[(index + 1) % path.points.length] as PointMm,
  }));
}

function segmentLength(segment: Segment): number {
  return Math.hypot(
    segment.end.xMm - segment.start.xMm,
    segment.end.yMm - segment.start.yMm,
  );
}

function segmentBounds(segment: Segment): BoundsMm {
  return {
    minXmm: Math.min(segment.start.xMm, segment.end.xMm),
    minYmm: Math.min(segment.start.yMm, segment.end.yMm),
    maxXmm: Math.max(segment.start.xMm, segment.end.xMm),
    maxYmm: Math.max(segment.start.yMm, segment.end.yMm),
  };
}

function boundsDistance(first: BoundsMm, second: BoundsMm): number {
  const deltaX = Math.max(
    0,
    first.minXmm - second.maxXmm,
    second.minXmm - first.maxXmm,
  );
  const deltaY = Math.max(
    0,
    first.minYmm - second.maxYmm,
    second.minYmm - first.maxYmm,
  );
  return Math.hypot(deltaX, deltaY);
}

function signedArea(points: readonly PointMm[]): number {
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length] as PointMm;
    return sum + point.xMm * next.yMm - next.xMm * point.yMm;
  }, 0) / 2;
}

function polygonRepresentative(points: readonly PointMm[]): PointMm {
  const area = signedArea(points);
  if (Math.abs(area) > GEOMETRY_ENGINE_TOLERANCE_MM) {
    let x = 0;
    let y = 0;
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index] as PointMm;
      const next = points[(index + 1) % points.length] as PointMm;
      const cross = point.xMm * next.yMm - next.xMm * point.yMm;
      x += (point.xMm + next.xMm) * cross;
      y += (point.yMm + next.yMm) * cross;
    }
    const centroid = { xMm: x / (6 * area), yMm: y / (6 * area) };
    if (pointInPolygon(centroid, points)) return centroid;
  }
  const bounds = boundsFromPoints(points);
  const center = {
    xMm: (bounds.minXmm + bounds.maxXmm) / 2,
    yMm: (bounds.minYmm + bounds.maxYmm) / 2,
  };
  if (pointInPolygon(center, points)) return center;
  const first = points[0] as PointMm;
  for (let index = 1; index < points.length - 1; index += 1) {
    const candidate = {
      xMm: (first.xMm + (points[index] as PointMm).xMm + (points[index + 1] as PointMm).xMm) / 3,
      yMm: (first.yMm + (points[index] as PointMm).yMm + (points[index + 1] as PointMm).yMm) / 3,
    };
    if (pointInPolygon(candidate, points)) return candidate;
  }
  return clonePoint(first);
}

function closestPointOnSegment(point: PointMm, start: PointMm, end: PointMm): PointMm {
  const dx = end.xMm - start.xMm;
  const dy = end.yMm - start.yMm;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return clonePoint(start);
  const ratio = Math.max(
    0,
    Math.min(1, ((point.xMm - start.xMm) * dx + (point.yMm - start.yMm) * dy) / lengthSquared),
  );
  return { xMm: start.xMm + dx * ratio, yMm: start.yMm + dy * ratio };
}

function closestSegmentPoints(first: Segment, second: Segment): ClosestPoints {
  const intersection = segmentIntersectionPoint(first, second);
  if (intersection !== null) {
    return {
      distanceMm: 0,
      first: intersection,
      second: clonePoint(intersection),
    };
  }
  const candidates: Array<[PointMm, PointMm]> = [
    [first.start, closestPointOnSegment(first.start, second.start, second.end)],
    [first.end, closestPointOnSegment(first.end, second.start, second.end)],
    [closestPointOnSegment(second.start, first.start, first.end), second.start],
    [closestPointOnSegment(second.end, first.start, first.end), second.end],
  ];
  return candidates
    .map(([left, right]) => ({
      distanceMm: Math.hypot(left.xMm - right.xMm, left.yMm - right.yMm),
      first: clonePoint(left),
      second: clonePoint(right),
    }))
    .sort((left, right) => left.distanceMm - right.distanceMm)[0] as ClosestPoints;
}

function segmentIntersectionPoint(
  first: Segment,
  second: Segment,
): PointMm | null {
  const firstDelta = {
    xMm: first.end.xMm - first.start.xMm,
    yMm: first.end.yMm - first.start.yMm,
  };
  const secondDelta = {
    xMm: second.end.xMm - second.start.xMm,
    yMm: second.end.yMm - second.start.yMm,
  };
  const denominator =
    firstDelta.xMm * secondDelta.yMm -
    firstDelta.yMm * secondDelta.xMm;
  if (Math.abs(denominator) <= GEOMETRY_ENGINE_TOLERANCE_MM) return null;
  const difference = {
    xMm: second.start.xMm - first.start.xMm,
    yMm: second.start.yMm - first.start.yMm,
  };
  const firstRatio =
    (difference.xMm * secondDelta.yMm -
      difference.yMm * secondDelta.xMm) /
    denominator;
  const secondRatio =
    (difference.xMm * firstDelta.yMm -
      difference.yMm * firstDelta.xMm) /
    denominator;
  if (
    firstRatio < -GEOMETRY_ENGINE_TOLERANCE_MM ||
    firstRatio > 1 + GEOMETRY_ENGINE_TOLERANCE_MM ||
    secondRatio < -GEOMETRY_ENGINE_TOLERANCE_MM ||
    secondRatio > 1 + GEOMETRY_ENGINE_TOLERANCE_MM
  ) return null;
  return {
    xMm: first.start.xMm + firstDelta.xMm * firstRatio,
    yMm: first.start.yMm + firstDelta.yMm * firstRatio,
  };
}

function normalizedPointKey(point: PointMm): string {
  return `${String(Math.round(point.xMm / GEOMETRY_ENGINE_TOLERANCE_MM))},${String(Math.round(point.yMm / GEOMETRY_ENGINE_TOLERANCE_MM))}`;
}

function duplicateKey(segment: Segment): string {
  const first = normalizedPointKey(segment.start);
  const second = normalizedPointKey(segment.end);
  return first < second ? `${first}|${second}` : `${second}|${first}`;
}

function collinearOverlapMm(first: Segment, second: Segment): number {
  const dx = first.end.xMm - first.start.xMm;
  const dy = first.end.yMm - first.start.yMm;
  const length = Math.hypot(dx, dy);
  if (length <= GEOMETRY_ENGINE_TOLERANCE_MM) return 0;
  const crossStart = dx * (second.start.yMm - first.start.yMm) - dy * (second.start.xMm - first.start.xMm);
  const crossEnd = dx * (second.end.yMm - first.start.yMm) - dy * (second.end.xMm - first.start.xMm);
  if (
    Math.abs(crossStart) / length > GEOMETRY_ENGINE_TOLERANCE_MM ||
    Math.abs(crossEnd) / length > GEOMETRY_ENGINE_TOLERANCE_MM
  ) return 0;
  const axis = Math.abs(dx) >= Math.abs(dy) ? "xMm" : "yMm";
  const firstMin = Math.min(first.start[axis], first.end[axis]);
  const firstMax = Math.max(first.start[axis], first.end[axis]);
  const secondMin = Math.min(second.start[axis], second.end[axis]);
  const secondMax = Math.max(second.start[axis], second.end[axis]);
  const projected = Math.max(0, Math.min(firstMax, secondMax) - Math.max(firstMin, secondMin));
  return projected * (length / Math.abs(dx === 0 ? dy : axis === "xMm" ? dx : dy));
}

function midpoint(first: PointMm, second: PointMm): PointMm {
  return { xMm: (first.xMm + second.xMm) / 2, yMm: (first.yMm + second.yMm) / 2 };
}

function issue(
  code: CutabilityIssueCode,
  sequence: number,
  severity: CutabilitySeverity,
  objectIds: readonly string[],
  segmentIndices: readonly number[],
  measuredValueMm: number,
  configuredLimitMm: number,
  location: PointMm,
  message: string,
  suggestion: string,
): CutabilityIssue {
  return {
    id: `${code}:${String(sequence)}`,
    code,
    severity,
    objectIds: [...objectIds],
    objectId: objectIds[0] ?? null,
    segmentIndices: [...segmentIndices],
    segmentIndex: segmentIndices[0] ?? null,
    measuredValueMm,
    configuredLimitMm,
    location: clonePoint(location),
    message,
    suggestion,
  };
}

function relatedSegments(first: Segment, second: Segment): boolean {
  if (first.path.id !== second.path.id) return false;
  const count = first.path.closed ? first.path.points.length : first.path.points.length - 1;
  return (
    first.index === second.index ||
    Math.abs(first.index - second.index) === 1 ||
    (first.path.closed && new Set([first.index, second.index]).has(0) && new Set([first.index, second.index]).has(count - 1))
  );
}

function minimumPathWidth(
  path: NormalizedCutPath,
  localityMm: number,
): ClosestPoints | null {
  const segments = pathSegments(path);
  if (segments.length === 0) return null;
  const bounds = boundsFromPoints(path.points);
  const widthMm = bounds.maxXmm - bounds.minXmm;
  const heightMm = bounds.maxYmm - bounds.minYmm;
  const center = {
    xMm: (bounds.minXmm + bounds.maxXmm) / 2,
    yMm: (bounds.minYmm + bounds.maxYmm) / 2,
  };
  let closest: ClosestPoints = widthMm <= heightMm
    ? {
        distanceMm: widthMm,
        first: { xMm: bounds.minXmm, yMm: center.yMm },
        second: { xMm: bounds.maxXmm, yMm: center.yMm },
      }
    : {
        distanceMm: heightMm,
        first: { xMm: center.xMm, yMm: bounds.minYmm },
        second: { xMm: center.xMm, yMm: bounds.maxYmm },
      };
  const midpointDistances: number[] = [];
  let totalLengthMm = 0;
  for (const segment of segments) {
    const lengthMm = segmentLength(segment);
    midpointDistances.push(totalLengthMm + lengthMm / 2);
    totalLengthMm += lengthMm;
  }
  for (let firstIndex = 0; firstIndex < segments.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < segments.length; secondIndex += 1) {
      const first = segments[firstIndex] as Segment;
      const second = segments[secondIndex] as Segment;
      if (relatedSegments(first, second)) continue;
      const directDistanceMm = Math.abs(
        (midpointDistances[firstIndex] as number) -
        (midpointDistances[secondIndex] as number),
      );
      const contourDistanceMm = path.closed
        ? Math.min(directDistanceMm, totalLengthMm - directDistanceMm)
        : directDistanceMm;
      if (contourDistanceMm <= localityMm * 2) continue;
      const candidate = closestSegmentPoints(first, second);
      if (candidate.distanceMm < closest.distanceMm) closest = candidate;
    }
  }
  return closest;
}

function classifyRegions(
  paths: readonly NormalizedCutPath[],
  ambiguous: boolean,
): CutabilityRegion[] {
  const candidates = paths
    .filter((path) => path.closed && path.points.length >= 3 && Math.abs(signedArea(path.points)) > GEOMETRY_ENGINE_TOLERANCE_MM)
    .map((path) => ({
      path,
      areaMm2: Math.abs(signedArea(path.points)),
      bounds: boundsFromPoints(path.points),
      representative: polygonRepresentative(path.points),
      parent: null as string | null,
    }));
  for (const candidate of candidates) {
    const parents = candidates
      .filter(
        (other) =>
          other.path.id !== candidate.path.id &&
          other.areaMm2 > candidate.areaMm2 &&
          boundsContainPoint(other.bounds, candidate.representative) &&
          pointInPolygon(candidate.representative, other.path.points),
      )
      .sort((left, right) => left.areaMm2 - right.areaMm2);
    candidate.parent = parents[0]?.path.id ?? null;
  }
  const depthFor = (candidate: (typeof candidates)[number]): number => {
    let depth = 0;
    let parentId = candidate.parent;
    const visited = new Set<string>();
    while (parentId !== null && !visited.has(parentId)) {
      visited.add(parentId);
      depth += 1;
      parentId = candidates.find((other) => other.path.id === parentId)?.parent ?? null;
    }
    return depth;
  };
  return candidates
    .map<CutabilityRegion>((candidate) => {
      const depth = depthFor(candidate);
      return {
        id: candidate.path.id,
        objectId: candidate.path.objectId,
        contourIndex: candidate.path.contourIndex,
        parentRegionId: candidate.parent,
        depth,
        disposition: ambiguous ? "ambiguous" : depth % 2 === 0 ? "removed" : "retained",
        areaMm2: candidate.areaMm2,
        bounds: boundsFromPoints(candidate.path.points),
        points: candidate.path.points.map(clonePoint),
      };
    })
    .sort((left, right) => left.depth - right.depth || left.id.localeCompare(right.id));
}

export function fingerprintCutabilityDocument(document: LaserxDocument): string {
  const visibleLayerIds = new Set(
    document.layers
      .filter((layer) => layer.visible)
      .map((layer) => layer.id),
  );
  return JSON.stringify({
    manufacturing: document.settings.manufacturing,
    layers: document.layers.map((layer) => ({
      id: layer.id,
      visible: layer.visible,
      locked: layer.locked,
    })),
    objects: document.objects.filter((object) =>
      visibleLayerIds.has(object.layerId)),
  });
}

export function analyzeDocumentCutability(
  document: LaserxDocument,
  objectIdsOrOptions: readonly string[] | CutabilityAnalysisOptions = {},
): CutabilityAnalysisSummary {
  const options: CutabilityAnalysisOptions = Array.isArray(objectIdsOrOptions)
    ? { objectIds: [...(objectIdsOrOptions as readonly string[])] }
    : (objectIdsOrOptions as CutabilityAnalysisOptions);
  options.onProgress?.(5, "normalizing");
  const paths = normalizeCutPaths(document, options.objectIds);
  const segments = paths.flatMap(pathSegments);
  const settings = document.settings.manufacturing;
  const issues: CutabilityIssue[] = [];
  let issueSequence = 0;
  const record = (
    code: CutabilityIssueCode,
    severity: CutabilitySeverity,
    objectIds: readonly string[],
    segmentIndices: readonly number[],
    measured: number,
    limit: number,
    location: PointMm,
    message: string,
    suggestion: string,
  ): void => {
    issueSequence += 1;
    issues.push(issue(code, issueSequence, severity, objectIds, segmentIndices, measured, limit, location, message, suggestion));
  };
  let ambiguous = false;
  for (const path of paths) {
    if (!path.closed) {
      ambiguous = true;
      const ends = [path.points[0], path.points.at(-1)].filter((point): point is PointMm => point !== undefined);
      const gap = ends.length === 2 ? Math.hypot((ends[0] as PointMm).xMm - (ends[1] as PointMm).xMm, (ends[0] as PointMm).yMm - (ends[1] as PointMm).yMm) : 0;
      record("OPEN_CONTOUR", "error", [path.objectId], [], gap, settings.minimumGapMm, ends[0] ?? { xMm: 0, yMm: 0 }, "This contour is open, so retained and removed regions are ambiguous.", "Join or close the endpoints before relying on manufacturing preview.");
    }
    if (path.closed && (path.points.length < 3 || Math.abs(signedArea(path.points)) <= GEOMETRY_ENGINE_TOLERANCE_MM)) {
      ambiguous = true;
      record("UNSUPPORTED_GEOMETRY", "error", [path.objectId], [], Math.abs(signedArea(path.points)), GEOMETRY_ENGINE_TOLERANCE_MM, path.points[0] ?? { xMm: 0, yMm: 0 }, "This contour has no stable enclosed area.", "Repair or replace the degenerate contour before manufacturing analysis.");
    }
  }

  options.onProgress?.(25, "topology");
  const duplicateMap = new Map<string, Segment[]>();
  for (const segment of segments) {
    const entries = duplicateMap.get(duplicateKey(segment));
    if (entries === undefined) duplicateMap.set(duplicateKey(segment), [segment]);
    else entries.push(segment);
  }
  for (const duplicates of duplicateMap.values()) {
    if (duplicates.length < 2) continue;
    ambiguous = true;
    const first = duplicates[0] as Segment;
    const second = duplicates[1] as Segment;
    record("DUPLICATE_SEGMENT", "error", [first.path.objectId, second.path.objectId], [first.index, second.index], 0, GEOMETRY_ENGINE_TOLERANCE_MM, midpoint(first.start, first.end), "Two segments occupy the same cut line.", "Delete the duplicate segment or merge the overlapping contours.");
  }
  for (const path of paths) {
    const intersections = findPathSelfIntersections(
      { closed: path.closed, points: path.points },
      GEOMETRY_ENGINE_TOLERANCE_MM,
    );
    for (const intersection of intersections) {
      ambiguous = true;
      record("SELF_INTERSECTION", "error", [path.objectId], [intersection.firstSegmentIndex, intersection.secondSegmentIndex], 0, GEOMETRY_ENGINE_TOLERANCE_MM, intersection.point, "This contour crosses itself and has ambiguous material regions.", "Split or reshape the crossing before manufacturing preview.");
    }
  }
  const spatialSegments = segments
    .map((segment) => ({ segment, bounds: segmentBounds(segment) }))
    .sort(
      (left, right) =>
        left.bounds.minXmm - right.bounds.minXmm ||
        left.bounds.minYmm - right.bounds.minYmm ||
        left.segment.path.id.localeCompare(right.segment.path.id) ||
        left.segment.index - right.segment.index,
    );
  for (let firstIndex = 0; firstIndex < spatialSegments.length; firstIndex += 1) {
    const firstEntry = spatialSegments[firstIndex] as (typeof spatialSegments)[number];
    for (let secondIndex = firstIndex + 1; secondIndex < spatialSegments.length; secondIndex += 1) {
      const secondEntry = spatialSegments[secondIndex] as (typeof spatialSegments)[number];
      if (
        secondEntry.bounds.minXmm >
        firstEntry.bounds.maxXmm + GEOMETRY_ENGINE_TOLERANCE_MM
      ) break;
      if (
        secondEntry.bounds.minYmm >
          firstEntry.bounds.maxYmm + GEOMETRY_ENGINE_TOLERANCE_MM ||
        firstEntry.bounds.minYmm >
          secondEntry.bounds.maxYmm + GEOMETRY_ENGINE_TOLERANCE_MM
      ) continue;
      const first = firstEntry.segment;
      const second = secondEntry.segment;
      if (relatedSegments(first, second) || duplicateKey(first) === duplicateKey(second)) continue;
      const overlap = collinearOverlapMm(first, second);
      if (overlap > GEOMETRY_ENGINE_TOLERANCE_MM) {
        ambiguous = true;
        record("OVERLAPPING_SEGMENT", "error", [first.path.objectId, second.path.objectId], [first.index, second.index], overlap, GEOMETRY_ENGINE_TOLERANCE_MM, midpoint(first.start, first.end), "Collinear cut segments overlap.", "Trim or combine the overlapping cut lines.");
      } else if (first.path.id !== second.path.id) {
        const intersection = segmentIntersectionPoint(first, second);
        if (intersection !== null) {
          ambiguous = true;
          record("UNSUPPORTED_GEOMETRY", "error", [first.path.objectId, second.path.objectId], [first.index, second.index], 0, GEOMETRY_ENGINE_TOLERANCE_MM, intersection, "Separate contours intersect, so retained and removed regions are ambiguous.", "Separate or combine the intersecting contours before manufacturing preview.");
        }
      }
    }
  }

  options.onProgress?.(55, "spacing");
  for (const path of paths.filter((candidate) => candidate.closed)) {
    const width = minimumPathWidth(
      path,
      Math.max(settings.minimumFeatureWidthMm, settings.kerfWidthMm),
    );
    if (width === null) continue;
    const location = midpoint(width.first, width.second);
    if (width.distanceMm < settings.minimumFeatureWidthMm) {
      record("FEATURE_TOO_NARROW", "warning", [path.objectId], [], width.distanceMm, settings.minimumFeatureWidthMm, location, "A local feature is narrower than the configured minimum.", "Widen the feature or confirm a less restrictive setting with the machine operator.");
    }
    if (width.distanceMm < settings.kerfWidthMm) {
      record("KERF_COLLAPSE_RISK", "error", [path.objectId], [], width.distanceMm, settings.kerfWidthMm, location, "The estimated feature width is no larger than the configured kerf.", "Widen or remove the feature before cutting.");
    }
  }
  const byPath = paths.map((path) => ({
    path,
    bounds: boundsFromPoints(path.points),
    segments: pathSegments(path),
  }));
  const spacingLimit = Math.max(
    settings.minimumGapMm,
    settings.contourSpacingMm,
    settings.heatDistortionSpacingMm ?? 0,
  );
  for (let firstIndex = 0; firstIndex < byPath.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < byPath.length; secondIndex += 1) {
      const first = byPath[firstIndex] as (typeof byPath)[number];
      const second = byPath[secondIndex] as (typeof byPath)[number];
      if (boundsDistance(first.bounds, second.bounds) >= spacingLimit) continue;
      let closest: ClosestPoints | null = null;
      for (const firstSegment of first.segments) {
        for (const secondSegment of second.segments) {
          const candidate = closestSegmentPoints(firstSegment, secondSegment);
          if (closest === null || candidate.distanceMm < closest.distanceMm) closest = candidate;
        }
      }
      if (closest === null) continue;
      const location = midpoint(closest.first, closest.second);
      if (closest.distanceMm < settings.minimumGapMm) {
        record("GAP_TOO_SMALL", "warning", [first.path.objectId, second.path.objectId], [], closest.distanceMm, settings.minimumGapMm, location, "The gap between contours is below the configured minimum.", "Move or reshape one contour to increase the gap.");
      }
      const contourSpacingLimit = Math.max(settings.contourSpacingMm, settings.heatDistortionSpacingMm ?? 0);
      if (closest.distanceMm < contourSpacingLimit) {
        record("CONTOURS_TOO_CLOSE", "warning", [first.path.objectId, second.path.objectId], [], closest.distanceMm, contourSpacingLimit, location, "The contour spacing is below the configured process limit.", "Increase contour spacing or confirm the setting for the chosen process.");
      }
    }
  }

  options.onProgress?.(85, "classifying");
  const regions = classifyRegions(paths, ambiguous);
  if (!ambiguous) {
    for (const region of regions) {
      const location = polygonRepresentative(region.points);
      if (region.depth % 2 === 1) {
        record("DISCONNECTED_ISLAND", "error", [region.objectId], [], 0, settings.minimumBridgeWidthMm, location, "This retained island is disconnected from the surrounding retained stock.", "Preview a manual or automatic bridge at least as wide as the configured minimum.");
        const regionPath = paths.find((path) => path.id === region.id);
        if (regionPath === undefined) continue;
        const width = minimumPathWidth(
          regionPath,
          settings.minimumBridgeWidthMm,
        );
        if (width !== null && width.distanceMm < settings.minimumBridgeWidthMm) {
          record("BRIDGE_TOO_NARROW", "warning", [region.objectId], [], width.distanceMm, settings.minimumBridgeWidthMm, midpoint(width.first, width.second), "This retained region has a neck narrower than the configured bridge width.", "Widen the connection or use a larger bridge proposal.");
        }
      } else if (region.depth >= 2) {
        record("ENCLOSED_DROPOUT", "warning", [region.objectId], [], Math.sqrt(region.areaMm2), settings.minimumFeatureWidthMm, location, "This nested region is classified as removable material and may fall out.", "Confirm that the enclosed drop-out is intentional in manufacturing preview.");
      }
    }
  }
  const analyzedObjectIds = options.objectIds?.length
    ? [...options.objectIds].sort()
    : [...new Set(paths.map((path) => path.objectId))].sort();
  const smallestSegmentMm = segments.length === 0 ? null : Math.min(...segments.map(segmentLength));
  options.onProgress?.(100, "classifying");
  return {
    operationId: options.operationId ?? null,
    status: ambiguous ? "ambiguous" : "complete",
    documentFingerprint: fingerprintCutabilityDocument(document),
    analyzedObjectIds,
    settings: { ...settings, customizedFields: [...settings.customizedFields] },
    pathCount: paths.length,
    closedPathCount: paths.filter((path) => path.closed).length,
    openPathCount: paths.filter((path) => !path.closed).length,
    segmentCount: segments.length,
    smallestSegmentMm,
    issueCount: issues.length,
    errorCount: issues.filter((candidate) => candidate.severity === "error").length,
    warningCount: issues.filter((candidate) => candidate.severity === "warning").length,
    issues,
    regions,
    previewAssumption: "The stock/background outside all closed contours is retained; each valid contour crossing toggles retained and removed material.",
    disclaimer: "Cutability analysis is guidance based on editable user settings, not a certification of machine safety or part quality.",
    cutReady: false,
  };
}

export function editablePathForRegion(
  document: LaserxDocument,
  region: CutabilityRegion,
): PathObject | null {
  const object = document.objects.find((candidate) => candidate.id === region.objectId);
  return object?.type === "path" && object.closed ? object : null;
}
