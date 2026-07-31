import { performance } from "node:perf_hooks";

import {
  createDocument,
  identityTransform,
  type PathObject,
} from "@laserx/domain";
import { describe, expect, it } from "vitest";

import { analyzeDocumentCutability } from "../src/index.js";

const GROSS_REGRESSION_LIMIT_MS = 5_000;
const LAYER_ID = "10000000-0000-4000-8000-000000000001";

function rectangleGrid(): PathObject[] {
  return Array.from({ length: 400 }, (_, index) => {
    const column = index % 20;
    const row = Math.floor(index / 20);
    const xMm = column * 6;
    const yMm = row * 6;
    return {
      id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      type: "path",
      layerId: LAYER_ID,
      transform: identityTransform(),
      closed: true,
      points: [
        { xMm, yMm },
        { xMm: xMm + 3, yMm },
        { xMm: xMm + 3, yMm: yMm + 3 },
        { xMm, yMm: yMm + 3 },
      ],
    };
  });
}

describe("M08 cutability performance baseline", () => {
  it("analyzes 400 separated contours without a gross regression", () => {
    const document = createDocument({
      id: "30000000-0000-4000-8000-000000000001",
      width: 125,
      height: 125,
      inputUnit: "millimeters",
      layers: [{ id: LAYER_ID, name: "Grid", visible: true, locked: false }],
      activeLayerId: LAYER_ID,
      objects: rectangleGrid(),
    });
    const startedAt = performance.now();
    const analysis = analyzeDocumentCutability(document);
    const durationMs = performance.now() - startedAt;

    console.info("M08 cutability performance", JSON.stringify({
      contourCount: analysis.pathCount,
      segmentCount: analysis.segmentCount,
      durationMs,
    }));
    expect(analysis.pathCount).toBe(400);
    expect(analysis.segmentCount).toBe(1_600);
    expect(durationMs).toBeLessThan(GROSS_REGRESSION_LIMIT_MS);
  });
});
