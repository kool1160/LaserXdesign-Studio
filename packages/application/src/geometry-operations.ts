import {
  flattenEditablePath,
  type BooleanOperation,
  type EngineContour,
  type GeometryEngineTaskRequest,
  type GeometryEngineTaskResult,
  type OffsetJoin,
  type PointMm,
} from "@laserx/geometry";
import {
  identityTransform,
  isLayerEditable,
  type LaserxDocument,
  type PathObject,
} from "@laserx/domain";

import type { TopologyChangeSummary } from "./project-session.js";

export type GeometryOperationRequest =
  | {
      operationId: string;
      kind: "boolean";
      operation: BooleanOperation;
    }
  | {
      operationId: string;
      kind: "offset";
      distanceMm: number;
      join: OffsetJoin;
    };

export interface PreparedGeometryOperation {
  task: GeometryEngineTaskRequest;
  sourceObjectIds: string[];
  layerId: string;
  beforeNodeCount: number;
  documentFingerprint: string;
}

export interface MaterializedGeometryOperation {
  replacements: PathObject[];
  summary: TopologyChangeSummary;
}

function worldPoint(object: PathObject, point: PointMm): PointMm {
  return {
    xMm:
      object.transform.a * point.xMm +
      object.transform.c * point.yMm +
      object.transform.eMm,
    yMm:
      object.transform.b * point.xMm +
      object.transform.d * point.yMm +
      object.transform.fMm,
  };
}

function engineContour(object: PathObject): EngineContour {
  const flattened = flattenEditablePath(object, 0.002);
  return {
    closed: object.closed,
    points: flattened.map((point) => worldPoint(object, point)),
  };
}

export function fingerprintGeometryDocument(document: LaserxDocument): string {
  return JSON.stringify(document);
}

export function prepareGeometryOperation(
  document: LaserxDocument,
  selectionIds: readonly string[],
  request: GeometryOperationRequest,
): PreparedGeometryOperation {
  const selected = selectionIds
    .map((id) => document.objects.find((object) => object.id === id))
    .filter(
      (object): object is PathObject =>
        object?.type === "path" &&
        isLayerEditable(document, object.layerId),
    );
  const minimum = request.kind === "boolean" ? 2 : 1;
  if (selected.length !== selectionIds.length || selected.length < minimum) {
    throw new RangeError(
      request.kind === "boolean"
        ? "Select at least two editable closed path objects."
        : "Select one or more editable closed path objects.",
    );
  }
  if (selected.some((object) => !object.closed)) {
    throw new RangeError("Boolean and offset operations require closed paths.");
  }
  if (new Set(selected.map((object) => object.layerId)).size !== 1) {
    throw new RangeError(
      "Geometry operations require all selected paths to share one editable layer.",
    );
  }
  const contours = selected.map(engineContour);
  const task: GeometryEngineTaskRequest =
    request.kind === "boolean"
      ? {
          operationId: request.operationId,
          kind: "boolean",
          operation: request.operation,
          contours,
        }
      : {
          operationId: request.operationId,
          kind: "offset",
          distanceMm: request.distanceMm,
          join: request.join,
          contours,
        };
  return {
    task,
    sourceObjectIds: selected.map((object) => object.id),
    layerId: (selected[0] as PathObject).layerId,
    beforeNodeCount: selected.reduce(
      (count, object) => count + object.points.length,
      0,
    ),
    documentFingerprint: fingerprintGeometryDocument(document),
  };
}

function operationLabel(request: GeometryEngineTaskRequest): string {
  if (request.kind === "offset") {
    return request.distanceMm > 0 ? "Outward offset" : "Inward offset";
  }
  return request.operation === "xor"
    ? "Exclude / XOR"
    : `${request.operation.charAt(0).toUpperCase()}${request.operation.slice(1)}`;
}

export function materializeGeometryOperation(
  prepared: PreparedGeometryOperation,
  result: GeometryEngineTaskResult,
  createId: () => string,
): MaterializedGeometryOperation {
  if (result.operationId !== prepared.task.operationId) {
    throw new RangeError("Geometry worker returned a mismatched operation ID.");
  }
  if (result.contours.length === 0) {
    throw new RangeError(
      "The operation produced no contours; the original document was left unchanged.",
    );
  }
  const replacements = result.contours.map<PathObject>((contour, index) => ({
    id: index === 0 ? (prepared.sourceObjectIds[0] as string) : createId(),
    type: "path",
    layerId: prepared.layerId,
    transform: identityTransform(),
    closed: true,
    points: contour.points.map((point) => ({ ...point })),
  }));
  const resultIds = replacements.map((object) => object.id);
  const discardedObjectIds = prepared.sourceObjectIds.filter(
    (id) => !resultIds.includes(id),
  );
  const afterNodeCount = replacements.reduce(
    (count, object) => count + object.points.length,
    0,
  );
  const operation = operationLabel(prepared.task);
  const warnings = [
    ...result.warnings,
    ...(discardedObjectIds.length > 0
      ? [
          `${String(discardedObjectIds.length)} source object ID${discardedObjectIds.length === 1 ? " was" : "s were"} replaced and reported.`,
        ]
      : []),
  ];
  return {
    replacements,
    summary: {
      operation,
      beforeNodeCount: prepared.beforeNodeCount,
      afterNodeCount,
      replacedObjectIds: resultIds,
      discardedObjectIds,
      warnings,
      message: `${operation}: ${String(prepared.beforeNodeCount)} → ${String(afterNodeCount)} nodes across ${String(replacements.length)} resulting contour${replacements.length === 1 ? "" : "s"} in ${result.elapsedMs.toFixed(1)} ms (${result.engine.engine}).`,
    },
  };
}
