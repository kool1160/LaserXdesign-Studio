import { describe, expect, it } from "vitest";

import {
  applyEditorCommand,
  createDocument,
  getObjectBounds,
  hitTestDocument,
  identityTransform,
  type TextObject,
} from "../src/index.js";

const LAYER_ID = "10000000-0000-4000-8000-000000000000";
const TEXT_ID = "20000000-0000-4000-8000-000000000000";
const GROUP_ID = "30000000-0000-4000-8000-000000000000";
const CONTOUR_ID = "40000000-0000-4000-8000-000000000000";
const COUNTER_ID = "41000000-0000-4000-8000-000000000000";
const OVERLAP_ID = "42000000-0000-4000-8000-000000000000";

function textObject(): TextObject {
  return {
    id: TEXT_ID,
    type: "text",
    layerId: LAYER_ID,
    transform: identityTransform(),
    content: "OO",
    origin: { xMm: 10, yMm: 20 },
    style: {
      fontId: "bundled:noto-sans",
      fontFamily: "Noto Sans",
      fontStyle: "Regular",
      fontFingerprint: "a".repeat(64),
      sizeMm: 20,
      trackingMm: 0,
      wordSpacingMm: 0,
      lineSpacing: 1.2,
      alignment: "left",
    },
    arc: null,
    contours: [
      {
        compoundIndex: 0,
        closed: true,
        points: [
          { xMm: 0, yMm: 0 },
          { xMm: 12, yMm: 0 },
          { xMm: 12, yMm: 18 },
          { xMm: 0, yMm: 18 },
        ],
      },
      {
        compoundIndex: 0,
        closed: true,
        points: [
          { xMm: 3, yMm: 4 },
          { xMm: 9, yMm: 4 },
          { xMm: 9, yMm: 14 },
          { xMm: 3, yMm: 14 },
        ],
      },
      {
        compoundIndex: 1,
        closed: true,
        points: [
          { xMm: 8, yMm: 0 },
          { xMm: 18, yMm: 0 },
          { xMm: 18, yMm: 18 },
          { xMm: 8, yMm: 18 },
        ],
      },
    ],
    missingFont: false,
  };
}

describe("editable text", () => {
  it("uses materialized contours for exact bounds", () => {
    expect(getObjectBounds(textObject())).toEqual({
      minXmm: 10,
      minYmm: 20,
      maxXmm: 28,
      maxYmm: 38,
    });
  });

  it("converts text to paths and optionally preserves source metadata", () => {
    const document = createDocument({
      id: "50000000-0000-4000-8000-000000000000",
      width: 100,
      height: 100,
      inputUnit: "millimeters",
      layers: [
        { id: LAYER_ID, name: "Artwork", visible: true, locked: false },
      ],
      activeLayerId: LAYER_ID,
      objects: [textObject()],
    });
    const converted = applyEditorCommand(document, {
      type: "objects.convert-text",
      objectIds: [TEXT_ID],
      groupIds: { [TEXT_ID]: GROUP_ID },
      contourIds: { [TEXT_ID]: [CONTOUR_ID, COUNTER_ID, OVERLAP_ID] },
      preserveSource: true,
    });
    const group = converted.objects[0];
    if (group === undefined) {
      throw new Error("Expected converted outline group.");
    }
    expect(group).toMatchObject({
      id: GROUP_ID,
      type: "group",
      sourceText: { content: "OO" },
    });
    if (group.type !== "group") {
      throw new Error("Expected a group.");
    }
    expect(group.children[0]).toMatchObject({
      id: CONTOUR_ID,
      type: "path",
    });
    expect(
      group.children[0]?.type === "path"
        ? group.children[0].points.slice(0, 2)
        : [],
    ).toEqual([
      { xMm: 10, yMm: 20 },
      { xMm: 22, yMm: 20 },
    ]);
    expect(group.children[1]).toMatchObject({
      id: COUNTER_ID,
      type: "path",
    });
    expect(group.children[2]).toMatchObject({
      id: OVERLAP_ID,
      type: "path",
    });
    expect(group.children).toHaveLength(3);
    expect(getObjectBounds(group)).toEqual(getObjectBounds(textObject()));
  });

  it("keeps counters empty while unioning overlapping glyph compounds", () => {
    const document = createDocument({
      id: "50000000-0000-4000-8000-000000000000",
      width: 100,
      height: 100,
      inputUnit: "millimeters",
      layers: [
        { id: LAYER_ID, name: "Artwork", visible: true, locked: false },
      ],
      activeLayerId: LAYER_ID,
      objects: [textObject()],
    });
    expect(
      hitTestDocument({
        document,
        point: { xMm: 11, yMm: 29 },
        toleranceMm: 0,
      }),
    ).toMatchObject([{ objectId: TEXT_ID, distanceMm: 0 }]);
    expect(
      hitTestDocument({
        document,
        point: { xMm: 16, yMm: 29 },
        toleranceMm: 0,
      }),
    ).toEqual([]);
    expect(
      hitTestDocument({
        document,
        point: { xMm: 20, yMm: 29 },
        toleranceMm: 0,
      }),
    ).toMatchObject([{ objectId: TEXT_ID, distanceMm: 0 }]);
  });
});
