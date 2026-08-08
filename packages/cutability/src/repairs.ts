import {
  copyDocumentObject,
  type DocumentObject,
  type LaserxDocument,
  type PathObject,
} from "@laserx/domain";
import {
  GEOMETRY_ENGINE_TOLERANCE_MM,
  cleanupEditablePath,
  maximumAffineStretch,
  type PathCleanupRemoval,
} from "@laserx/geometry";

import {
  SAFE_REPAIR_NEAR_CLOSURE_TOLERANCE_MM,
  fingerprintCutabilityDocument,
  type CutabilityAnalysisSummary,
  type CutabilityIssue,
} from "./analysis.js";

export type RepairFindingGroupId =
  | "safe-to-fix"
  | "suggested-fix"
  | "needs-your-decision";

export interface RepairFindingGroup {
  id: RepairFindingGroupId;
  label: "Safe to fix" | "Suggested fix" | "Needs your decision";
  description: string;
  findingIds: string[];
  findingCount: number;
  affectedObjectIds: string[];
  affectedObjectCount: number;
}

export interface SafeRepairTolerances {
  zeroLengthMm: number;
  collinearMm: number;
  nearClosureMm: number;
}

export interface CutabilityRepairGroups {
  documentFingerprint: string;
  analysisFingerprint: string;
  tolerances: SafeRepairTolerances;
  safeToFix: RepairFindingGroup;
  suggestedFix: RepairFindingGroup;
  needsYourDecision: RepairFindingGroup;
}

export type SafeRepairChangeKind =
  | "remove-exact-duplicate"
  | "remove-zero-length"
  | "remove-redundant-collinear-points"
  | "close-near-closure";

export interface SafeRepairChange {
  kind: SafeRepairChangeKind;
  objectId: string;
  findingIds: string[];
  description: string;
}

export interface SafeRepairProposal {
  id: string;
  documentFingerprint: string;
  analysisFingerprint: string;
  tolerances: SafeRepairTolerances;
  findingIds: string[];
  plannedFindingIds: string[];
  skippedFindingIds: string[];
  affectedObjectIds: string[];
  deleteObjectIds: string[];
  replacements: PathObject[];
  changes: SafeRepairChange[];
  summary: string;
  disclaimer: string;
}

export const SAFE_REPAIR_TOLERANCES: Readonly<SafeRepairTolerances> = {
  zeroLengthMm: GEOMETRY_ENGINE_TOLERANCE_MM,
  collinearMm: GEOMETRY_ENGINE_TOLERANCE_MM,
  nearClosureMm: SAFE_REPAIR_NEAR_CLOSURE_TOLERANCE_MM,
};

const NEEDS_DECISION_CODES = new Set<CutabilityIssue["code"]>([
  "OPEN_CONTOUR",
  "DISCONNECTED_ISLAND",
  "ENCLOSED_DROPOUT",
  "UNSUPPORTED_GEOMETRY",
]);

function compactFingerprint(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function fingerprintCutabilityAnalysis(
  analysis: CutabilityAnalysisSummary,
): string {
  return JSON.stringify({
    documentFingerprint: analysis.documentFingerprint,
    analyzedObjectIds: analysis.analyzedObjectIds,
    settings: analysis.settings,
    issues: analysis.issues,
  });
}

function findingGroup(
  id: RepairFindingGroupId,
  issues: readonly CutabilityIssue[],
): RepairFindingGroup {
  const presentation = {
    "safe-to-fix": {
      label: "Safe to fix" as const,
      description: "Mechanically proven cleanup that can be previewed and undone.",
    },
    "suggested-fix": {
      label: "Suggested fix" as const,
      description: "A likely repair direction that LaserX will not apply automatically.",
    },
    "needs-your-decision": {
      label: "Needs your decision" as const,
      description: "Geometry or manufacturing intent is ambiguous and needs review.",
    },
  }[id];
  const affectedObjectIds = [
    ...new Set(issues.flatMap((issue) => issue.objectIds)),
  ].sort();
  return {
    id,
    ...presentation,
    findingIds: issues.map((issue) => issue.id),
    findingCount: issues.length,
    affectedObjectIds,
    affectedObjectCount: affectedObjectIds.length,
  };
}

export function groupCutabilityFindings(
  document: LaserxDocument,
  analysis: CutabilityAnalysisSummary,
): CutabilityRepairGroups {
  const documentFingerprint = fingerprintCutabilityDocument(document);
  if (analysis.documentFingerprint !== documentFingerprint) {
    throw new Error("The manufacturing findings are stale. Run analysis again before grouping repairs.");
  }
  const safe: CutabilityIssue[] = [];
  const suggested: CutabilityIssue[] = [];
  const decision: CutabilityIssue[] = [];
  for (const issue of analysis.issues) {
    if (issue.repairHint !== null) {
      safe.push(issue);
    } else if (NEEDS_DECISION_CODES.has(issue.code)) {
      decision.push(issue);
    } else {
      suggested.push(issue);
    }
  }
  return {
    documentFingerprint,
    analysisFingerprint: fingerprintCutabilityAnalysis(analysis),
    tolerances: { ...SAFE_REPAIR_TOLERANCES },
    safeToFix: findingGroup("safe-to-fix", safe),
    suggestedFix: findingGroup("suggested-fix", suggested),
    needsYourDecision: findingGroup("needs-your-decision", decision),
  };
}

function duplicateObjectSignature(object: DocumentObject): string {
  return JSON.stringify({ ...object, id: "" });
}

function localGeometryTolerance(object: PathObject): number {
  const stretch = maximumAffineStretch(object.transform);
  return stretch === 0
    ? SAFE_REPAIR_TOLERANCES.collinearMm
    : SAFE_REPAIR_TOLERANCES.collinearMm / stretch;
}

function isUsablePath(object: PathObject): boolean {
  return object.closed ? object.points.length >= 3 : object.points.length >= 2;
}

function copyPath(object: PathObject): PathObject {
  return copyDocumentObject(object) as PathObject;
}

function cleanupRemovalForIssue(
  issue: CutabilityIssue,
): PathCleanupRemoval | null {
  if (issue.repairNodeIndex === null) return null;
  if (issue.repairHint === "zero-length-entity") {
    return {
      sourceNodeIndex: issue.repairNodeIndex,
      reason: "zero-length",
    };
  }
  if (issue.repairHint === "redundant-collinear-point") {
    return {
      sourceNodeIndex: issue.repairNodeIndex,
      reason: "redundant-collinear",
    };
  }
  return null;
}

function cleanupRemovalKey(removal: PathCleanupRemoval): string {
  return `${removal.reason}:${String(removal.sourceNodeIndex)}`;
}

export function proposeSafeRepairs(
  document: LaserxDocument,
  analysis: CutabilityAnalysisSummary,
): SafeRepairProposal {
  const groups = groupCutabilityFindings(document, analysis);
  if (groups.safeToFix.findingCount === 0) {
    throw new RangeError("There are no mechanically proven safe problems to preview.");
  }
  const issuesById = new Map(analysis.issues.map((issue) => [issue.id, issue]));
  const safeIssues = groups.safeToFix.findingIds
    .map((id) => issuesById.get(id))
    .filter((issue): issue is CutabilityIssue => issue !== undefined);
  const safeIssueIds = new Set(groups.safeToFix.findingIds);
  const deleteObjectIds = new Set<string>();
  const changes: SafeRepairChange[] = [];

  const duplicateIssues = safeIssues.filter(
    (issue) => issue.repairHint === "exact-duplicate-geometry",
  );
  const duplicateIssueObjectIds = new Set(
    duplicateIssues.flatMap((issue) => issue.objectIds),
  );
  const duplicateGroups = new Map<string, DocumentObject[]>();
  for (const object of document.objects) {
    if (!duplicateIssueObjectIds.has(object.id)) continue;
    const signature = duplicateObjectSignature(object);
    const group = duplicateGroups.get(signature);
    if (group === undefined) duplicateGroups.set(signature, [object]);
    else group.push(object);
  }
  for (const objects of duplicateGroups.values()) {
    if (objects.length < 2) continue;
    for (const object of objects.slice(1)) {
      deleteObjectIds.add(object.id);
      const findingIds = safeIssues
        .filter((issue) => issue.objectIds.includes(object.id))
        .map((issue) => issue.id);
      changes.push({
        kind: "remove-exact-duplicate",
        objectId: object.id,
        findingIds,
        description: "Remove one mechanically identical duplicate object.",
      });
    }
  }

  const replacements: PathObject[] = [];
  for (const source of document.objects) {
    const objectIssues = safeIssues.filter((issue) =>
      issue.objectIds.includes(source.id),
    );
    if (objectIssues.length === 0 || deleteObjectIds.has(source.id)) continue;
    const zeroIssues = objectIssues.filter(
      (issue) => issue.repairHint === "zero-length-entity",
    );
    if (source.type === "line" && zeroIssues.length > 0) {
      deleteObjectIds.add(source.id);
      changes.push({
        kind: "remove-zero-length",
        objectId: source.id,
        findingIds: zeroIssues.map((issue) => issue.id),
        description: "Remove a line with no usable length.",
      });
      continue;
    }
    if (source.type !== "path") continue;
    let replacement = copyPath(source);
    const pendingChanges: SafeRepairChange[] = [];
    const cleanupIssues = objectIssues.filter(
      (issue) =>
        issue.repairHint === "zero-length-entity" ||
        issue.repairHint === "redundant-collinear-point",
    );
    if (cleanupIssues.length > 0) {
      const allowedRemovals = cleanupIssues
        .map(cleanupRemovalForIssue)
        .filter((removal): removal is PathCleanupRemoval => removal !== null);
      const cleaned = cleanupEditablePath(
        {
          closed: replacement.closed,
          points: replacement.points,
          ...(replacement.handles === undefined
            ? {}
            : { handles: replacement.handles }),
        },
        localGeometryTolerance(replacement),
        { allowedRemovals },
      );
      if (cleaned.removedNodeCount > 0) {
        replacement = {
          ...replacement,
          points: cleaned.path.points,
          ...(cleaned.path.handles === undefined
            ? { handles: undefined }
            : { handles: cleaned.path.handles }),
        };
      }
      const appliedRemovalKeys = new Set(
        cleaned.removedNodes.map(cleanupRemovalKey),
      );
      const appliedCleanupIssues = cleanupIssues.filter((issue) => {
        const removal = cleanupRemovalForIssue(issue);
        return removal !== null && appliedRemovalKeys.has(cleanupRemovalKey(removal));
      });
      const zeroFindingIds = appliedCleanupIssues
        .filter((issue) => issue.repairHint === "zero-length-entity")
        .map((issue) => issue.id);
      if (zeroFindingIds.length > 0) {
        pendingChanges.push({
          kind: "remove-zero-length",
          objectId: source.id,
          findingIds: zeroFindingIds,
          description: "Remove zero-length path segments within geometry-engine tolerance.",
        });
      }
      const collinearFindingIds = appliedCleanupIssues
        .filter((issue) => issue.repairHint === "redundant-collinear-point")
        .map((issue) => issue.id);
      if (collinearFindingIds.length > 0) {
        pendingChanges.push({
          kind: "remove-redundant-collinear-points",
          objectId: source.id,
          findingIds: collinearFindingIds,
          description: "Remove redundant collinear points within geometry-engine tolerance.",
        });
      }
    }
    const closureIssues = objectIssues.filter(
      (issue) => issue.repairHint === "eligible-near-closure",
    );
    if (closureIssues.length > 0) {
      replacement.closed = true;
      pendingChanges.push({
        kind: "close-near-closure",
        objectId: source.id,
        findingIds: closureIssues.map((issue) => issue.id),
        description: `Close an endpoint gap no larger than ${SAFE_REPAIR_TOLERANCES.nearClosureMm.toFixed(3)} mm.`,
      });
    }
    if (!isUsablePath(replacement)) continue;
    if (JSON.stringify(replacement) !== JSON.stringify(source)) {
      replacements.push(replacement);
      changes.push(...pendingChanges);
    }
  }

  const plannedFindingIds = [
    ...new Set(
      changes
        .flatMap((change) => change.findingIds)
        .filter((id) => safeIssueIds.has(id)),
    ),
  ].sort();
  const skippedFindingIds = groups.safeToFix.findingIds
    .filter((id) => !plannedFindingIds.includes(id))
    .sort();
  if (deleteObjectIds.size === 0 && replacements.length === 0) {
    throw new Error("The current safe findings did not produce a valid repair preview.");
  }
  const affectedObjectIds = [
    ...new Set([
      ...deleteObjectIds,
      ...replacements.map((object) => object.id),
    ]),
  ].sort();
  const analysisFingerprint = groups.analysisFingerprint;
  return {
    id: `safe-repair:${compactFingerprint(analysisFingerprint)}`,
    documentFingerprint: groups.documentFingerprint,
    analysisFingerprint,
    tolerances: { ...groups.tolerances },
    findingIds: [...groups.safeToFix.findingIds],
    plannedFindingIds,
    skippedFindingIds,
    affectedObjectIds,
    deleteObjectIds: [...deleteObjectIds].sort(),
    replacements: replacements.sort((left, right) => left.id.localeCompare(right.id)),
    changes,
    summary: `Preview ${String(plannedFindingIds.length)} safe finding(s) across ${String(affectedObjectIds.length)} object(s); ${String(skippedFindingIds.length)} skipped.`,
    disclaimer: "Original geometry is unchanged until acceptance. Automated cleanup does not prove cut readiness or physical safety.",
  };
}
