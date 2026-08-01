import { readFileSync } from "node:fs";

import { createDocument, identityTransform, type PathObject } from "@laserx/domain";
import { describe, expect, it } from "vitest";

import { analyzeDocumentCutability, type CutabilityIssueCode } from "../src/index.js";

interface GoldenFile {
  schemaVersion: 1;
  assumption: string;
  cases: Array<{
    name: string;
    paths: Array<{
      id: string;
      closed: boolean;
      points: Array<[number, number]>;
    }>;
    expectedStatus: "complete" | "ambiguous";
    expectedRegions: Array<"retained" | "removed" | "ambiguous">;
    requiredCodes: CutabilityIssueCode[];
    forbiddenCodes: CutabilityIssueCode[];
  }>;
}

const LAYER_ID = "10000000-0000-4000-8000-000000000001";
const golden = JSON.parse(
  readFileSync(
    new URL("../../../fixtures/cutability/m08-rule-goldens.json", import.meta.url),
    "utf8",
  ),
) as GoldenFile;

describe("M08 reviewed cutability goldens", () => {
  for (const fixture of golden.cases) {
    it(fixture.name, () => {
      const objects = fixture.paths.map<PathObject>((path) => ({
        id: path.id,
        type: "path",
        layerId: LAYER_ID,
        transform: identityTransform(),
        closed: path.closed,
        points: path.points.map(([xMm, yMm]) => ({ xMm, yMm })),
      }));
      const document = createDocument({
        id: "f0000000-0000-4000-8000-000000000001",
        width: 200,
        height: 150,
        inputUnit: "millimeters",
        layers: [{ id: LAYER_ID, name: "Fixture", visible: true, locked: false }],
        activeLayerId: LAYER_ID,
        objects,
      });
      const analysis = analyzeDocumentCutability(document);
      const codes = new Set(analysis.issues.map((issue) => issue.code));
      expect(analysis.previewAssumption).toBe(golden.assumption);
      expect(analysis.status).toBe(fixture.expectedStatus);
      expect(analysis.regions.map((region) => region.disposition)).toEqual(
        fixture.expectedRegions,
      );
      for (const code of fixture.requiredCodes) expect(codes.has(code)).toBe(true);
      for (const code of fixture.forbiddenCodes) expect(codes.has(code)).toBe(false);
      expect(analysis.issues.every(
        (issue) =>
          Number.isFinite(issue.measuredValueMm) &&
          Number.isFinite(issue.configuredLimitMm),
      )).toBe(true);
    });
  }
});
