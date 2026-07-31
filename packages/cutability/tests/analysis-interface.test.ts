import { createDocument, identityTransform } from "@laserx/domain";
import { describe, expect, it } from "vitest";

import { analyzeDocumentCutability } from "../src/index.js";

const LAYER_ID = "10000000-0000-4000-8000-000000000001";
const CLOSED_ID = "20000000-0000-4000-8000-000000000001";
const OPEN_ID = "30000000-0000-4000-8000-000000000001";

describe("cutability analysis entry interface", () => {
  it("accepts traced editable paths and warns without claiming cut readiness", () => {
    const document = createDocument({
      id: "40000000-0000-4000-8000-000000000001",
      width: 200,
      height: 100,
      inputUnit: "millimeters",
      layers: [{ id: LAYER_ID, name: "Trace", visible: true, locked: false }],
      activeLayerId: LAYER_ID,
      objects: [
        {
          id: CLOSED_ID,
          type: "path",
          layerId: LAYER_ID,
          transform: identityTransform(),
          closed: true,
          points: [
            { xMm: 0, yMm: 0 },
            { xMm: 20, yMm: 0 },
            { xMm: 20, yMm: 10 },
          ],
        },
        {
          id: OPEN_ID,
          type: "path",
          layerId: LAYER_ID,
          transform: identityTransform(),
          closed: false,
          points: [
            { xMm: 0, yMm: 0 },
            { xMm: 2, yMm: 0 },
          ],
        },
      ],
    });

    const analysis = analyzeDocumentCutability(document, [CLOSED_ID, OPEN_ID]);
    expect(analysis).toMatchObject({
      status: "requires-settings",
      pathCount: 2,
      closedPathCount: 1,
      openPathCount: 1,
      cutReady: false,
    });
    expect(analysis.issues.map((issue) => issue.code)).toEqual([
      "process-settings-required",
      "open-contour",
    ]);
    expect(analysis.issues[1]).toMatchObject({
      objectId: OPEN_ID,
      measuredValueMm: null,
      configuredLimitMm: null,
    });
  });
});
