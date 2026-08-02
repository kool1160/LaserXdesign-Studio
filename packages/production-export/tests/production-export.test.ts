import {
  createBlankProject,
  identityTransform,
  type LaserxProject,
  type Layer,
} from "@laserx/domain";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  buildProductionPackage,
  manufacturingLayerObjectIds,
} from "../src/index.js";

const FACE_ID = "11111111-1111-4111-8111-111111111111";
const BACK_ID = "22222222-2222-4222-8222-222222222222";
const PREVIEW_ID = "33333333-3333-4333-8333-333333333333";
const SPACER_ID = "99999999-9999-4999-8999-999999999999";
const FACE_HOLE_ID = "55555555-5555-4555-8555-555555555555";
const BACK_HOLE_ID = "77777777-7777-4777-8777-777777777777";

function layer(
  id: string,
  name: string,
  role: "face" | "backing" | "spacer-tab" | "non-cut-preview",
): Layer {
  return {
    id,
    name,
    visible: true,
    locked: false,
    manufacturing: {
      role,
      material: role === "backing" ? "acrylic" : "mild-steel",
      thicknessMm: role === "backing" ? 6 : 3,
      stockThicknessDesignation: {
        kind: "millimeter",
        label: role === "backing" ? "6 mm" : "3 mm",
        material: null,
      },
      process: role === "non-cut-preview" ? "non-cut" : "laser",
      notes: `${name} material note`,
      registrationGroup:
        role === "face" || role === "backing" ? "main" : null,
      registrationHoleIds:
        role === "face"
          ? [FACE_HOLE_ID]
          : role === "backing"
            ? [BACK_HOLE_ID]
            : [],
    },
  };
}

function goldenSummary(productionPackage: ReturnType<typeof buildProductionPackage>) {
  return {
    files: productionPackage.files.map((file) => file.name),
    roles: productionPackage.manifest.layers.map((item) => item.role),
    originMm: productionPackage.manifest.originMm,
    stockMm: productionPackage.manifest.stockMm,
    registrationHoleKeys: (productionPackage.manifest.layers[0]?.registrationHoles ?? [])
      .map((hole) => [hole.xMm, hole.yMm, hole.diameterMm]
        .map((value) => value.toFixed(6)).join(":")),
  };
}

const goldens = JSON.parse(readFileSync(
  new URL("../../../fixtures/production/m12-package-goldens.json", import.meta.url),
  "utf8",
)) as { twoLayer: unknown; threeLayer: unknown };

function project(): LaserxProject {
  return createBlankProject({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    documentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Three Layer Sign",
    now: "2026-08-01T12:00:00.000Z",
    width: 300,
    height: 200,
    inputUnit: "millimeters",
    layers: [
      layer(FACE_ID, "Face", "face"),
      layer(BACK_ID, "Backing", "backing"),
      layer(PREVIEW_ID, "LED preview", "non-cut-preview"),
    ],
    activeLayerId: FACE_ID,
    objects: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        type: "rectangle",
        layerId: FACE_ID,
        transform: identityTransform(),
        origin: { xMm: 20, yMm: 30 },
        widthMm: 160,
        heightMm: 80,
      },
      {
        id: "45555555-5555-4555-8555-555555555551",
        type: "ellipse",
        layerId: FACE_ID,
        transform: identityTransform(),
        center: { xMm: 100, yMm: 50 },
        radiusXmm: 20,
        radiusYmm: 8,
      },
      {
        id: "45555555-5555-4555-8555-555555555552",
        type: "ellipse",
        layerId: FACE_ID,
        transform: identityTransform(),
        center: { xMm: 140, yMm: 60 },
        radiusXmm: 12,
        radiusYmm: 12,
      },
      {
        id: FACE_HOLE_ID,
        type: "ellipse",
        layerId: FACE_ID,
        transform: identityTransform(),
        center: { xMm: 40, yMm: 50 },
        radiusXmm: 3,
        radiusYmm: 3,
      },
      {
        id: "66666666-6666-4666-8666-666666666666",
        type: "rectangle",
        layerId: BACK_ID,
        transform: identityTransform(),
        origin: { xMm: 10, yMm: 20 },
        widthMm: 180,
        heightMm: 100,
      },
      {
        id: "67777777-7777-4777-8777-777777777771",
        type: "ellipse",
        layerId: BACK_ID,
        transform: identityTransform(),
        center: { xMm: 120, yMm: 80 },
        radiusXmm: 18,
        radiusYmm: 9,
      },
      {
        id: "67777777-7777-4777-8777-777777777772",
        type: "ellipse",
        layerId: BACK_ID,
        transform: identityTransform(),
        center: { xMm: 160, yMm: 70 },
        radiusXmm: 10,
        radiusYmm: 10,
      },
      {
        id: BACK_HOLE_ID,
        type: "ellipse",
        layerId: BACK_ID,
        transform: identityTransform(),
        center: { xMm: 40, yMm: 50 },
        radiusXmm: 3,
        radiusYmm: 3,
      },
      {
        id: "88888888-8888-4888-8888-888888888888",
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

describe("production package export", () => {
  it("exports deterministic exact-scale artifacts and an accurate manifest", () => {
    const first = buildProductionPackage(project());
    const second = buildProductionPackage(project());

    expect(second).toEqual(first);
    expect(first.files.map((file) => file.name)).toEqual([
      "01-face-face.svg",
      "01-face-face.dxf",
      "02-backing-backing.svg",
      "02-backing-backing.dxf",
      "manifest.json",
    ]);
    const svgFiles = first.files.filter((file) => file.format === "svg");
    expect(svgFiles).toHaveLength(2);
    expect(svgFiles.every((file) => file.content.includes('viewBox="0 0 300 200"'))).toBe(true);
    expect(first.manifest.originMm).toEqual({ xMm: 0, yMm: 0 });
    expect(first.manifest.stockMm).toEqual({ widthMm: 300, heightMm: 200 });
    expect(first.manifest.layers.map((item) => item.objectCount)).toEqual([4, 4]);
    expect(first.manifest.layers.map((item) => item.stockThicknessDesignation)).toEqual([
      { kind: "millimeter", label: "3 mm", material: null },
      { kind: "millimeter", label: "6 mm", material: null },
    ]);
    expect(first.manifest.layers[0]?.registrationHoles).toEqual([
      { objectId: FACE_HOLE_ID, xMm: 40, yMm: 50, diameterMm: 6 },
    ]);
    expect(first.manifest.layers[1]?.registrationHoles).toEqual([
      { objectId: BACK_HOLE_ID, xMm: 40, yMm: 50, diameterMm: 6 },
    ]);
    expect(first.manifest.warnings).not.toContainEqual(
      expect.stringContaining("not numerically aligned"),
    );
    expect(first.manifest.warnings).toContain(
      "1 non-cut preview layer(s) were intentionally excluded from manufacturing files.",
    );
    expect(first.files.every((file) => file.layerId !== PREVIEW_ID)).toBe(true);
    expect(JSON.parse(first.manifestJson)).toEqual(first.manifest);
  });

  it("keeps whole-design selection distinct from physical-layer scope", () => {
    expect(manufacturingLayerObjectIds(project().document, FACE_ID)).toEqual([
      "44444444-4444-4444-8444-444444444444",
      "45555555-5555-4555-8555-555555555551",
      "45555555-5555-4555-8555-555555555552",
      FACE_HOLE_ID,
    ]);
    expect(() => manufacturingLayerObjectIds(project().document, PREVIEW_ID)).toThrow(
      "physical manufacturing layer",
    );
  });

  it("reports exact transformed-circle evidence and warns for a same-center diameter mismatch", () => {
    const transformed = project();
    for (const object of transformed.document.objects) {
      if (object.id === FACE_HOLE_ID || object.id === BACK_HOLE_ID) {
        object.transform = { a: 0, b: 2, c: -2, d: 0, eMm: 10, fMm: 5 };
      }
    }
    const transformedPackage = buildProductionPackage(transformed);
    expect(transformedPackage.manifest.layers.map(
      (manifestLayer) => manifestLayer.registrationHoles,
    )).toEqual([
      [{ objectId: FACE_HOLE_ID, xMm: -90, yMm: 85, diameterMm: 12 }],
      [{ objectId: BACK_HOLE_ID, xMm: -90, yMm: 85, diameterMm: 12 }],
    ]);
    expect(transformedPackage.manifest.warnings).not.toContainEqual(
      expect.stringContaining("not numerically aligned"),
    );

    const mismatched = project();
    const backingHole = mismatched.document.objects.find(
      (object) => object.id === BACK_HOLE_ID,
    );
    if (backingHole?.type !== "ellipse") throw new Error("Expected backing circle.");
    backingHole.radiusXmm = 4;
    backingHole.radiusYmm = 4;
    expect(buildProductionPackage(mismatched).manifest.warnings).toContain(
      "Registration group main is not numerically aligned on layer Backing.",
    );
  });

  it("fails closed for stale or ambiguous registration references", () => {
    const stale = project();
    const face = stale.document.layers.find((item) => item.id === FACE_ID);
    if (face?.manufacturing === undefined) throw new Error("Expected face metadata.");
    face.manufacturing.registrationHoleIds = [
      "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    ];
    expect(() => buildProductionPackage(stale)).toThrow("is stale");

    const decorative = project();
    const decorativeFace = decorative.document.layers.find((item) => item.id === FACE_ID);
    if (decorativeFace?.manufacturing === undefined) throw new Error("Expected face metadata.");
    decorativeFace.manufacturing.registrationHoleIds = [
      "44444444-4444-4444-8444-444444444444",
    ];
    expect(() => buildProductionPackage(decorative)).toThrow(
      "must identify a top-level ellipse",
    );

    const sameMinorDifferentMajor = project();
    const faceOval = sameMinorDifferentMajor.document.objects.find(
      (object) => object.id === FACE_HOLE_ID,
    );
    const backingOval = sameMinorDifferentMajor.document.objects.find(
      (object) => object.id === BACK_HOLE_ID,
    );
    if (faceOval?.type !== "ellipse" || backingOval?.type !== "ellipse") {
      throw new Error("Expected designated ellipse geometry.");
    }
    faceOval.radiusXmm = 4;
    backingOval.radiusXmm = 5;
    expect(() => buildProductionPackage(sameMinorDifferentMajor)).toThrow(
      "true circle in world space",
    );

    for (const transform of [
      { a: 2, b: 0, c: 0, d: 1, eMm: 0, fMm: 0 },
      { a: 1, b: 0, c: 0.25, d: 1, eMm: 0, fMm: 0 },
    ]) {
      const transformed = project();
      const hole = transformed.document.objects.find(
        (object) => object.id === FACE_HOLE_ID,
      );
      if (hole?.type !== "ellipse") throw new Error("Expected face circle.");
      hole.transform = transform;
      expect(() => buildProductionPackage(transformed)).toThrow(
        "true circle in world space",
      );
    }
  });

  it("matches independently reviewed two- and three-layer package goldens", () => {
    expect(goldenSummary(buildProductionPackage(project()))).toEqual(goldens.twoLayer);

    const threeLayer = project();
    threeLayer.document.layers.splice(2, 0, layer(SPACER_ID, "Spacer tabs", "spacer-tab"));
    threeLayer.document.objects.push({
      id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
      type: "rectangle",
      layerId: SPACER_ID,
      transform: identityTransform(),
      origin: { xMm: 30, yMm: 40 },
      widthMm: 20,
      heightMm: 8,
    });
    expect(goldenSummary(buildProductionPackage(threeLayer))).toEqual(goldens.threeLayer);
  });
});
