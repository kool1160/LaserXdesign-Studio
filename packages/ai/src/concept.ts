import type { DocumentObject, Layer } from "@laserx/domain";

export interface AiUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

export interface AiConceptSummary {
  id: string;
  title: string;
  description: string;
  source: "structured-vector" | "raster-trace";
  requestedWording: string;
  observedWording: string;
  wordingMatches: boolean;
  objectCount: number;
  layerCount: number;
  warnings: string[];
}

export interface AiNormalizedConcept {
  summary: AiConceptSummary;
  layers: Layer[];
  objects: DocumentObject[];
  providerId: string;
  model: string;
  requestId: string | null;
  usage: AiUsage;
  analysis: {
    status: "complete" | "ambiguous";
    issueCount: number;
    errorCount: number;
    warningCount: number;
    cutReady: false;
    disclaimer: string;
  };
  provenanceSaved: false;
}
