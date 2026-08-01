import type { LaserxDocument } from "@laserx/domain";

import {
  fingerprintCutabilityDocument,
  type CutabilityAnalysisSummary,
} from "./analysis.js";

export class CutabilityAnalysisCache {
  readonly #entries = new Map<string, CutabilityAnalysisSummary>();

  public key(document: LaserxDocument, objectIds: readonly string[] = []): string {
    return `${fingerprintCutabilityDocument(document)}::${[...objectIds].sort().join(",")}`;
  }

  public get(
    document: LaserxDocument,
    objectIds: readonly string[] = [],
  ): CutabilityAnalysisSummary | null {
    const entry = this.#entries.get(this.key(document, objectIds));
    return entry === undefined
      ? null
      : (JSON.parse(JSON.stringify(entry)) as CutabilityAnalysisSummary);
  }

  public set(
    document: LaserxDocument,
    objectIds: readonly string[],
    analysis: CutabilityAnalysisSummary,
  ): void {
    this.#entries.clear();
    this.#entries.set(
      this.key(document, objectIds),
      JSON.parse(JSON.stringify(analysis)) as CutabilityAnalysisSummary,
    );
  }

  public invalidate(): void {
    this.#entries.clear();
  }

  public get size(): number {
    return this.#entries.size;
  }
}
