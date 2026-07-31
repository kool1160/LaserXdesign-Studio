import { createDocument, type DocumentObject } from "@laserx/domain";
import {
  IDENTITY_AFFINE_TRANSFORM,
  screenToDomain,
} from "@laserx/geometry";
import { describe, expect, it } from "vitest";

import {
  createViewportScene,
  exactBoundsCommand,
  fitDocumentToView,
  formatDimensions,
  gridSpacingToMillimeters,
  keyboardMoveCommand,
  pointerMoveCommand,
  scaleCommandForHandle,
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
        layerId: empty.activeLayerId,
        transform: { ...IDENTITY_AFFINE_TRANSFORM },
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
    const blank = createDocument({
      id: "123e4567-e89b-42d3-a456-426614174000",
      width: 24,
      height: 12,
      inputUnit: "inches",
    });
    const document = {
      ...blank,
      objects: [
        {
          id: "123e4567-e89b-42d3-a456-426614174001",
          layerId: blank.activeLayerId,
          transform: { ...IDENTITY_AFFINE_TRANSFORM },
          type: "rectangle",
          origin: { xMm: 10, yMm: 10 },
          widthMm: 100,
          heightMm: 50,
        },
      ] satisfies DocumentObject[],
    };
    const viewport = fitDocumentToView(document, size);
    const scene = createViewportScene(document, viewport, size);
    expect(scene.objects[0]?.objectId).toBe(
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

  it("maps pointer and keyboard movement to equivalent domain commands", () => {
    const objectIds = ["123e4567-e89b-42d3-a456-426614174001"];
    const viewport = {
      originScreenXCssPx: 0,
      originScreenYCssPx: 200,
      zoomCssPxPerMm: 10,
    };
    const pointer = pointerMoveCommand(
      objectIds,
      { xCssPx: 100, yCssPx: 100 },
      { xCssPx: 110, yCssPx: 80 },
      viewport,
    );
    const keyboard = keyboardMoveCommand(objectIds, 1, 2);
    expect(pointer).toMatchObject(keyboard);
    expect(pointer.type).toBe("objects.move");
  });

  it("maps signed coordinates and zero line extents to exact bounds", () => {
    const objectId = "123e4567-e89b-42d3-a456-426614174001";
    expect(
      exactBoundsCommand(
        [objectId],
        { x: "0", y: "-2", width: "4", height: "0" },
        "inches",
        false,
      ),
    ).toEqual({
      type: "objects.set-bounds",
      objectIds: [objectId],
      xMm: 0,
      yMm: -50.8,
      widthMm: 101.6,
      heightMm: 0,
      lockAspectRatio: false,
    });
    expect(
      exactBoundsCommand(
        [objectId],
        { x: "", y: "0", width: "4", height: "0" },
        "inches",
        false,
      ),
    ).toBeNull();
    expect(
      exactBoundsCommand(
        [objectId],
        { x: "0", y: "0", width: "-1", height: "0" },
        "millimeters",
        false,
      ),
    ).toBeNull();
  });

  it("uses the edited dimension to drive locked exact sizing", () => {
    const objectId = "123e4567-e89b-42d3-a456-426614174001";
    const values = { x: "10", y: "20", width: "80", height: "100" };
    expect(
      exactBoundsCommand(
        [objectId],
        values,
        "millimeters",
        true,
        "height",
      ),
    ).toEqual({
      type: "objects.set-bounds",
      objectIds: [objectId],
      xMm: 10,
      yMm: 20,
      heightMm: 100,
      lockAspectRatio: true,
    });
    expect(
      exactBoundsCommand(
        [objectId],
        values,
        "millimeters",
        true,
        "width",
      ),
    ).toEqual({
      type: "objects.set-bounds",
      objectIds: [objectId],
      xMm: 10,
      yMm: 20,
      widthMm: 80,
      lockAspectRatio: true,
    });
  });

  it("applies uniform aspect locking to edge transform handles", () => {
    const objectIds = ["123e4567-e89b-42d3-a456-426614174001"];
    const bounds = {
      minXmm: 10,
      minYmm: 20,
      maxXmm: 90,
      maxYmm: 70,
    };
    expect(
      scaleCommandForHandle(
        objectIds,
        bounds,
        "east",
        { xMm: 130, yMm: 45 },
        true,
      ),
    ).toEqual({
      type: "objects.scale",
      objectIds,
      scaleX: 1.5,
      scaleY: 1.5,
      pivot: { xMm: 10, yMm: 45 },
    });
    expect(
      scaleCommandForHandle(
        objectIds,
        bounds,
        "north",
        { xMm: 50, yMm: 95 },
        true,
      ),
    ).toEqual({
      type: "objects.scale",
      objectIds,
      scaleX: 1.5,
      scaleY: 1.5,
      pivot: { xMm: 50, yMm: 20 },
    });
  });

  it("projects the complete transform-handle set for a selection", () => {
    const blank = createDocument({
      id: "123e4567-e89b-42d3-a456-426614174000",
      width: 200,
      height: 100,
      inputUnit: "millimeters",
    });
    const objectId = "123e4567-e89b-42d3-a456-426614174001";
    const document = {
      ...blank,
      objects: [
        {
          id: objectId,
          layerId: blank.activeLayerId,
          transform: { ...IDENTITY_AFFINE_TRANSFORM },
          type: "rectangle",
          origin: { xMm: 10, yMm: 10 },
          widthMm: 20,
          heightMm: 10,
        },
      ] satisfies DocumentObject[],
    };
    const viewport = fitDocumentToView(document, size);
    const scene = createViewportScene(
      document,
      viewport,
      size,
      [objectId],
    );
    expect(scene.selection?.handles.map((handle) => handle.kind)).toEqual([
      "north-west",
      "north",
      "north-east",
      "east",
      "south-east",
      "south",
      "south-west",
      "west",
      "rotate",
    ]);
  });
});
