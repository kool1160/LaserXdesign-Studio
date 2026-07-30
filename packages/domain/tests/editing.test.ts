import {
  COORDINATE_TOLERANCE_MM,
  boundsCenter,
  boundsWidth,
  rotationTransformAt,
} from "@laserx/geometry";
import { describe, expect, it } from "vitest";

import {
  applyEditorCommand,
  createDocument,
  getObjectBounds,
  hitTestDocument,
  identityTransform,
  marqueeHitTest,
  type DocumentObject,
  type LaserxDocument,
  type Layer,
} from "../src/index.js";

const DOCUMENT_ID = "10000000-0000-4000-8000-000000000000";
const LAYER_ONE = "20000000-0000-4000-8000-000000000000";
const LAYER_TWO = "30000000-0000-4000-8000-000000000000";
const LAYER_THREE = "40000000-0000-4000-8000-000000000000";
const RECT_ONE = "50000000-0000-4000-8000-000000000000";
const RECT_TWO = "60000000-0000-4000-8000-000000000000";
const RECT_THREE = "70000000-0000-4000-8000-000000000000";
const GROUP_ID = "80000000-0000-4000-8000-000000000000";

const layers: Layer[] = [
  { id: LAYER_ONE, name: "Artwork", visible: true, locked: false },
  { id: LAYER_TWO, name: "Locked", visible: true, locked: true },
  { id: LAYER_THREE, name: "Hidden", visible: false, locked: false },
];

function rectangle(
  id: string,
  layerId: string,
  xMm: number,
  yMm: number,
  widthMm = 20,
  heightMm = 10,
): DocumentObject {
  return {
    id,
    type: "rectangle",
    layerId,
    transform: identityTransform(),
    origin: { xMm, yMm },
    widthMm,
    heightMm,
  };
}

function editingDocument(): LaserxDocument {
  return createDocument({
    id: DOCUMENT_ID,
    width: 200,
    height: 100,
    inputUnit: "millimeters",
    layers,
    activeLayerId: LAYER_ONE,
    guides: [
      {
        id: "90000000-0000-4000-8000-000000000000",
        axis: "x",
        positionMm: 75,
      },
    ],
    objects: [
      rectangle(RECT_ONE, LAYER_ONE, 10, 10),
      rectangle(RECT_TWO, LAYER_ONE, 50, 10),
      rectangle(RECT_THREE, LAYER_TWO, 90, 10),
      rectangle(
        "71000000-0000-4000-8000-000000000000",
        LAYER_THREE,
        130,
        10,
      ),
    ],
  });
}

function geometryWithoutTransform(object: DocumentObject): object {
  const { transform, ...geometry } = object;
  expect(transform).toBeDefined();
  return geometry;
}

describe("editing domain", () => {
  it("moves, sizes, rotates, and mirrors exact world bounds", () => {
    let document = editingDocument();
    document = applyEditorCommand(document, {
      type: "objects.move",
      objectIds: [RECT_ONE],
      deltaXmm: 5,
      deltaYmm: 7,
    });
    expect(getObjectBounds(document.objects[0] as DocumentObject)).toEqual({
      minXmm: 15,
      minYmm: 17,
      maxXmm: 35,
      maxYmm: 27,
    });

    document = applyEditorCommand(document, {
      type: "objects.set-bounds",
      objectIds: [RECT_ONE],
      xMm: 30,
      yMm: 20,
      widthMm: 40,
      lockAspectRatio: true,
    });
    const sized = getObjectBounds(document.objects[0] as DocumentObject);
    expect(sized).toEqual({
      minXmm: 30,
      minYmm: 20,
      maxXmm: 70,
      maxYmm: 40,
    });

    document = applyEditorCommand(document, {
      type: "objects.rotate",
      objectIds: [RECT_ONE],
      angleDeg: 90,
      pivot: boundsCenter(sized),
    });
    const rotated = getObjectBounds(document.objects[0] as DocumentObject);
    expect(rotated).toEqual({
      minXmm: 40,
      minYmm: 10,
      maxXmm: 60,
      maxYmm: 50,
    });

    document = applyEditorCommand(document, {
      type: "objects.mirror",
      objectIds: [RECT_ONE],
      axis: "vertical",
      pivot: boundsCenter(rotated),
    });
    expect(getObjectBounds(document.objects[0] as DocumentObject)).toEqual(
      rotated,
    );
  });

  it("excludes locked and hidden layers from hit testing and edits", () => {
    const original = editingDocument();
    expect(
      hitTestDocument({
        document: original,
        point: { xMm: 95, yMm: 15 },
        toleranceMm: 1,
      }),
    ).toEqual([]);
    expect(
      hitTestDocument({
        document: original,
        point: { xMm: 135, yMm: 15 },
        toleranceMm: 1,
      }),
    ).toEqual([]);
    expect(
      marqueeHitTest(original, {
        minXmm: 80,
        minYmm: 0,
        maxXmm: 160,
        maxYmm: 40,
      }),
    ).toEqual([]);

    const attempted = applyEditorCommand(original, {
      type: "objects.move",
      objectIds: [RECT_THREE],
      deltaXmm: 50,
      deltaYmm: 50,
    });
    expect(attempted.objects).toEqual(original.objects);
  });

  it("uses transformed shape geometry instead of filled bounding boxes", () => {
    const document = createDocument({
      id: DOCUMENT_ID,
      width: 100,
      height: 100,
      inputUnit: "millimeters",
      layers: [layers[0] as Layer],
      activeLayerId: LAYER_ONE,
      objects: [
        {
          id: RECT_ONE,
          type: "path",
          layerId: LAYER_ONE,
          transform: identityTransform(),
          closed: true,
          points: [
            { xMm: 0, yMm: 0 },
            { xMm: 20, yMm: 0 },
            { xMm: 0, yMm: 20 },
          ],
        },
        {
          id: RECT_TWO,
          type: "ellipse",
          layerId: LAYER_ONE,
          transform: rotationTransformAt(45, { xMm: 50, yMm: 50 }),
          center: { xMm: 50, yMm: 50 },
          radiusXmm: 20,
          radiusYmm: 10,
        },
      ],
    });
    expect(
      hitTestDocument({
        document,
        point: { xMm: 18, yMm: 18 },
        toleranceMm: 0,
      }),
    ).toEqual([]);
    expect(
      hitTestDocument({
        document,
        point: { xMm: 65, yMm: 65 },
        toleranceMm: 0,
      }),
    ).toEqual([]);
    const ellipseBounds = getObjectBounds(
      document.objects[1] as DocumentObject,
    );
    expect(ellipseBounds.maxXmm).toBeCloseTo(
      50 + Math.sqrt(250),
      9,
    );
    expect(ellipseBounds.maxYmm).toBeCloseTo(
      50 + Math.sqrt(250),
      9,
    );
  });

  it("groups, transforms, and ungroups without changing child geometry or IDs", () => {
    let document = applyEditorCommand(editingDocument(), {
      type: "objects.group",
      objectIds: [RECT_ONE, RECT_TWO],
      groupId: GROUP_ID,
      layerId: LAYER_ONE,
    });
    const group = document.objects.find((object) => object.id === GROUP_ID);
    expect(group?.type).toBe("group");
    if (group?.type !== "group") {
      throw new Error("Expected a group.");
    }
    const childGeometry = group.children.map(geometryWithoutTransform);
    const pivot = boundsCenter(getObjectBounds(group));
    document = applyEditorCommand(document, {
      type: "objects.rotate",
      objectIds: [GROUP_ID],
      angleDeg: 90,
      pivot,
    });
    const transformedGroup = document.objects.find(
      (object) => object.id === GROUP_ID,
    );
    if (transformedGroup?.type !== "group") {
      throw new Error("Expected a transformed group.");
    }
    const expectedBounds = new Map(
      transformedGroup.children.map((child) => [
        child.id,
        getObjectBounds(child, transformedGroup.transform),
      ]),
    );

    document = applyEditorCommand(document, {
      type: "objects.ungroup",
      objectIds: [GROUP_ID],
    });
    expect(document.objects.some((object) => object.id === GROUP_ID)).toBe(
      false,
    );
    for (const childId of [RECT_ONE, RECT_TWO]) {
      const child = document.objects.find((object) => object.id === childId);
      expect(child).toBeDefined();
      expect(getObjectBounds(child as DocumentObject)).toEqual(
        expectedBounds.get(childId),
      );
    }
    expect(
      document.objects
        .filter((object) => [RECT_ONE, RECT_TWO].includes(object.id))
        .map(geometryWithoutTransform),
    ).toEqual(childGeometry);
  });

  it("duplicates with new IDs and preserves originals and z order", () => {
    const duplicateId = "a0000000-0000-4000-8000-000000000000";
    let document = applyEditorCommand(editingDocument(), {
      type: "objects.duplicate",
      objectIds: [RECT_ONE],
      idMap: { [RECT_ONE]: duplicateId },
      offsetXmm: 10,
      offsetYmm: 10,
    });
    expect(document.objects.map((object) => object.id)).toContain(RECT_ONE);
    const duplicate = document.objects.find(
      (object) => object.id === duplicateId,
    );
    expect(getObjectBounds(duplicate as DocumentObject)).toEqual({
      minXmm: 20,
      minYmm: 20,
      maxXmm: 40,
      maxYmm: 30,
    });

    document = applyEditorCommand(document, {
      type: "objects.z-order",
      objectIds: [RECT_ONE],
      action: "bring-front",
    });
    const artworkIds = document.objects
      .filter((object) => object.layerId === LAYER_ONE)
      .map((object) => object.id);
    expect(artworkIds.at(-1)).toBe(RECT_ONE);

    document = applyEditorCommand(document, {
      type: "objects.delete",
      objectIds: [duplicateId],
    });
    expect(document.objects.some((object) => object.id === duplicateId)).toBe(
      false,
    );
  });

  it("aligns and distributes three objects deterministically", () => {
    const thirdId = "b0000000-0000-4000-8000-000000000000";
    let document = editingDocument();
    document = applyEditorCommand(document, {
      type: "objects.insert",
      objects: [rectangle(thirdId, LAYER_ONE, 110, 40)],
    });
    document = applyEditorCommand(document, {
      type: "objects.align",
      objectIds: [RECT_ONE, RECT_TWO, thirdId],
      alignment: "bottom",
    });
    expect(
      [RECT_ONE, RECT_TWO, thirdId].map((id) =>
        getObjectBounds(
          document.objects.find((object) => object.id === id) as DocumentObject,
        ).minYmm,
      ),
    ).toEqual([10, 10, 10]);

    document = applyEditorCommand(document, {
      type: "objects.distribute",
      objectIds: [RECT_ONE, RECT_TWO, thirdId],
      distribution: "horizontal",
    });
    const centers = [RECT_ONE, RECT_TWO, thirdId].map((id) =>
      boundsCenter(
        getObjectBounds(
          document.objects.find((object) => object.id === id) as DocumentObject,
        ),
      ).xMm,
    );
    expect(centers).toEqual([20, 70, 120]);
  });

  it("snaps moves to grid, guides, document bounds, and object centers", () => {
    let document = editingDocument();
    document.settings.viewport.snapping.enabled = true;
    document.settings.viewport.gridSpacingMm = 10;
    document = applyEditorCommand(document, {
      type: "objects.move",
      objectIds: [RECT_ONE],
      deltaXmm: 9.8,
      deltaYmm: -9.7,
      snapToleranceMm: 0.5,
    });
    const gridSnapped = getObjectBounds(
      document.objects.find((object) => object.id === RECT_ONE) as DocumentObject,
    );
    expect(gridSnapped.minXmm).toBe(20);
    expect(gridSnapped.minYmm).toBe(0);

    document.settings.viewport.snapping.snapToGrid = false;
    document = applyEditorCommand(document, {
      type: "objects.move",
      objectIds: [RECT_ONE],
      deltaXmm: 34.8,
      deltaYmm: 0,
      snapToleranceMm: 0.5,
    });
    const guideSnapped = getObjectBounds(
      document.objects.find((object) => object.id === RECT_ONE) as DocumentObject,
    );
    expect(guideSnapped.maxXmm).toBe(75);

    expect(
      Math.abs(boundsWidth(guideSnapped) - 20),
    ).toBeLessThanOrEqual(COORDINATE_TOLERANCE_MM);
  });

  it("renames, reorders, locks, hides, activates, and deletes layers", () => {
    let document = editingDocument();
    document = applyEditorCommand(document, {
      type: "layer.rename",
      layerId: LAYER_ONE,
      name: "Cut artwork",
    });
    document = applyEditorCommand(document, {
      type: "layer.reorder",
      layerId: LAYER_THREE,
      toIndex: 0,
    });
    document = applyEditorCommand(document, {
      type: "layer.set-locked",
      layerId: LAYER_ONE,
      locked: true,
    });
    document = applyEditorCommand(document, {
      type: "layer.set-visibility",
      layerId: LAYER_ONE,
      visible: false,
    });
    document = applyEditorCommand(document, {
      type: "layer.activate",
      layerId: LAYER_TWO,
    });
    expect(document.layers[0]?.id).toBe(LAYER_THREE);
    expect(document.layers.find((layer) => layer.id === LAYER_ONE)).toMatchObject(
      { name: "Cut artwork", locked: true, visible: false },
    );
    expect(document.activeLayerId).toBe(LAYER_TWO);

    document = applyEditorCommand(document, {
      type: "layer.delete",
      layerId: LAYER_THREE,
      fallbackLayerId: LAYER_TWO,
    });
    expect(document.layers.some((layer) => layer.id === LAYER_THREE)).toBe(
      false,
    );
    expect(
      document.objects
        .filter((object) =>
          object.id.startsWith("71000000"),
        )
        .every((object) => object.layerId === LAYER_TWO),
    ).toBe(true);
  });

  it("preserves exact dimensions through repeated matrix transforms", () => {
    let document = editingDocument();
    for (let index = 0; index < 100; index += 1) {
      const object = document.objects.find(
        (candidate) => candidate.id === RECT_ONE,
      ) as DocumentObject;
      const pivot = boundsCenter(getObjectBounds(object));
      document = applyEditorCommand(document, {
        type: "objects.rotate",
        objectIds: [RECT_ONE],
        angleDeg: 3.6,
        pivot,
      });
    }
    const object = document.objects.find(
      (candidate) => candidate.id === RECT_ONE,
    ) as DocumentObject;
    const expected = rotationTransformAt(360, { xMm: 20, yMm: 15 });
    expect(object.transform.a).toBeCloseTo(expected.a, 9);
    expect(boundsWidth(getObjectBounds(object))).toBeCloseTo(20, 9);
  });
});
