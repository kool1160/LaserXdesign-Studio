import type { LaserxDocument } from "@laserx/domain";

import {
  analyzeDocumentCutability,
  type CutabilityAnalysisSummary,
  type CutabilityProgressStage,
} from "./analysis.js";

export interface CutabilityTaskRequest {
  operationId: string;
  document: LaserxDocument;
  objectIds: string[];
}

export interface CutabilityTaskProgress {
  operationId: string;
  percent: number;
  stage: CutabilityProgressStage;
}

export function runCutabilityTask(
  request: CutabilityTaskRequest,
  onProgress?: (progress: CutabilityTaskProgress) => void,
): CutabilityAnalysisSummary {
  return analyzeDocumentCutability(request.document, {
    operationId: request.operationId,
    objectIds: request.objectIds,
    onProgress(percent, stage) {
      onProgress?.({ operationId: request.operationId, percent, stage });
    },
  });
}
