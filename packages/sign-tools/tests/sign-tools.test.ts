import {
  createDocument,
  getObjectBounds,
  identityTransform,
  type LaserxDocument,
  type RectangleObject,
} from "@laserx/domain";
import { describe, expect, it } from "vitest";

import { generateSignToolCandidate, type SignGenerationContext } from "../src/index.js";

const LAYER_ID = "10000000-0000-4000-8000-000000000001";
const RECT_ID = "20000000-0000-4000-8000-000000000001";

function idFactory() {
  let sequence = 1;
  return () => `30000000-0000-4000-8000-${String(sequence++).padStart(12, "0")}`;
}

function documentWithRectangle(): LaserxDocument {
  const rectangle: RectangleObject = {
    id: RECT_ID,
    type: "rectangle",
    layerId: LAYER_ID,
    transform: identityTransform(),
    origin: { xMm: 50, yMm: 40 },
    widthMm: 100,
    heightMm: 60,
  };
  return createDocument({
    id: "00000000-0000-4000-8000-000000000001",
    width: 24,
    height: 12,
    inputUnit: "inches",
    layers: [{ id: LAYER_ID, name: "Artwork", visible: true, locked: false }],
    activeLayerId: LAYER_ID,
    objects: [rectangle],
  });
}

function context(selectedObjectIds: readonly string[] = [RECT_ID]): SignGenerationContext {
  return {
    document: documentWithRectangle(),
    selectedObjectIds,
    createId: idFactory(),
    layoutText(request) {
      return {
        font: {
          id: request.fontId,
          family: "Fixture Font",
          style: "Regular",
          fingerprint: "a".repeat(64),
        },
        contours: [{
          compoundIndex: 0,
          closed: true,
          points: [
            { xMm: -20, yMm: -5 },
            { xMm: 20, yMm: -5 },
            { xMm: 20, yMm: 5 },
            { xMm: -20, yMm: 5 },
          ],
        }],
        bounds: { minXmm: -20, minYmm: -5, maxXmm: 20, maxYmm: 5 },
        missingCodePoints: [],
      };
    },
  };
}

describe("M09 exact sign generators", () => {
  it("creates exact algorithmic outer shapes and backing bounds", () => {
    const candidate = generateSignToolCandidate({
      kind: "outer-shape",
      shape: "rounded-rectangle",
      widthMm: 609.6,
      heightMm: 304.8,
      cornerRadiusMm: 25.4,
    }, context([]));
    expect(candidate.layers).toHaveLength(1);
    expect(candidate.objects).toHaveLength(1);
    const outer = candidate.objects[0];
    if (outer === undefined) throw new Error("Expected an outer-shape object.");
    expect(getObjectBounds(outer)).toEqual({
      minXmm: 0,
      minYmm: 0,
      maxXmm: 609.6,
      maxYmm: 304.8,
    });

    const backing = generateSignToolCandidate({
      kind: "backing-plate",
      shape: "rectangle",
      marginMm: 10,
      cornerRadiusMm: 0,
    }, context());
    const plate = backing.objects[0];
    if (plate === undefined) throw new Error("Expected a backing-plate object.");
    expect(getObjectBounds(plate)).toEqual({
      minXmm: 40,
      minYmm: 30,
      maxXmm: 160,
      maxYmm: 110,
    });
  });

  it("generates an exact two-contour border from selected geometry", () => {
    const candidate = generateSignToolCandidate({
      kind: "border",
      offsetMm: 2,
      widthMm: 3,
      join: "miter",
    }, context());
    expect(candidate.objects).toHaveLength(2);
    expect(candidate.objects.map((object) => getObjectBounds(object))).toEqual([
      { minXmm: 45, minYmm: 35, maxXmm: 155, maxYmm: 105 },
      { minXmm: 48, minYmm: 38, maxXmm: 152, maxYmm: 102 },
    ]);
  });

  it("keeps mounting-hole diameters and centers exact across display-unit changes", () => {
    const millimeterContext = context([]);
    const inchesContext = context([]);
    inchesContext.document.settings.displayUnit = "inches";
    const request = {
      kind: "mounting-holes" as const,
      columns: 2,
      rows: 1,
      diameterMm: 6.35,
      insetXmm: 25.4,
      insetYmm: 25.4,
    };
    const first = generateSignToolCandidate(request, millimeterContext).objects;
    const second = generateSignToolCandidate(request, inchesContext).objects;
    expect(second.map((object) => getObjectBounds(object))).toEqual(
      first.map((object) => getObjectBounds(object)),
    );
    expect(first.map((object) => object.type === "ellipse" ? object.center : null)).toEqual([
      { xMm: 25.4, yMm: 152.4 },
      { xMm: 584.2, yMm: 152.4 },
    ]);
  });

  it("limits tabs and slots to exact selected-edge features", () => {
    const candidate = generateSignToolCandidate({
      kind: "assembly",
      feature: "slots",
      edge: "top",
      count: 3,
      widthMm: 10,
      depthMm: 4,
    }, context());
    expect(candidate.objects).toHaveLength(3);
    expect(candidate.objects.map((object) => getObjectBounds(object))).toEqual([
      { minXmm: 70, minYmm: 96, maxXmm: 80, maxYmm: 100 },
      { minXmm: 95, minYmm: 96, maxXmm: 105, maxYmm: 100 },
      { minXmm: 120, minYmm: 96, maxXmm: 130, maxYmm: 100 },
    ]);
  });
});
