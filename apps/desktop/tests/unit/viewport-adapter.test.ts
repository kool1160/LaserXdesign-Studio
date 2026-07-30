import { createDocument, type DocumentObject } from "@laserx/domain";
import { screenToDomain } from "@laserx/geometry";
import { describe, expect, it } from "vitest";

import {
  createViewportScene,
  fitDocumentToView,
  formatDimensions,
  gridSpacingToMillimeters,
} from "../../src/lib/viewport-adapter.js";

const size = {
  widthCssPx: 1_000,
  heightCssPx: 700,
  devicePixelRatio: 1,
};

describe("renderer viewport adapter", () => {
  it("fits empty and populated documents using domain bounds", () => {
    const empty = createDocument({
      id: "123e4567-e89b-42d3-a456-426614174000",
      width: 600,
      height: 300,
      inputUnit: "millimeters",
    });
    const populatedObjects: DocumentObject[] = [
      {
        id: "123e4567-e89b-42d3-a456-426614174001",
        type: "line",
        start: { xMm: -100, yMm: -50 },
        end: { xMm: 700, yMm: 350 },
      },
    ];
    const populated = { ...empty, objects: populatedObjects };
    const emptyFit = fitDocumentToView(empty, size);
    const populatedFit = fitDocumentToView(populated, size);
    expect(populatedFit.zoomCssPxPerMm).toBeLessThan(
      emptyFit.zoomCssPxPerMm,
    );
  });

  it("adapts objects to screen primitives without changing their IDs", () => {
    const document = createDocument({
      id: "123e4567-e89b-42d3-a456-426614174000",
      width: 24,
      height: 12,
      inputUnit: "inches",
      objects: [
        {
          id: "123e4567-e89b-42d3-a456-426614174001",
          type: "rectangle",
          origin: { xMm: 10, yMm: 10 },
          widthMm: 100,
          heightMm: 50,
        },
      ],
    });
    const viewport = fitDocumentToView(document, size);
    const scene = createViewportScene(document, viewport, size);
    expect(scene.objects[0]?.id).toBe(
      "123e4567-e89b-42d3-a456-426614174001",
    );
    expect(screenToDomain(
      {
        xCssPx: scene.stock.xCssPx,
        yCssPx: scene.stock.yCssPx + scene.stock.heightCssPx,
      },
      viewport,
    )).toEqual({ xMm: 0, yMm: 0 });
    expect(
      scene.horizontalTicks
        .filter((tick) => tick.major)
        .every((tick) =>
          Number.isInteger(Math.round((tick.valueMm / 25.4) * 1e9) / 1e9),
        ),
    ).toBe(true);
  });

  it("formats and converts display values at the adapter boundary", () => {
    const document = createDocument({
      id: "123e4567-e89b-42d3-a456-426614174000",
      width: 24,
      height: 12,
      inputUnit: "inches",
    });
    expect(formatDimensions(document)).toBe("24 × 12 in");
    expect(gridSpacingToMillimeters(0.5, "inches")).toBe(12.7);
  });
});
