import { readFileSync } from "node:fs";

import { analyzeDocumentCutability } from "@laserx/cutability";
import { createDocument, getSelectionBounds, type SignTemplateKind, type SignTemplateShape } from "@laserx/domain";
import { createFontSource, FontEngine } from "@laserx/fonts";
import { describe, expect, it } from "vitest";

import { generateSignToolCandidate, type SignGenerationContext } from "../src/index.js";

interface GoldenCase {
  name: string;
  kind: SignTemplateKind;
  stylePresetId: string;
  primaryText: string;
  secondaryText: string;
  arcRadiusMm: number | null;
  expectedShape: SignTemplateShape;
  expectedFontId: string;
  expectedObjectCount: number;
}

const golden = JSON.parse(readFileSync(
  new URL("../../../fixtures/sign-tools/m09-template-goldens.json", import.meta.url),
  "utf8",
)) as { schemaVersion: 1; cases: GoldenCase[] };

const reviewedFonts = [
  {
    id: "bundled:saira-stencil-one",
    family: "Saira Stencil One",
    file: "@fontsource/saira-stencil-one/files/saira-stencil-one-latin-400-normal.woff2",
    spdx: "OFL-1.1" as const,
  },
  {
    id: "bundled:roboto-slab",
    family: "Roboto Slab",
    file: "@fontsource-variable/roboto-slab/files/roboto-slab-latin-wght-normal.woff2",
    spdx: "Apache-2.0" as const,
  },
  {
    id: "bundled:rye",
    family: "Rye",
    file: "@fontsource/rye/files/rye-latin-400-normal.woff2",
    spdx: "OFL-1.1" as const,
  },
].map((font) => createFontSource({
  id: font.id,
  family: font.family,
  style: "Regular",
  source: "bundled",
  categories: ["display"],
  license: {
    spdx: font.spdx,
    copyright: "Reviewed bundled fixture",
    licenseFile: font.spdx === "Apache-2.0"
      ? "packages/fonts/licenses/Apache-2.0.txt"
      : "packages/fonts/licenses/OFL-1.1.txt",
    provenance: font.file,
  },
}, readFileSync(new URL(`../../fonts/node_modules/${font.file}`, import.meta.url))));

function fixtureContext(): SignGenerationContext {
  let sequence = 1;
  const fontEngine = new FontEngine(reviewedFonts);
  return {
    document: createDocument({
      id: "00000000-0000-4000-8000-000000000001",
      width: 24,
      height: 12,
      inputUnit: "inches",
    }),
    selectedObjectIds: [],
    createId: () => `90000000-0000-4000-8000-${String(sequence++).padStart(12, "0")}`,
    layoutText: (request) => fontEngine.layout(request),
  };
}

describe("reviewed M09 representative sign goldens", () => {
  expect(golden.schemaVersion).toBe(1);
  for (const fixture of golden.cases) {
    it(`${fixture.name} remains editable, analyzable, and exactly 24 inches wide`, () => {
      const context = fixtureContext();
      const candidate = generateSignToolCandidate({
        kind: "template",
        stylePresetId: fixture.stylePresetId,
        parameters: {
          kind: fixture.kind,
          shape: "rectangle",
          widthMm: 609.6,
          heightMm: 304.8,
          borderWidthMm: 12,
          holeDiameterMm: 6,
          holeInsetMm: 25.4,
          fontId: "ignored:style-controls-font",
          fontSizeMm: 42,
          primaryText: fixture.primaryText,
          secondaryText: fixture.secondaryText,
          arcRadiusMm: fixture.arcRadiusMm,
        },
      }, context);
      expect(candidate.objects).toHaveLength(fixture.expectedObjectCount);
      expect(candidate.template?.parameters).toMatchObject({
        shape: fixture.expectedShape,
        fontId: fixture.expectedFontId,
      });
      expect(candidate.layers.map((layer) => layer.name)).toEqual([
        "Sign Backing",
        "Sign Detail",
        "Mounting Holes",
      ]);
      const accepted = {
        ...context.document,
        layers: [...context.document.layers, ...candidate.layers],
        objects: [...context.document.objects, ...candidate.objects],
      };
      const bounds = getSelectionBounds(accepted, candidate.objects.map((object) => object.id));
      if (bounds === null) throw new Error("Representative sign bounds are missing.");
      expect(bounds.maxXmm - bounds.minXmm).toBeCloseTo(609.6, 6);
      const analysis = analyzeDocumentCutability(
        accepted,
        candidate.objects.map((object) => object.id),
      );
      expect(
        analysis.status,
        JSON.stringify(analysis.issues.map((issue) => ({
          code: issue.code,
          objectId: issue.objectId,
          message: issue.message,
        }))),
      ).toBe("complete");
      expect(candidate.summary.provenanceIds.length).toBeGreaterThanOrEqual(2);
    }, 15_000);
  }
});
