import {
  identityTransform,
  isLayerEditable,
  type LaserxDocument,
  type PathObject,
} from "@laserx/domain";
import {
  defaultGeometryEngine,
  pointInPolygon,
  type PointMm,
} from "@laserx/geometry";

import {
  editablePathForRegion,
  fingerprintCutabilityDocument,
  normalizeCutPaths,
  type CutabilityAnalysisSummary,
  type CutabilityRegion,
  type NormalizedCutPath,
} from "./analysis.js";

export type ManualBridgeDirection = "left" | "right" | "up" | "down";
export type BridgeProposalMode = "manual" | "automatic";

export interface BridgeProposalRequest {
  issueId: string;
  widthMm: number;
  mode: BridgeProposalMode;
  direction?: ManualBridgeDirection | undefined;
}

export interface BridgeProposal {
  id: string;
  issueId: string;
  mode: BridgeProposalMode;
  direction: ManualBridgeDirection;
  sourceObjectIds: string[];
  layerId: string;
  widthMm: number;
  lengthMm: number;
  bridgePolygon: PointMm[];
  replacementContours: Array<{ closed: true; points: PointMm[] }>;
  documentFingerprint: string;
  summary: string;
  warnings: string[];
}

function polygonCenter(region: CutabilityRegion): PointMm {
  return {
    xMm: (region.bounds.minXmm + region.bounds.maxXmm) / 2,
    yMm: (region.bounds.minYmm + region.bounds.maxYmm) / 2,
  };
}

function directionVector(direction: ManualBridgeDirection): PointMm {
  switch (direction) {
    case "left": return { xMm: -1, yMm: 0 };
    case "right": return { xMm: 1, yMm: 0 };
    case "up": return { xMm: 0, yMm: 1 };
    case "down": return { xMm: 0, yMm: -1 };
  }
}

function rayPolygonIntersections(
  origin: PointMm,
  direction: PointMm,
  points: readonly PointMm[],
): Array<{ distanceMm: number; point: PointMm }> {
  const intersections: Array<{ distanceMm: number; point: PointMm }> = [];
  for (let index = 0; index < points.length; index += 1) {
    const start = points[index] as PointMm;
    const end = points[(index + 1) % points.length] as PointMm;
    const segment = { xMm: end.xMm - start.xMm, yMm: end.yMm - start.yMm };
    const denominator = direction.xMm * segment.yMm - direction.yMm * segment.xMm;
    if (Math.abs(denominator) <= 1e-9) continue;
    const difference = { xMm: start.xMm - origin.xMm, yMm: start.yMm - origin.yMm };
    const rayDistance =
      (difference.xMm * segment.yMm - difference.yMm * segment.xMm) /
      denominator;
    const segmentRatio =
      (difference.xMm * direction.yMm - difference.yMm * direction.xMm) /
      denominator;
    if (rayDistance >= 0 && segmentRatio >= 0 && segmentRatio <= 1) {
      intersections.push({
        distanceMm: rayDistance,
        point: {
          xMm: origin.xMm + direction.xMm * rayDistance,
          yMm: origin.yMm + direction.yMm * rayDistance,
        },
      });
    }
  }
  return intersections.sort((left, right) => left.distanceMm - right.distanceMm);
}

function rectangleAroundConnection(
  start: PointMm,
  end: PointMm,
  widthMm: number,
  extensionMm: number,
): PointMm[] {
  const dx = end.xMm - start.xMm;
  const dy = end.yMm - start.yMm;
  const length = Math.hypot(dx, dy);
  if (length <= 1e-9) throw new RangeError("Bridge endpoints must be separated.");
  const along = { xMm: dx / length, yMm: dy / length };
  const normal = { xMm: -along.yMm * widthMm / 2, yMm: along.xMm * widthMm / 2 };
  const extendedStart = {
    xMm: start.xMm - along.xMm * extensionMm,
    yMm: start.yMm - along.yMm * extensionMm,
  };
  const extendedEnd = {
    xMm: end.xMm + along.xMm * extensionMm,
    yMm: end.yMm + along.yMm * extensionMm,
  };
  return [
    { xMm: extendedStart.xMm + normal.xMm, yMm: extendedStart.yMm + normal.yMm },
    { xMm: extendedEnd.xMm + normal.xMm, yMm: extendedEnd.yMm + normal.yMm },
    { xMm: extendedEnd.xMm - normal.xMm, yMm: extendedEnd.yMm - normal.yMm },
    { xMm: extendedStart.xMm - normal.xMm, yMm: extendedStart.yMm - normal.yMm },
  ];
}

function candidateForDirection(
  inner: CutabilityRegion,
  outer: CutabilityRegion,
  direction: ManualBridgeDirection,
  widthMm: number,
  extensionMm: number,
): { direction: ManualBridgeDirection; start: PointMm; end: PointMm; polygon: PointMm[]; lengthMm: number } | null {
  const center = polygonCenter(inner);
  const vector = directionVector(direction);
  const innerHit = rayPolygonIntersections(center, vector, inner.points)[0];
  const outerHit = rayPolygonIntersections(center, vector, outer.points)
    .find((candidate) => candidate.distanceMm > (innerHit?.distanceMm ?? 0) + 1e-6);
  if (innerHit === undefined || outerHit === undefined) return null;
  const lengthMm = Math.hypot(
    outerHit.point.xMm - innerHit.point.xMm,
    outerHit.point.yMm - innerHit.point.yMm,
  );
  return {
    direction,
    start: innerHit.point,
    end: outerHit.point,
    polygon: rectangleAroundConnection(innerHit.point, outerHit.point, widthMm, extensionMm),
    lengthMm,
  };
}

function polygonTouchesOtherContour(
  polygon: readonly PointMm[],
  paths: readonly NormalizedCutPath[],
  sourceIds: ReadonlySet<string>,
): boolean {
  return paths.some(
    (path) =>
      !sourceIds.has(path.objectId) &&
      (path.points.some((point) => pointInPolygon(point, polygon)) ||
        polygon.some((point) => pointInPolygon(point, path.points)) ||
        pathIntersectsPolygon(path, polygon)),
  );
}

function orientation(first: PointMm, second: PointMm, third: PointMm): number {
  return (
    (second.xMm - first.xMm) * (third.yMm - first.yMm) -
    (second.yMm - first.yMm) * (third.xMm - first.xMm)
  );
}

function pointOnSegment(
  point: PointMm,
  start: PointMm,
  end: PointMm,
): boolean {
  return (
    Math.abs(orientation(start, end, point)) <= 1e-9 &&
    point.xMm >= Math.min(start.xMm, end.xMm) - 1e-9 &&
    point.xMm <= Math.max(start.xMm, end.xMm) + 1e-9 &&
    point.yMm >= Math.min(start.yMm, end.yMm) - 1e-9 &&
    point.yMm <= Math.max(start.yMm, end.yMm) + 1e-9
  );
}

function segmentsIntersect(
  firstStart: PointMm,
  firstEnd: PointMm,
  secondStart: PointMm,
  secondEnd: PointMm,
): boolean {
  const firstSideStart = orientation(firstStart, firstEnd, secondStart);
  const firstSideEnd = orientation(firstStart, firstEnd, secondEnd);
  const secondSideStart = orientation(secondStart, secondEnd, firstStart);
  const secondSideEnd = orientation(secondStart, secondEnd, firstEnd);
  if (
    firstSideStart * firstSideEnd < 0 &&
    secondSideStart * secondSideEnd < 0
  ) return true;
  return (
    pointOnSegment(secondStart, firstStart, firstEnd) ||
    pointOnSegment(secondEnd, firstStart, firstEnd) ||
    pointOnSegment(firstStart, secondStart, secondEnd) ||
    pointOnSegment(firstEnd, secondStart, secondEnd)
  );
}

function pathIntersectsPolygon(
  path: NormalizedCutPath,
  polygon: readonly PointMm[],
): boolean {
  const pathSegmentCount = path.closed
    ? path.points.length
    : Math.max(0, path.points.length - 1);
  for (let pathIndex = 0; pathIndex < pathSegmentCount; pathIndex += 1) {
    const pathStart = path.points[pathIndex] as PointMm;
    const pathEnd = path.points[(pathIndex + 1) % path.points.length] as PointMm;
    for (let polygonIndex = 0; polygonIndex < polygon.length; polygonIndex += 1) {
      const polygonStart = polygon[polygonIndex] as PointMm;
      const polygonEnd = polygon[(polygonIndex + 1) % polygon.length] as PointMm;
      if (segmentsIntersect(pathStart, pathEnd, polygonStart, polygonEnd)) {
        return true;
      }
    }
  }
  return false;
}

function pathForRegion(
  paths: readonly NormalizedCutPath[],
  region: CutabilityRegion,
): NormalizedCutPath {
  const path = paths.find((candidate) => candidate.id === region.id);
  if (path === undefined) throw new RangeError("The analyzed bridge region is no longer available.");
  return path;
}

export function proposeBridge(
  document: LaserxDocument,
  analysis: CutabilityAnalysisSummary,
  request: BridgeProposalRequest,
): BridgeProposal {
  if (analysis.documentFingerprint !== fingerprintCutabilityDocument(document)) {
    throw new Error("The document changed after analysis; run manufacturing analysis again.");
  }
  const issue = analysis.issues.find(
    (candidate) => candidate.id === request.issueId && candidate.code === "DISCONNECTED_ISLAND",
  );
  if (issue === undefined) {
    throw new RangeError("Choose a disconnected-island issue for bridge placement.");
  }
  if (!Number.isFinite(request.widthMm) || request.widthMm < document.settings.manufacturing.minimumBridgeWidthMm) {
    throw new RangeError(
      `Bridge width must be at least ${document.settings.manufacturing.minimumBridgeWidthMm.toFixed(3)} mm.`,
    );
  }
  const inner = analysis.regions.find(
    (region) => region.objectId === issue.objectId && region.depth % 2 === 1,
  );
  const outer = analysis.regions.find((region) => region.id === inner?.parentRegionId);
  if (inner === undefined || outer === undefined) {
    throw new RangeError("The island has no editable containing contour.");
  }
  const innerObject = editablePathForRegion(document, inner);
  const outerObject = editablePathForRegion(document, outer);
  if (
    innerObject === null ||
    outerObject === null ||
    innerObject.layerId !== outerObject.layerId ||
    !isLayerEditable(document, innerObject.layerId)
  ) {
    throw new RangeError("Bridge repair currently requires two top-level editable paths on one layer.");
  }
  const paths = normalizeCutPaths(document);
  const innerPath = pathForRegion(paths, inner);
  const outerPath = pathForRegion(paths, outer);
  const sourceIds = new Set([inner.objectId, outer.objectId]);
  const directions: readonly ManualBridgeDirection[] =
    request.mode === "manual"
      ? [request.direction ?? "right"]
      : ["left", "right", "up", "down"];
  const candidates = directions
    .map((direction) =>
      candidateForDirection(
        inner,
        outer,
        direction,
        request.widthMm,
        document.settings.manufacturing.kerfWidthMm,
      ),
    )
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
    .filter((candidate) => !polygonTouchesOtherContour(candidate.polygon, paths, sourceIds))
    .sort((left, right) => left.lengthMm - right.lengthMm || left.direction.localeCompare(right.direction));
  const chosen = candidates[0];
  if (chosen === undefined) {
    throw new RangeError("No collision-free bridge placement was found in the requested direction.");
  }
  const result = defaultGeometryEngine.boolean("subtract", [
    { closed: true, points: outerPath.points },
    { closed: true, points: innerPath.points },
    { closed: true, points: chosen.polygon },
  ]);
  if (result.contours.length === 0) {
    throw new RangeError("The bridge proposal produced no valid replacement contour.");
  }
  return {
    id: `bridge:${request.issueId}:${chosen.direction}:${request.widthMm.toFixed(6)}`,
    issueId: request.issueId,
    mode: request.mode,
    direction: chosen.direction,
    sourceObjectIds: [outerObject.id, innerObject.id],
    layerId: outerObject.layerId,
    widthMm: request.widthMm,
    lengthMm: chosen.lengthMm,
    bridgePolygon: chosen.polygon.map((point) => ({ ...point })),
    replacementContours: result.contours.map((contour) => ({
      closed: true,
      points: contour.points.map((point) => ({ ...point })),
    })),
    documentFingerprint: fingerprintCutabilityDocument(document),
    summary: `${request.mode === "automatic" ? "Automatic" : "Manual"} ${chosen.direction} bridge: ${request.widthMm.toFixed(3)} mm wide across ${chosen.lengthMm.toFixed(3)} mm.`,
    warnings: [...result.warnings],
  };
}

export function materializeBridgeProposal(
  proposal: BridgeProposal,
  createId: () => string,
): PathObject[] {
  return proposal.replacementContours.map((contour, index) => ({
    id: index === 0 ? (proposal.sourceObjectIds[0] as string) : createId(),
    type: "path",
    layerId: proposal.layerId,
    transform: identityTransform(),
    closed: true,
    points: contour.points.map((point) => ({ ...point })),
  }));
}
