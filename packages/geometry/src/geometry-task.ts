import {
  defaultGeometryEngine,
  type BooleanOperation,
  type EngineContour,
  type GeometryEngine,
  type GeometryEngineMetadata,
  type OffsetJoin,
} from "./geometry-engine.js";

export type GeometryEngineTaskRequest =
  | {
      operationId: string;
      kind: "boolean";
      operation: BooleanOperation;
      contours: EngineContour[];
    }
  | {
      operationId: string;
      kind: "offset";
      distanceMm: number;
      join: OffsetJoin;
      contours: EngineContour[];
    };

export interface GeometryEngineTaskResult {
  operationId: string;
  contours: EngineContour[];
  warnings: string[];
  elapsedMs: number;
  engine: GeometryEngineMetadata;
}

export function runGeometryEngineTask(
  request: GeometryEngineTaskRequest,
  engine: GeometryEngine = defaultGeometryEngine,
): GeometryEngineTaskResult {
  const startedAt = Date.now();
  const result =
    request.kind === "boolean"
      ? engine.boolean(request.operation, request.contours)
      : engine.offset(request.contours, request.distanceMm, request.join);
  return {
    operationId: request.operationId,
    contours: result.contours,
    warnings: result.warnings,
    elapsedMs: Date.now() - startedAt,
    engine: { ...engine.metadata },
  };
}
