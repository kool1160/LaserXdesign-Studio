import { describe, expect, it } from "vitest";

import {
  coordinateToMillimeters,
  createBlankProject,
  createDocument,
  deriveStableId,
  fromMillimeters,
  getDocumentBounds,
  identityTransform,
  nonnegativeLengthToMillimeters,
  setProjectDisplayUnit,
  setViewportPreferences,
  toMillimeters,
  type DocumentObject,
} from "../src/index.js";

const NOW = "2026-07-30T12:00:00.000Z";
const ID = "123e4567-e89b-42d3-a456-426614174000";
const LAYER_ID = deriveStableId(ID, "default-layer");

const objects: DocumentObject[] = [
  {
    id: "123e4567-e89b-42d3-a456-426614174010",
    type: "line",
    layerId: LAYER_ID,
    transform: identityTransform(),
    start: { xMm: 10, yMm: 20 },
    end: { xMm: 90, yMm: 80 },
  },
  {
    id: "123e4567-e89b-42d3-a456-426614174011",
    type: "rectangle",
    layerId: LAYER_ID,
    transform: identityTransform(),
    origin: { xMm: 100, yMm: 50 },
    widthMm: 40,
    heightMm: 30,
  },
  {
    id: "123e4567-e89b-42d3-a456-426614174012",
    type: "ellipse",
    layerId: LAYER_ID,
    transform: identityTransform(),
    center: { xMm: 170, yMm: 90 },
    radiusXmm: 20,
    radiusYmm: 10,
  },
  {
    id: "123e4567-e89b-42d3-a456-426614174013",
    type: "path",
    layerId: LAYER_ID,
    transform: identityTransform(),
    closed: true,
    points: [
      { xMm: 210, yMm: 20 },
      { xMm: 260, yMm: 20 },
      { xMm: 235, yMm: 60 },
    ],
  },
];

describe("canonical document model", () => {
  it("stores a 24 in by 12 in document exactly in millimeters", () => {
    const document = createDocument({
      id: ID,
      width: 24,
      height: 12,
      inputUnit: "inches",
    });
    expect(document.dimensions).toEqual({
      widthMm: 609.6,
      heightMm: 304.8,
    });
  });

  it("stores a 600 mm by 300 mm document without conversion", () => {
    const document = createDocument({
      id: ID,
      width: 600,
      height: 300,
      inputUnit: "millimeters",
    });
    expect(document.dimensions).toEqual({
      widthMm: 600,
      heightMm: 300,
    });
  });

  it("switches display units without mutating dimensions or geometry", () => {
    const project = createBlankProject({
      id: ID,
      now: NOW,
      width: 24,
      height: 12,
      inputUnit: "inches",
      objects,
    });
    const canonicalBefore = JSON.stringify({
      dimensions: project.document.dimensions,
      origin: project.document.origin,
      objects: project.document.objects,
    });
    let switched = project;
    for (let index = 0; index < 100; index += 1) {
      switched = setProjectDisplayUnit(
        switched,
        index % 2 === 0 ? "inches" : "millimeters",
        NOW,
      );
    }
    expect(
      JSON.stringify({
        dimensions: switched.document.dimensions,
        origin: switched.document.origin,
        objects: switched.document.objects,
      }),
    ).toBe(canonicalBefore);
    expect(switched.document.dimensions.widthMm).toBe(609.6);
  });

  it("uses exact inch conversion without repeated drift", () => {
    expect(toMillimeters(24, "inches")).toBe(609.6);
    expect(fromMillimeters(609.6, "inches")).toBe(24);
  });

  it("converts signed coordinates separately from nonnegative lengths", () => {
    expect(coordinateToMillimeters(0, "inches")).toBe(0);
    expect(coordinateToMillimeters(-2, "inches")).toBe(-50.8);
    expect(nonnegativeLengthToMillimeters(0, "millimeters")).toBe(0);
    expect(nonnegativeLengthToMillimeters(4, "inches")).toBe(101.6);
    expect(() =>
      nonnegativeLengthToMillimeters(-1, "millimeters"),
    ).toThrow("Length must be nonnegative and finite.");
  });

  it("defines stock bounds and includes populated placeholder bounds", () => {
    const empty = createDocument({
      id: ID,
      width: 100,
      height: 50,
      inputUnit: "millimeters",
    });
    expect(getDocumentBounds(empty)).toEqual({
      minXmm: 0,
      minYmm: 0,
      maxXmm: 100,
      maxYmm: 50,
    });
    const populated = { ...empty, objects };
    expect(getDocumentBounds(populated)).toEqual({
      minXmm: 0,
      minYmm: 0,
      maxXmm: 260,
      maxYmm: 100,
    });
  });

  it("persists viewport preferences canonically in millimeters", () => {
    const project = createBlankProject({ id: ID, now: NOW });
    const updated = setViewportPreferences(
      project,
      {
        gridVisible: false,
        gridSpacingMm: 12.7,
        snappingEnabled: true,
      },
      NOW,
    );
    expect(updated.document.settings.viewport).toMatchObject({
      gridVisible: false,
      gridSpacingMm: 12.7,
      snapping: { enabled: true },
    });
  });
});
