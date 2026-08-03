import {
  createBlankProject,
  identityTransform,
  type LaserxProject,
  type Layer,
  type PathObject,
} from "@laserx/domain";
import { describe, expect, it } from "vitest";

import { buildPhysicalPreviewAssembly, buildPhysicalPreviewScene } from "../src/index.js";

const UNTAGGED_ID = "aaaaaaaa-0000-4000-8000-000000000001";
const FACE_ID = "aaaaaaaa-0000-4000-8000-000000000002";
const PREVIEW_ID = "aaaaaaaa-0000-4000-8000-000000000003";
const BACKING_ID = "aaaaaaaa-0000-4000-8000-000000000004";

const FACE_RECT_ID = "bbbbbbbb-0000-4000-8000-000000000001";
const BACKING_RECT_ID = "bbbbbbbb-0000-4000-8000-000000000002";
const PREVIEW_OBJECT_ID = "bbbbbbbb-0000-4000-8000-000000000003";

function untaggedLayer(id: string, name: string): Layer {
  return { id, name, visible: true, locked: false };
}

function physicalLayer(
  id: string,
  name: string,
  role: "face" | "backing",
  thicknessMm: number,
): Layer {
  return {
    id,
    name,
    visible: true,
    locked: false,
    manufacturing: {
      role,
      material: role === "backing" ? "acrylic" : "mild-steel",
      thicknessMm,
      stockThicknessDesignation: {
        kind: "millimeter",
        label: `${String(thicknessMm)} mm`,
        material: null,
      },
      process: "laser",
      notes: "",
      registrationGroup: null,
      registrationHoleIds: [],
    },
  };
}

function previewLayer(id: string, name: string): Layer {
  return {
    id,
    name,
    visible: true,
    locked: false,
    manufacturing: {
      role: "non-cut-preview",
      material: "other",
      thicknessMm: 1,
      stockThicknessDesignation: null,
      process: "non-cut",
      notes: "",
      registrationGroup: null,
      registrationHoleIds: [],
    },
  };
}

function rectangle(id: string, layerId: string, originMm: number, sizeMm: number) {
  return {
    id,
    type: "rectangle" as const,
    layerId,
    transform: identityTransform(),
    origin: { xMm: originMm, yMm: originMm },
    widthMm: sizeMm,
    heightMm: sizeMm,
  };
}

/** Document order: untagged, face (3 mm), preview, backing (6 mm). */
function twoLayerProject(): LaserxProject {
  return createBlankProject({
    id: "cccccccc-0000-4000-8000-000000000001",
    documentId: "cccccccc-0000-4000-8000-000000000002",
    name: "Assembly Fixture",
    now: "2026-08-02T12:00:00.000Z",
    width: 200,
    height: 150,
    inputUnit: "millimeters",
    layers: [
      untaggedLayer(UNTAGGED_ID, "Sketch"),
      physicalLayer(FACE_ID, "Face", "face", 3),
      previewLayer(PREVIEW_ID, "LED preview"),
      physicalLayer(BACKING_ID, "Backing", "backing", 6),
    ],
    activeLayerId: FACE_ID,
    objects: [
      rectangle("dddddddd-0000-4000-8000-000000000001", UNTAGGED_ID, 5, 10),
      rectangle(FACE_RECT_ID, FACE_ID, 20, 60),
      rectangle(PREVIEW_OBJECT_ID, PREVIEW_ID, 30, 20),
      rectangle(BACKING_RECT_ID, BACKING_ID, 10, 100),
    ],
  });
}

describe("buildPhysicalPreviewAssembly", () => {
  it("includes only physical layers, in document order, excluding untagged and non-cut-preview", () => {
    const assembly = buildPhysicalPreviewAssembly(twoLayerProject());
    expect(assembly.layers.map((layer) => layer.layerId)).toEqual([FACE_ID, BACKING_ID]);
    expect(assembly.layers.map((layer) => layer.order)).toEqual([0, 1]);
    expect(assembly.layers.map((layer) => layer.role)).toEqual(["face", "backing"]);
    expect(assembly.status).toBe("complete");
  });

  it("computes deterministic assembled and exploded Z ranges with default spacing", () => {
    const assembly = buildPhysicalPreviewAssembly(twoLayerProject());
    const [face, backing] = assembly.layers;
    if (face === undefined || backing === undefined) throw new Error("Expected two layers.");

    expect(assembly.spacing).toEqual({ assembledGapMm: 0, explodedGapMm: 20 });
    expect(assembly.assembledDepthMm).toBe(9);

    // First layer in document order (face) is front-most: the higher Z range.
    expect(face.assembledZRangeMm).toEqual({ minZmm: 6, maxZmm: 9 });
    expect(backing.assembledZRangeMm).toEqual({ minZmm: 0, maxZmm: 6 });

    expect(face.explodedZRangeMm).toEqual({ minZmm: 26, maxZmm: 29 });
    expect(backing.explodedZRangeMm).toEqual({ minZmm: 0, maxZmm: 6 });
  });

  it("supports custom assembled/exploded spacing options", () => {
    const assembly = buildPhysicalPreviewAssembly(twoLayerProject(), {
      spacing: { assembledGapMm: 2, explodedGapMm: 10 },
    });
    const [face, backing] = assembly.layers;
    if (face === undefined || backing === undefined) throw new Error("Expected two layers.");

    expect(assembly.assembledDepthMm).toBe(11); // 3 + 6 + 2 gap
    expect(face.assembledZRangeMm).toEqual({ minZmm: 8, maxZmm: 11 });
    expect(backing.assembledZRangeMm).toEqual({ minZmm: 0, maxZmm: 6 });

    // exploded gap = assembledGapMm + explodedGapMm = 12
    expect(face.explodedZRangeMm).toEqual({ minZmm: 18, maxZmm: 21 });
    expect(backing.explodedZRangeMm).toEqual({ minZmm: 0, maxZmm: 6 });
  });

  it("rejects negative spacing", () => {
    expect(() =>
      buildPhysicalPreviewAssembly(twoLayerProject(), { spacing: { assembledGapMm: -1 } }),
    ).toThrow("nonnegative");
    expect(() =>
      buildPhysicalPreviewAssembly(twoLayerProject(), { spacing: { explodedGapMm: Number.NaN } }),
    ).toThrow("nonnegative");
  });

  it("marks the assembly partial when one physical layer is ambiguous, without blocking the other layer", () => {
    const project = twoLayerProject();
    const openPath: PathObject = {
      id: "eeeeeeee-0000-4000-8000-000000000001",
      type: "path",
      layerId: BACKING_ID,
      transform: identityTransform(),
      closed: false,
      points: [
        { xMm: 10, yMm: 10 },
        { xMm: 100, yMm: 10 },
        { xMm: 100, yMm: 90 },
      ],
    };
    project.document.objects.push(openPath);

    const assembly = buildPhysicalPreviewAssembly(project);
    expect(assembly.status).toBe("partial");
    const face = assembly.layers.find((layer) => layer.layerId === FACE_ID);
    const backing = assembly.layers.find((layer) => layer.layerId === BACKING_ID);
    if (face === undefined || backing === undefined) throw new Error("Expected both layers.");
    expect(face.shapes.length).toBeGreaterThan(0);
    expect(backing.shapes).toEqual([]);
    expect(assembly.findings).toContainEqual(
      expect.objectContaining({ code: "OPEN_CONTOUR", layerId: BACKING_ID }),
    );
  });

  it("reports unavailable when the document declares no physical manufacturing layers", () => {
    const project = createBlankProject({
      id: "ffffffff-0000-4000-8000-000000000001",
      documentId: "ffffffff-0000-4000-8000-000000000002",
      name: "No Physical Layers",
      now: "2026-08-02T12:00:00.000Z",
      width: 100,
      height: 100,
      inputUnit: "millimeters",
      layers: [untaggedLayer(UNTAGGED_ID, "Sketch"), previewLayer(PREVIEW_ID, "LED preview")],
      activeLayerId: UNTAGGED_ID,
      objects: [],
    });
    const assembly = buildPhysicalPreviewAssembly(project);
    expect(assembly.status).toBe("unavailable");
    expect(assembly.layers).toEqual([]);
    expect(assembly.assembledDepthMm).toBe(0);
  });

  it("is deterministic across independently built equivalent projects", () => {
    const first = buildPhysicalPreviewAssembly(twoLayerProject());
    const second = buildPhysicalPreviewAssembly(twoLayerProject());
    expect(second).toEqual(first);
    expect(second.fingerprint).toBe(first.fingerprint);
  });

  it("never mutates the source project", () => {
    const project = twoLayerProject();
    const before = structuredClone(project);
    buildPhysicalPreviewAssembly(project);
    expect(project).toEqual(before);
  });

  it("keeps single-layer buildPhysicalPreviewScene output identical to the corresponding assembly layer", () => {
    const project = twoLayerProject();
    const assembly = buildPhysicalPreviewAssembly(project);
    const scene = buildPhysicalPreviewScene(project, { layerId: FACE_ID });
    const assemblyFace = assembly.layers.find((layer) => layer.layerId === FACE_ID);
    if (assemblyFace === undefined) throw new Error("Expected the face layer in the assembly.");

    expect(scene.layers[0]).toEqual({
      layerId: assemblyFace.layerId,
      name: assemblyFace.name,
      role: assemblyFace.role,
      thicknessMm: assemblyFace.thicknessMm,
      material: assemblyFace.material,
      shapes: assemblyFace.shapes,
      boundsMm: assemblyFace.boundsMm,
    });
  });
});
