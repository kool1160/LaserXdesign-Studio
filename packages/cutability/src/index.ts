import type { DocumentObject, LaserxDocument } from "@laserx/domain";
import {
  IDENTITY_AFFINE_TRANSFORM,
  applyAffineTransform,
  composeAffineTransforms,
  type AffineTransformMm,
  type PointMm,
} from "@laserx/geometry";

export type CutabilitySeverity = "warning" | "error";

export interface CutabilityIssue {
  code: string;
  severity: CutabilitySeverity;
  objectId: string | null;
  segmentIndex: number | null;
  measuredValueMm: number | null;
  configuredLimitMm: number | null;
  message: string;
  suggestion: string;
}

export interface CutabilityAnalysisSummary {
  status: "requires-settings";
  analyzedObjectIds: string[];
  pathCount: number;
  closedPathCount: number;
  openPathCount: number;
  smallestSegmentMm: number | null;
  issueCount: number;
  issues: CutabilityIssue[];
  cutReady: false;
}

interface AnalyzedPath {
  objectId: string;
  closed: boolean;
  points: PointMm[];
}

function collectPaths(
  object: DocumentObject,
  parentSelected: boolean,
  selectedIds: ReadonlySet<string>,
  parentTransform: AffineTransformMm,
): AnalyzedPath[] {
  const selected = parentSelected || selectedIds.has(object.id);
  const worldTransform = composeAffineTransforms(parentTransform, object.transform);
  if (object.type === "group") {
    return object.children.flatMap((child) =>
      collectPaths(child, selected, selectedIds, worldTransform),
    );
  }
  if (!selected || object.type !== "path") {
    return [];
  }
  return [
    {
      objectId: object.id,
      closed: object.closed,
      points: object.points.map((point) =>
        applyAffineTransform(point, worldTransform),
      ),
    },
  ];
}

function smallestSegment(paths: readonly AnalyzedPath[]): number | null {
  let smallest = Number.POSITIVE_INFINITY;
  for (const path of paths) {
    const segmentCount = path.closed ? path.points.length : path.points.length - 1;
    for (let index = 0; index < segmentCount; index += 1) {
      const start = path.points[index] as PointMm;
      const end = path.points[(index + 1) % path.points.length] as PointMm;
      smallest = Math.min(
        smallest,
        Math.hypot(end.xMm - start.xMm, end.yMm - start.yMm),
      );
    }
  }
  return Number.isFinite(smallest) ? smallest : null;
}

export function analyzeDocumentCutability(
  document: LaserxDocument,
  objectIds: readonly string[],
): CutabilityAnalysisSummary {
  const selectedIds = new Set(objectIds);
  const paths = document.objects.flatMap((object) =>
    collectPaths(object, false, selectedIds, IDENTITY_AFFINE_TRANSFORM),
  );
  const issues: CutabilityIssue[] = [
    {
      code: "process-settings-required",
      severity: "warning",
      objectId: null,
      segmentIndex: null,
      measuredValueMm: null,
      configuredLimitMm: null,
      message:
        "Cutability review requires machine, material, kerf, and minimum-feature settings before this geometry can be assessed.",
      suggestion:
        "Configure the manufacturing analysis in M08; do not treat traced geometry as cut-ready.",
    },
  ];
  for (const path of paths) {
    if (!path.closed) {
      issues.push({
        code: "open-contour",
        severity: "warning",
        objectId: path.objectId,
        segmentIndex: null,
        measuredValueMm: null,
        configuredLimitMm: null,
        message: "This path is open and cannot define a retained or drop-out region.",
        suggestion: "Inspect the endpoints and close the contour before manufacturing export.",
      });
    }
  }
  const openPathCount = paths.filter((path) => !path.closed).length;
  return {
    status: "requires-settings",
    analyzedObjectIds: [...objectIds],
    pathCount: paths.length,
    closedPathCount: paths.length - openPathCount,
    openPathCount,
    smallestSegmentMm: smallestSegment(paths),
    issueCount: issues.length,
    issues,
    cutReady: false,
  };
}
