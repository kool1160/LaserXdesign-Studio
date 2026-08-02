import {
  createBlankProject,
  identityTransform,
  type AffineTransformMm,
  type GroupObject,
  type LaserxProject,
  type Layer,
  type PathObject,
  type RectangleObject,
} from "@laserx/domain";
import { describe, expect, it } from "vitest";

import { buildPhysicalPreviewScene } from "../src/index.js";

const FACE_ID = "11111111-1111-4111-8111-111111111111";
const PREVIEW_ID = "22222222-2222-4222-8222-222222222222";
const RECT_ID = "33333333-3333-4333-8333-333333333333";
const HOLE_ID = "44444444-4444-4444-8444-444444444444";

function faceLayer(id: string, name: string, role: "face" | "non-cut-preview"): Layer {
  return {
    id,
    name,
    visible: true,
    locked: false,
    manufacturing: {
      role,
      material: "mild-steel",
      thicknessMm: 3,
      stockThicknessDesignation: { kind: "millimeter", label: "3 mm", material: null },
      process: role === "non-cut-preview" ? "non-cut" : "laser",
      notes: "",
      registrationGroup: null,
      registrationHoleIds: [],
    },
  };
}

function singleLayerProject(): LaserxProject {
  return createBlankProject({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    documentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Face Plate",
    now: "2026-08-02T12:00:00.000Z",
    width: 300,
    height: 200,
    inputUnit: "millimeters",
    layers: [faceLayer(FACE_ID, "Face", "face"), faceLayer(PREVIEW_ID, "LED preview", "non-cut-preview")],
    activeLayerId: FACE_ID,
    objects: [
      {
        id: RECT_ID,
        type: "rectangle",
        layerId: FACE_ID,
        transform: identityTransform(),
        origin: { xMm: 20, yMm: 30 },
        widthMm: 160,
        heightMm: 80,
      },
      {
        id: HOLE_ID,
        type: "ellipse",
        layerId: FACE_ID,
        transform: identityTransform(),
        center: { xMm: 60, yMm: 60 },
        radiusXmm: 10,
        radiusYmm: 10,
      },
      {
        id: "99999999-9999-4999-8999-999999999999",
        type: "ellipse",
        layerId: PREVIEW_ID,
        transform: identityTransform(),
        center: { xMm: 100, yMm: 70 },
        radiusXmm: 20,
        radiusYmm: 20,
      },
    ],
  });
}

const OPEN_LAYER_ID = "55555555-5555-4555-8555-555555555555";
const OPEN_PATH_ID = "66666666-6666-4666-8666-666666666666";

function openContourProject(): LaserxProject {
  const openPath: PathObject = {
    id: OPEN_PATH_ID,
    type: "path",
    layerId: OPEN_LAYER_ID,
    transform: identityTransform(),
    closed: false,
    points: [
      { xMm: 10, yMm: 10 },
      { xMm: 90, yMm: 10 },
      { xMm: 90, yMm: 90 },
    ],
  };
  return createBlankProject({
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    documentId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    name: "Open Contour",
    now: "2026-08-02T12:00:00.000Z",
    width: 100,
    height: 100,
    inputUnit: "millimeters",
    layers: [faceLayer(OPEN_LAYER_ID, "Face", "face")],
    activeLayerId: OPEN_LAYER_ID,
    objects: [openPath],
  });
}

const STENCIL_ID = "77777777-7777-4777-8777-777777777777";

/**
 * Same three-square point sets as cutability's own reviewed
 * "nested-stencil-regions" golden (fixtures/cutability/m08-rule-goldens.json)
 * — reused here to pin the opposite (extrusion) polarity deliberately, per
 * ENGINE_DECISION.md's "Resolved contour-polarity question".
 */
function stencilProject(): LaserxProject {
  function square(id: string, minMm: number, maxMm: number): PathObject {
    return {
      id,
      type: "path",
      layerId: STENCIL_ID,
      transform: identityTransform(),
      closed: true,
      points: [
        { xMm: minMm, yMm: minMm },
        { xMm: maxMm, yMm: minMm },
        { xMm: maxMm, yMm: maxMm },
        { xMm: minMm, yMm: maxMm },
      ],
    };
  }
  return createBlankProject({
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    documentId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    name: "Stencil",
    now: "2026-08-02T12:00:00.000Z",
    width: 200,
    height: 150,
    inputUnit: "millimeters",
    layers: [faceLayer(STENCIL_ID, "Face", "face")],
    activeLayerId: STENCIL_ID,
    objects: [
      square("88888888-8888-4888-8888-888888888881", 10, 110),
      square("88888888-8888-4888-8888-888888888882", 30, 90),
      square("88888888-8888-4888-8888-888888888883", 45, 75),
    ],
  });
}

const TRANSFORM_LAYER_ID = "aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa";
const GROUP_ID = "bbbbbbbb-2222-4bbb-8bbb-bbbbbbbbbbbb";
const RECT_CHILD_ID = "cccccccc-3333-4ccc-8ccc-cccccccccccc";
const HOLE_CHILD_ID = "dddddddd-4444-4ddd-8ddd-dddddddddddd";

/**
 * Group transform {a:0,b:2,c:-2,d:0} is an exact scale-by-2-then-rotate-90°
 * matrix (integer coefficients, no trig calls, so world points are exact
 * with no floating-point flattening noise): world = (50 - 2*y, 2*x + 20).
 * Composed with each child's own translation, this proves the adapter
 * applies parent-then-child transform composition, not just a flat offset.
 */
function transformedGroupProject(): LaserxProject {
  const groupTransform: AffineTransformMm = { a: 0, b: 2, c: -2, d: 0, eMm: 50, fMm: 20 };
  const rectChildTransform: AffineTransformMm = { a: 1, b: 0, c: 0, d: 1, eMm: 3, fMm: 4 };
  const holeChildTransform: AffineTransformMm = { a: 1, b: 0, c: 0, d: 1, eMm: 8, fMm: 7 };

  const rectangle: RectangleObject = {
    id: RECT_CHILD_ID,
    type: "rectangle",
    layerId: TRANSFORM_LAYER_ID,
    transform: rectChildTransform,
    origin: { xMm: 0, yMm: 0 },
    widthMm: 10,
    heightMm: 6,
  };
  const hole: PathObject = {
    id: HOLE_CHILD_ID,
    type: "path",
    layerId: TRANSFORM_LAYER_ID,
    transform: holeChildTransform,
    closed: true,
    points: [
      { xMm: 0, yMm: 0 },
      { xMm: 2, yMm: 0 },
      { xMm: 2, yMm: 2 },
      { xMm: 0, yMm: 2 },
    ],
  };
  const group: GroupObject = {
    id: GROUP_ID,
    type: "group",
    layerId: TRANSFORM_LAYER_ID,
    transform: groupTransform,
    children: [rectangle, hole],
  };

  const layer = faceLayer(TRANSFORM_LAYER_ID, "Face", "face");
  if (layer.manufacturing === undefined) throw new Error("Expected manufacturing metadata.");
  layer.manufacturing.thicknessMm = 4;
  layer.manufacturing.stockThicknessDesignation = {
    kind: "millimeter",
    label: "4 mm",
    material: null,
  };

  return createBlankProject({
    id: "11110000-0000-4000-8000-000000000000",
    documentId: "22220000-0000-4000-8000-000000000000",
    name: "Transformed Group",
    now: "2026-08-02T12:00:00.000Z",
    width: 200,
    height: 150,
    inputUnit: "millimeters",
    layers: [layer],
    activeLayerId: TRANSFORM_LAYER_ID,
    objects: [group],
  });
}

describe("buildPhysicalPreviewScene", () => {
  it("extrudes a single physical layer with a through-hole and preserves exact dimensions", () => {
    const scene = buildPhysicalPreviewScene(singleLayerProject(), { layerId: FACE_ID });

    expect(scene.layers).toHaveLength(1);
    const layer = scene.layers[0];
    if (layer === undefined) throw new Error("Expected the face layer.");
    expect(layer.role).toBe("face");
    expect(layer.thicknessMm).toBe(3);
    expect(layer.material.material).toBe("mild-steel");
    expect(layer.material.displayLabel).toContain("3 mm");
    expect(layer.shapes).toHaveLength(1);
    const shape = layer.shapes[0];
    if (shape === undefined) throw new Error("Expected the face shape.");
    expect(shape.outerContour.points).toHaveLength(4);
    expect(shape.holeContours).toHaveLength(1);
    expect(shape.sourceObjectIds).toEqual(
      expect.arrayContaining([RECT_ID, HOLE_ID]),
    );
    expect(layer.boundsMm).toEqual({
      minXmm: 20,
      minYmm: 30,
      maxXmm: 180,
      maxYmm: 110,
    });
    expect(scene.findings).toEqual([]);
    expect(scene.stockMm).toEqual({ widthMm: 300, heightMm: 200 });
  });

  it("rejects a non-cut-preview layer as a physical preview scope", () => {
    expect(() =>
      buildPhysicalPreviewScene(singleLayerProject(), { layerId: PREVIEW_ID }),
    ).toThrow("physical manufacturing layer");
  });

  it("rejects an unknown layer id", () => {
    expect(() =>
      buildPhysicalPreviewScene(singleLayerProject(), { layerId: "does-not-exist" }),
    ).toThrow("does not exist");
  });

  it("previews a physical layer regardless of its editor visibility toggle", () => {
    const project = singleLayerProject();
    const face = project.document.layers.find((candidate) => candidate.id === FACE_ID);
    if (face === undefined) throw new Error("Expected the face layer.");
    face.visible = false;

    const scene = buildPhysicalPreviewScene(project, { layerId: FACE_ID });
    expect(scene.layers[0]?.shapes).toHaveLength(1);
  });

  it("surfaces open geometry as a finding tied to the source object instead of a shape", () => {
    const scene = buildPhysicalPreviewScene(openContourProject(), { layerId: OPEN_LAYER_ID });

    expect(scene.layers[0]?.shapes).toEqual([]);
    expect(scene.layers[0]?.boundsMm).toBeNull();
    expect(scene.findings).toContainEqual(
      expect.objectContaining({ code: "OPEN_CONTOUR", objectIds: [OPEN_PATH_ID] }),
    );
  });

  it("classifies nested regions with extrusion polarity, opposite of cutability's own disposition", () => {
    const scene = buildPhysicalPreviewScene(stencilProject(), { layerId: STENCIL_ID });
    const shapes = scene.layers[0]?.shapes ?? [];
    expect(shapes).toHaveLength(2);

    const outer = shapes.find((shape) => shape.holeContours.length === 1);
    const island = shapes.find((shape) => shape.holeContours.length === 0);
    if (outer === undefined || island === undefined) {
      throw new Error("Expected one holed outer shape and one solid island.");
    }
    expect(outer.outerContour.points).toEqual([
      { xMm: 10, yMm: 10 },
      { xMm: 110, yMm: 10 },
      { xMm: 110, yMm: 110 },
      { xMm: 10, yMm: 110 },
    ]);
    expect(outer.holeContours[0]?.points).toEqual([
      { xMm: 30, yMm: 30 },
      { xMm: 90, yMm: 30 },
      { xMm: 90, yMm: 90 },
      { xMm: 30, yMm: 90 },
    ]);
    expect(island.outerContour.points).toEqual([
      { xMm: 45, yMm: 45 },
      { xMm: 75, yMm: 45 },
      { xMm: 75, yMm: 75 },
      { xMm: 45, yMm: 75 },
    ]);
  });

  it("is deterministic and changes its fingerprint only when the scene changes", () => {
    const first = buildPhysicalPreviewScene(singleLayerProject(), { layerId: FACE_ID });
    const second = buildPhysicalPreviewScene(singleLayerProject(), { layerId: FACE_ID });
    expect(second).toEqual(first);
    expect(first.fingerprint).toBe(second.fingerprint);
    expect(first.fingerprint.length).toBeGreaterThan(0);

    const thicker = singleLayerProject();
    const face = thicker.document.layers.find((candidate) => candidate.id === FACE_ID);
    if (face?.manufacturing === undefined) throw new Error("Expected face metadata.");
    face.manufacturing.thicknessMm = 6;
    face.manufacturing.stockThicknessDesignation = {
      kind: "millimeter",
      label: "6 mm",
      material: null,
    };
    const third = buildPhysicalPreviewScene(thicker, { layerId: FACE_ID });
    expect(third.fingerprint).not.toBe(first.fingerprint);
  });

  it("never mutates the source project snapshot", () => {
    const project = singleLayerProject();
    const before = structuredClone(project);
    buildPhysicalPreviewScene(project, { layerId: FACE_ID });
    expect(project).toEqual(before);
  });

  it("returns a detached stockThicknessDesignation that can be mutated without touching the source project", () => {
    const project = singleLayerProject();
    const face = project.document.layers.find((candidate) => candidate.id === FACE_ID);
    if (face?.manufacturing === undefined) throw new Error("Expected face metadata.");
    const sourceDesignation = face.manufacturing.stockThicknessDesignation;
    const before = structuredClone(project);

    const scene = buildPhysicalPreviewScene(project, { layerId: FACE_ID });
    const returnedDesignation = scene.layers[0]?.material.stockThicknessDesignation;
    if (returnedDesignation === null || returnedDesignation === undefined) {
      throw new Error("Expected a stock thickness designation.");
    }
    expect(returnedDesignation).not.toBe(sourceDesignation);
    expect(returnedDesignation).toEqual(sourceDesignation);

    returnedDesignation.label = "MUTATED";

    expect(project).toEqual(before);
    expect(face.manufacturing.stockThicknessDesignation?.label).toBe("3 mm");
  });

  it("preserves exact world-space geometry through a transformed group and transformed child geometry (translation + rotation + scale)", () => {
    const project = transformedGroupProject();
    const before = structuredClone(project);

    const first = buildPhysicalPreviewScene(project, { layerId: TRANSFORM_LAYER_ID });
    const layer = first.layers[0];
    if (layer === undefined) throw new Error("Expected the transformed layer.");
    expect(layer.thicknessMm).toBe(4);
    expect(layer.shapes).toHaveLength(1);
    const shape = layer.shapes[0];
    if (shape === undefined) throw new Error("Expected the transformed shape.");

    // Outer rectangle: local (0,0)-(10,6) -> +child translate(3,4) ->
    // +group scale2/rotate90/translate(50,20) -> exact axis-aligned world rect.
    expect(shape.outerContour.points).toEqual([
      { xMm: 42, yMm: 26 },
      { xMm: 42, yMm: 46 },
      { xMm: 30, yMm: 46 },
      { xMm: 30, yMm: 26 },
    ]);
    // Hole square: local (0,0)-(2,2) -> +child translate(8,7) -> +group transform.
    expect(shape.holeContours).toHaveLength(1);
    expect(shape.holeContours[0]?.points).toEqual([
      { xMm: 36, yMm: 36 },
      { xMm: 36, yMm: 40 },
      { xMm: 32, yMm: 40 },
      { xMm: 32, yMm: 36 },
    ]);
    expect(layer.boundsMm).toEqual({
      minXmm: 30,
      minYmm: 26,
      maxXmm: 42,
      maxYmm: 46,
    });
    expect(first.findings).toEqual([]);

    const second = buildPhysicalPreviewScene(transformedGroupProject(), {
      layerId: TRANSFORM_LAYER_ID,
    });
    expect(second).toEqual(first);
    expect(second.fingerprint).toBe(first.fingerprint);

    expect(project).toEqual(before);
  });
});
