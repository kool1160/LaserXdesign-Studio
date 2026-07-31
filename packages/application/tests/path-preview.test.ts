import { identityTransform, type PathObject } from "@laserx/domain";
import { describe, expect, it } from "vitest";

import { previewSelectedPathJoin } from "../src/index.js";

const LAYER_ID = "10000000-0000-4000-8000-000000000000";

function path(
  id: string,
  points: Array<{ xMm: number; yMm: number }>,
  layerId = LAYER_ID,
): PathObject {
  return {
    id,
    type: "path",
    layerId,
    transform: identityTransform(),
    closed: false,
    points,
  };
}

describe("path join preview", () => {
  it("uses transformed world endpoints and the same tolerance decision as join", () => {
    const first = path("20000000-0000-4000-8000-000000000000", [
      { xMm: 0, yMm: 0 },
      { xMm: 10, yMm: 0 },
    ]);
    first.transform.eMm = 5;
    const second = path("30000000-0000-4000-8000-000000000000", [
      { xMm: 15.04, yMm: 0 },
      { xMm: 25, yMm: 0 },
    ]);
    const preview = previewSelectedPathJoin([first, second], 0.05);
    expect(preview).toMatchObject({
      firstEnd: "end",
      secondEnd: "start",
      withinTolerance: true,
    });
    expect(preview?.distanceMm).toBeCloseTo(0.04, 9);
    expect(
      previewSelectedPathJoin([first, second], 0.01)?.withinTolerance,
    ).toBe(false);
  });

  it("does not preview a join across layers", () => {
    const first = path("40000000-0000-4000-8000-000000000000", [
      { xMm: 0, yMm: 0 },
      { xMm: 10, yMm: 0 },
    ]);
    const second = path(
      "50000000-0000-4000-8000-000000000000",
      [
        { xMm: 10.01, yMm: 0 },
        { xMm: 20, yMm: 0 },
      ],
      "60000000-0000-4000-8000-000000000000",
    );
    expect(previewSelectedPathJoin([first, second], 0.1)).toBeNull();
  });
});
