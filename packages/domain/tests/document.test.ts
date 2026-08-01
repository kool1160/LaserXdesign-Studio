import { describe, expect, it } from "vitest";

import {
  coordinateToMillimeters,
  createBlankProject,
  createDocument,
  deriveStableId,
  fromMillimeters,
  getDocumentBounds,
  getRegistrationCircleGeometry,
  identityTransform,
  isRegistrationCircleObject,
  nonnegativeLengthToMillimeters,
  setProjectDisplayUnit,
  setManufacturingSettings,
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

  it("recognizes only true world-space registration circles", () => {
    const circle = {
      id: "223e4567-e89b-42d3-a456-426614174020",
      type: "ellipse",
      layerId: LAYER_ID,
      transform: identityTransform(),
      center: { xMm: 10, yMm: 20 },
      radiusXmm: 3,
      radiusYmm: 3,
    } satisfies DocumentObject;
    expect(isRegistrationCircleObject(circle)).toBe(true);
    expect(getRegistrationCircleGeometry(circle)).toEqual({
      center: { xMm: 10, yMm: 20 },
      diameterMm: 6,
    });

    const rotatedAndScaled = {
      ...circle,
      transform: { a: 0, b: 2, c: -2, d: 0, eMm: 5, fMm: -2 },
    };
    expect(isRegistrationCircleObject(rotatedAndScaled)).toBe(true);
    expect(getRegistrationCircleGeometry(rotatedAndScaled)).toEqual({
      center: { xMm: -35, yMm: 18 },
      diameterMm: 12,
    });

    for (const invalid of [
      { ...circle, radiusXmm: 4 },
      {
        ...circle,
        transform: { a: 2, b: 0, c: 0, d: 1, eMm: 0, fMm: 0 },
      },
      {
        ...circle,
        transform: { a: 1, b: 0, c: 0.25, d: 1, eMm: 0, fMm: 0 },
      },
    ]) {
      expect(isRegistrationCircleObject(invalid)).toBe(false);
      expect(() => getRegistrationCircleGeometry(invalid)).toThrow(
        "true circle in world space",
      );
    }
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

  it("validates and copies editable manufacturing settings", () => {
    const project = createBlankProject({ id: ID, now: NOW });
    const original = project.document.settings.manufacturing;
    const updated = setManufacturingSettings(
      project,
      {
        ...original,
        process: "plasma",
        kerfWidthMm: 1.4,
        customizedFields: ["process", "kerfWidthMm"],
      },
      NOW,
    );
    expect(updated.document.settings.manufacturing).toMatchObject({
      process: "plasma",
      kerfWidthMm: 1.4,
      customizedFields: ["process", "kerfWidthMm"],
    });
    expect(project.document.settings.manufacturing).toEqual(original);
    expect(() =>
      setManufacturingSettings(
        project,
        { ...original, minimumGapMm: 0 },
        NOW,
      ),
    ).toThrow("Minimum gap must be positive and finite");
    expect(() =>
      setManufacturingSettings(
        project,
        { ...original, process: "torch" as never },
        NOW,
      ),
    ).toThrow("Manufacturing process is not supported");
  });
});
