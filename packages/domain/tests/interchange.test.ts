import {
  createBlankProject,
  flattenDocumentForInterchange,
} from "../src/index.js";
import { describe, expect, it } from "vitest";

describe("document interchange flattening", () => {
  it("normalizes nested transforms and reports hidden geometry", () => {
    const visibleLayerId = "00000000-0000-5000-8000-000000000001";
    const hiddenLayerId = "00000000-0000-5000-8000-000000000002";
    const project = createBlankProject({
      id: "00000000-0000-5000-8000-000000000003",
      now: "2026-07-31T00:00:00.000Z",
      layers: [
        { id: visibleLayerId, name: "Cut", visible: true, locked: false },
        { id: hiddenLayerId, name: "Notes", visible: false, locked: false },
      ],
      activeLayerId: visibleLayerId,
      objects: [
        {
          id: "00000000-0000-5000-8000-000000000004",
          type: "group",
          layerId: visibleLayerId,
          transform: { a: 1, b: 0, c: 0, d: 1, eMm: 10, fMm: 20 },
          children: [{
            id: "00000000-0000-5000-8000-000000000005",
            type: "line",
            layerId: visibleLayerId,
            transform: { a: 2, b: 0, c: 0, d: 2, eMm: 0, fMm: 0 },
            start: { xMm: 0, yMm: 0 },
            end: { xMm: 5, yMm: 10 },
          }],
        },
        {
          id: "00000000-0000-5000-8000-000000000006",
          type: "line",
          layerId: hiddenLayerId,
          transform: { a: 1, b: 0, c: 0, d: 1, eMm: 0, fMm: 0 },
          start: { xMm: 0, yMm: 0 },
          end: { xMm: 100, yMm: 100 },
        },
      ],
    });

    const result = flattenDocumentForInterchange(project.document);
    expect(result.paths).toEqual([{ layerName: "Cut", closed: false, points: [
      { xMm: 10, yMm: 20 },
      { xMm: 20, yMm: 40 },
    ] }]);
    expect(result.bounds).toEqual({ minXmm: 10, minYmm: 20, maxXmm: 20, maxYmm: 40 });
    expect(result.warnings).toMatchObject([{ code: "hidden-objects-skipped" }]);
  });

  it("rejects non-positive interchange tolerances", () => {
    const project = createBlankProject({
      id: "00000000-0000-5000-8000-000000000011",
      now: "2026-07-31T00:00:00.000Z",
    });
    expect(() => flattenDocumentForInterchange(project.document, 0)).toThrow(/positive/u);
  });
});
