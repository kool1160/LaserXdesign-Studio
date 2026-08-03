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

/** One valid physical layer (Face, with geometry) plus one empty physical layer (Backing, zero objects). */
function faceAndEmptyBackingProject(): LaserxProject {
  return createBlankProject({
    id: "eeeeeeee-1111-4000-8000-000000000001",
    documentId: "eeeeeeee-1111-4000-8000-000000000002",
    name: "Face Plus Empty Backing",
    now: "2026-08-02T12:00:00.000Z",
    width: 150,
    height: 100,
    inputUnit: "millimeters",
    layers: [
      physicalLayer(FACE_ID, "Face", "face", 3),
      physicalLayer(BACKING_ID, "Backing", "backing", 6),
    ],
    activeLayerId: FACE_ID,
    objects: [rectangle(FACE_RECT_ID, FACE_ID, 20, 60)],
  });
}

/** Two declared physical layers, neither with any objects. */
function allEmptyProject(): LaserxProject {
  return createBlankProject({
    id: "eeeeeeee-2222-4000-8000-000000000001",
    documentId: "eeeeeeee-2222-4000-8000-000000000002",
    name: "All Empty",
    now: "2026-08-02T12:00:00.000Z",
    width: 150,
    height: 100,
    inputUnit: "millimeters",
    layers: [
      physicalLayer(FACE_ID, "Face", "face", 3),
      physicalLayer(BACKING_ID, "Backing", "backing", 6),
    ],
    activeLayerId: FACE_ID,
    objects: [],
  });
}

describe("empty physical layer handling", () => {
  it("marks the assembly partial when one physical layer is empty, with an EMPTY_PHYSICAL_LAYER finding", () => {
    const assembly = buildPhysicalPreviewAssembly(faceAndEmptyBackingProject());
    expect(assembly.status).toBe("partial");
    // assembledDepthMm still sums every declared layer's thicknessMm, but
    // depthStatus makes clear it is declared/planned depth here, not a
    // verified measurement of finished geometry.
    expect(assembly.depthStatus).toBe("declared-incomplete");
    expect(assembly.assembledDepthMm).toBe(9);

    const face = assembly.layers.find((layer) => layer.layerId === FACE_ID);
    const backing = assembly.layers.find((layer) => layer.layerId === BACKING_ID);
    if (face === undefined || backing === undefined) throw new Error("Expected both layers.");
    expect(face.shapes.length).toBeGreaterThan(0);
    expect(backing.shapes).toEqual([]);

    // Declared identity/material/thickness stay inspectable even with no geometry.
    expect(backing.name).toBe("Backing");
    expect(backing.material.material).toBe("acrylic");
    expect(backing.thicknessMm).toBe(6);

    const emptyFinding = assembly.findings.find(
      (finding) => finding.code === "EMPTY_PHYSICAL_LAYER" && finding.layerId === BACKING_ID,
    );
    if (emptyFinding === undefined) throw new Error("Expected an EMPTY_PHYSICAL_LAYER finding.");
    expect(emptyFinding.objectIds).toEqual([]);
    expect(emptyFinding.message).toContain("Backing");
  });

  it("marks the assembly partial, never complete or unavailable, when every physical layer is empty", () => {
    const assembly = buildPhysicalPreviewAssembly(allEmptyProject());
    expect(assembly.status).toBe("partial");
    expect(assembly.layers).toHaveLength(2);
    expect(assembly.layers.every((layer) => layer.shapes.length === 0)).toBe(true);
    expect(
      assembly.findings.filter((finding) => finding.code === "EMPTY_PHYSICAL_LAYER"),
    ).toHaveLength(2);
    // Declared thickness still contributes to assembledDepthMm, but with
    // every layer empty, depthStatus must never claim it is verified.
    expect(assembly.assembledDepthMm).toBe(9);
    expect(assembly.depthStatus).toBe("declared-incomplete");
    expect(assembly.depthStatus).not.toBe("verified");
    expect(assembly.depthStatus).not.toBe("unavailable");
  });

  it("is deterministic across independently built empty-layer assemblies", () => {
    const first = buildPhysicalPreviewAssembly(faceAndEmptyBackingProject());
    const second = buildPhysicalPreviewAssembly(faceAndEmptyBackingProject());
    expect(second).toEqual(first);
    expect(second.fingerprint).toBe(first.fingerprint);
  });

  it("never mutates the source project when a physical layer is empty", () => {
    const project = faceAndEmptyBackingProject();
    const before = structuredClone(project);
    buildPhysicalPreviewAssembly(project);
    expect(project).toEqual(before);
  });
});

describe("ephemeral catalog material identifiers", () => {
  it("defaults every layer to null when no map is supplied", () => {
    const assembly = buildPhysicalPreviewAssembly(twoLayerProject());
    expect(assembly.layers.map((layer) => layer.catalogMaterialId)).toEqual([null, null]);
  });

  it("carries supplied identifiers through verbatim, per layer", () => {
    const assembly = buildPhysicalPreviewAssembly(twoLayerProject(), {
      catalogMaterialIds: { [FACE_ID]: "wood-mdf", [BACKING_ID]: "acrylic-frosted" },
    });
    expect(assembly.layers.map((layer) => layer.catalogMaterialId)).toEqual([
      "wood-mdf",
      "acrylic-frosted",
    ]);
  });

  it("does not interpret or validate the identifier — unknown values pass through unchanged", () => {
    // Resolution and unknown-material findings belong to the renderer-side
    // adapter; this package must stay catalog-agnostic.
    const assembly = buildPhysicalPreviewAssembly(twoLayerProject(), {
      catalogMaterialIds: { [FACE_ID]: "totally-made-up-material" },
    });
    expect(assembly.layers[0]?.catalogMaterialId).toBe("totally-made-up-material");
    expect(assembly.layers[1]?.catalogMaterialId).toBeNull();
    expect(assembly.findings).toEqual([]);
    expect(assembly.status).toBe("complete");
  });

  it("ignores identifiers for layers that are not physical", () => {
    const assembly = buildPhysicalPreviewAssembly(twoLayerProject(), {
      catalogMaterialIds: { [PREVIEW_ID]: "wood-mdf", [UNTAGGED_ID]: "wood-mdf" },
    });
    expect(assembly.layers.map((layer) => layer.catalogMaterialId)).toEqual([null, null]);
  });

  it("changes the fingerprint, since the assembly genuinely differs", () => {
    const plain = buildPhysicalPreviewAssembly(twoLayerProject());
    const mapped = buildPhysicalPreviewAssembly(twoLayerProject(), {
      catalogMaterialIds: { [FACE_ID]: "wood-mdf" },
    });
    expect(mapped.fingerprint).not.toBe(plain.fingerprint);
  });

  it("is deterministic for the same map", () => {
    const options = { catalogMaterialIds: { [FACE_ID]: "wood-mdf" } };
    const first = buildPhysicalPreviewAssembly(twoLayerProject(), options);
    const second = buildPhysicalPreviewAssembly(twoLayerProject(), options);
    expect(second).toEqual(first);
    expect(second.fingerprint).toBe(first.fingerprint);
  });

  it("neither retains nor mutates the caller's map", () => {
    const supplied: Record<string, string> = { [FACE_ID]: "wood-mdf" };
    const before = { ...supplied };
    const assembly = buildPhysicalPreviewAssembly(twoLayerProject(), {
      catalogMaterialIds: supplied,
    });
    expect(supplied).toEqual(before);

    // Mutating the caller's map afterwards must not retroactively alter the
    // assembly that was already built.
    supplied[FACE_ID] = "acrylic-mirrored";
    expect(assembly.layers[0]?.catalogMaterialId).toBe("wood-mdf");
  });

  it("never mutates the source project", () => {
    const project = twoLayerProject();
    const snapshot = structuredClone(project);
    buildPhysicalPreviewAssembly(project, {
      catalogMaterialIds: { [FACE_ID]: "wood-mdf" },
    });
    expect(project).toEqual(snapshot);
  });
});

describe("buildPhysicalPreviewAssembly", () => {
  it("includes only physical layers, in document order, excluding untagged and non-cut-preview", () => {
    const assembly = buildPhysicalPreviewAssembly(twoLayerProject());
    expect(assembly.layers.map((layer) => layer.layerId)).toEqual([FACE_ID, BACKING_ID]);
    expect(assembly.layers.map((layer) => layer.order)).toEqual([0, 1]);
    expect(assembly.layers.map((layer) => layer.role)).toEqual(["face", "backing"]);
    expect(assembly.status).toBe("complete");
    // Every layer rendered, so assembledDepthMm is verified finished depth.
    expect(assembly.depthStatus).toBe("verified");
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
    expect(assembly.depthStatus).toBe("declared-incomplete");
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
    expect(assembly.depthStatus).toBe("unavailable");
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
