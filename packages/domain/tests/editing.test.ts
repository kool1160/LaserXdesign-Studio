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
  objectUsesLayerRecursively,
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
const HORIZONTAL_LINE = "81000000-0000-4000-8000-000000000000";
const VERTICAL_LINE = "82000000-0000-4000-8000-000000000000";

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

function line(
  id: string,
  layerId: string,
  start: { xMm: number; yMm: number },
  end: { xMm: number; yMm: number },
): DocumentObject {
  return {
    id,
    type: "line",
    layerId,
    transform: identityTransform(),
    start,
    end,
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

  it("preserves aspect ratio from either exact dimension", () => {
    let document = editingDocument();
    document = applyEditorCommand(document, {
      type: "objects.set-bounds",
      objectIds: [RECT_ONE],
      heightMm: 30,
      lockAspectRatio: true,
    });
    expect(getObjectBounds(document.objects[0] as DocumentObject)).toEqual({
      minXmm: 10,
      minYmm: 10,
      maxXmm: 70,
      maxYmm: 40,
    });

    document = applyEditorCommand(document, {
      type: "objects.set-bounds",
      objectIds: [RECT_ONE],
      widthMm: 40,
      lockAspectRatio: true,
    });
    const resized = getObjectBounds(document.objects[0] as DocumentObject);
    expect(resized.minXmm).toBeCloseTo(10, 9);
    expect(resized.minYmm).toBeCloseTo(10, 9);
    expect(resized.maxXmm).toBeCloseTo(50, 9);
    expect(resized.maxYmm).toBeCloseTo(30, 9);
  });

  it("moves and resizes each nonzero axis of horizontal and vertical lines", () => {
    let document = createDocument({
      id: DOCUMENT_ID,
      width: 200,
      height: 100,
      inputUnit: "millimeters",
      layers,
      activeLayerId: LAYER_ONE,
      objects: [
        line(
          HORIZONTAL_LINE,
          LAYER_ONE,
          { xMm: 10, yMm: 20 },
          { xMm: 90, yMm: 20 },
        ),
        line(
          VERTICAL_LINE,
          LAYER_ONE,
          { xMm: 50, yMm: 10 },
          { xMm: 50, yMm: 60 },
        ),
      ],
    });

    document = applyEditorCommand(document, {
      type: "objects.set-bounds",
      objectIds: [HORIZONTAL_LINE],
      xMm: 0,
      yMm: -25,
      widthMm: 120,
      heightMm: 0,
      lockAspectRatio: false,
    });
    const horizontal = document.objects.find(
      (object) => object.id === HORIZONTAL_LINE,
    ) as DocumentObject;
    expect(getObjectBounds(horizontal)).toEqual({
      minXmm: 0,
      minYmm: -25,
      maxXmm: 120,
      maxYmm: -25,
    });
    expect(Object.values(horizontal.transform).every(Number.isFinite)).toBe(
      true,
    );

    document = applyEditorCommand(document, {
      type: "objects.set-bounds",
      objectIds: [VERTICAL_LINE],
      xMm: -10,
      yMm: 0,
      widthMm: 0,
      heightMm: 80,
      lockAspectRatio: false,
    });
    const vertical = document.objects.find(
      (object) => object.id === VERTICAL_LINE,
    ) as DocumentObject;
    expect(getObjectBounds(vertical)).toEqual({
      minXmm: -10,
      minYmm: 0,
      maxXmm: -10,
      maxYmm: 80,
    });
    expect(Object.values(vertical.transform).every(Number.isFinite)).toBe(
      true,
    );

    expect(() =>
      applyEditorCommand(document, {
        type: "objects.set-bounds",
        objectIds: [HORIZONTAL_LINE],
        heightMm: 5,
        lockAspectRatio: false,
      }),
    ).toThrow("current height is zero");
    expect(() =>
      applyEditorCommand(document, {
        type: "objects.set-bounds",
        objectIds: [VERTICAL_LINE],
        widthMm: 5,
        lockAspectRatio: false,
      }),
    ).toThrow("current width is zero");
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
    expect(objectUsesLayerRecursively(group)).toBe(true);
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

  it("rejects inserted groups whose descendants use locked or hidden layers", () => {
    for (const childLayerId of [LAYER_TWO, LAYER_THREE]) {
      const childId =
        childLayerId === LAYER_TWO
          ? "83000000-0000-4000-8000-000000000000"
          : "84000000-0000-4000-8000-000000000000";
      expect(() =>
        applyEditorCommand(editingDocument(), {
          type: "objects.insert",
          objects: [
            {
              id:
                childLayerId === LAYER_TWO
                  ? "85000000-0000-4000-8000-000000000000"
                  : "86000000-0000-4000-8000-000000000000",
              type: "group",
              layerId: LAYER_ONE,
              transform: identityTransform(),
              children: [
                rectangle(childId, childLayerId, 10, 10),
              ],
            },
          ],
        }),
      ).toThrow("must use the group's layer");
    }
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

  it("keeps an exact non-grid snap ahead of a nearby grid candidate", () => {
    let document = editingDocument();
    document.settings.viewport.gridSpacingMm = 10;
    document.settings.viewport.snapping = {
      enabled: true,
      snapToGrid: true,
      snapToGuides: true,
      snapToObjects: true,
      snapToDocument: true,
    };

    document = applyEditorCommand(document, {
      type: "objects.move",
      objectIds: [RECT_ONE],
      deltaXmm: 45,
      deltaYmm: 0,
      snapToleranceMm: 6,
    });

    expect(
      getObjectBounds(
        document.objects.find(
          (object) => object.id === RECT_ONE,
        ) as DocumentObject,
      ),
    ).toEqual({
      minXmm: 55,
      minYmm: 10,
      maxXmm: 75,
      maxYmm: 20,
    });
  });

  it("renames, reorders, locks, hides, activates, and deletes layers", () => {
    let document = editingDocument();
    document = applyEditorCommand(document, {
      type: "objects.insert",
      objects: [
        {
          id: "87000000-0000-4000-8000-000000000000",
          type: "group",
          layerId: LAYER_THREE,
          transform: identityTransform(),
          children: [
            rectangle(
              "88000000-0000-4000-8000-000000000000",
              LAYER_THREE,
              150,
              40,
            ),
          ],
        },
      ],
    });
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
          ["71000000", "87000000"].some((prefix) =>
            object.id.startsWith(prefix),
          ),
        )
        .every(
          (object) =>
            object.layerId === LAYER_TWO &&
            objectUsesLayerRecursively(object, LAYER_TWO),
        ),
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

  it("preserves path identity and closure across node and curve edits", () => {
    const pathId = "90000000-0000-4000-8000-000000000000";
    let document = editingDocument();
    document.objects.push({
      id: pathId,
      type: "path",
      layerId: LAYER_ONE,
      transform: identityTransform(),
      closed: true,
      points: [
        { xMm: 0, yMm: 0 },
        { xMm: 20, yMm: 0 },
        { xMm: 20, yMm: 20 },
        { xMm: 0, yMm: 20 },
      ],
    });
    document = applyEditorCommand(document, {
      type: "path.add-node",
      objectId: pathId,
      segmentIndex: 0,
      ratio: 0.5,
    });
    document = applyEditorCommand(document, {
      type: "path.move-nodes",
      objectId: pathId,
      nodeIndices: [1],
      deltaXmm: 0,
      deltaYmm: 2,
    });
    document = applyEditorCommand(document, {
      type: "path.set-handle",
      objectId: pathId,
      nodeIndex: 1,
      handle: "outgoing",
      point: { xMm: 14, yMm: 6 },
    });
    const path = document.objects.find((object) => object.id === pathId);
    expect(path).toMatchObject({
      id: pathId,
      type: "path",
      closed: true,
    });
    expect(path?.type === "path" ? path.points : []).toHaveLength(5);
    expect(path?.type === "path" ? path.handles?.[1]?.outgoing : null).toEqual({
      xMm: 14,
      yMm: 6,
    });
  });

  it("rejects invalid path topology at generated-command boundaries", () => {
    const document = editingDocument();
    expect(() =>
      applyEditorCommand(document, {
        type: "objects.insert",
        objects: [
          {
            id: "91000000-0000-4000-8000-000000000000",
            type: "path",
            layerId: LAYER_ONE,
            transform: identityTransform(),
            closed: true,
            points: [
              { xMm: 0, yMm: 0 },
              { xMm: 10, yMm: 0 },
            ],
          },
        ],
      }),
    ).toThrow(/path geometry is invalid/);
    expect(() =>
      applyEditorCommand(document, {
        type: "objects.insert",
        objects: [
          {
            id: "92000000-0000-4000-8000-000000000000",
            type: "path",
            layerId: LAYER_ONE,
            transform: identityTransform(),
            closed: false,
            points: [
              { xMm: 0, yMm: 0 },
              { xMm: 10, yMm: 0 },
            ],
            handles: [{ incoming: null, outgoing: null }],
          },
        ],
      }),
    ).toThrow(/path geometry is invalid/);
  });
});
