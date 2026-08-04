/**
 * Production safety coverage added at M14 G2.
 *
 * The promoted research suite proved the generic "ambiguous" path, but the G1
 * scaling evidence showed that `analyzeDocumentCutability` raises its single
 * ambiguity flag for four distinct conditions, only one of which the research
 * exercised. Every one of them must produce zero solids, because
 * `classifyRegions` marks every region `"ambiguous"` when the flag is set and
 * no region can then be trusted as solid or hole.
 *
 * The immutability probes here are deliberately paired with negative tests: an
 * immutability assertion that cannot fail proves nothing, which is a mistake
 * this workstream has already made once.
 */

import {
  createBlankProject,
  identityTransform,
  stockThicknessChoicesForMaterial,
  type LaserxProject,
  type Layer,
  type PathObject,
} from "@laserx/domain";
import { describe, expect, it } from "vitest";

import {
  buildPhysicalPreviewAssembly,
  buildPhysicalPreviewScene,
  type PhysicalPreviewFindingCode,
} from "../src/index.js";

const LAYER_ID = "cccccccc-0000-4000-8000-000000000001";
const NOW = "2026-08-04T00:00:00.000Z";

const objectId = (index: number): string =>
  `dddddddd-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;

function physicalLayer(thicknessMm: number, designationLabel = "6 mm"): Layer {
  return {
    id: LAYER_ID,
    name: "Face",
    visible: true,
    locked: false,
    manufacturing: {
      role: "face",
      material: "mild-steel",
      thicknessMm,
      stockThicknessDesignation: {
        kind: "millimeter",
        label: designationLabel,
        material: null,
      },
      process: "laser",
      notes: "",
      registrationGroup: null,
      registrationHoleIds: [],
    },
  };
}

function closedPath(index: number, points: Array<[number, number]>): PathObject {
  return {
    id: objectId(index),
    type: "path",
    layerId: LAYER_ID,
    transform: identityTransform(),
    closed: true,
    points: points.map(([xMm, yMm]) => ({ xMm, yMm })),
  };
}

function projectWith(objects: PathObject[], layer: Layer = physicalLayer(6)): LaserxProject {
  return createBlankProject({
    id: "eeeeeeee-0000-4000-8000-000000000001",
    now: NOW,
    documentId: "eeeeeeee-0000-4000-8000-000000000002",
    width: 200,
    height: 160,
    layers: [layer],
    activeLayerId: LAYER_ID,
    objects,
  });
}

const square = (index: number, x: number, y: number, size: number): PathObject =>
  closedPath(index, [
    [x, y],
    [x + size, y],
    [x + size, y + size],
    [x, y + size],
  ]);

describe("fails closed for every ambiguity class", () => {
  const cases: Array<{
    label: string;
    expected: PhysicalPreviewFindingCode;
    objects: PathObject[];
  }> = [
    {
      label: "duplicate segments (two identical stacked squares)",
      expected: "DUPLICATE_SEGMENT",
      objects: [square(1, 20, 20, 60), square(2, 20, 20, 60)],
    },
    {
      label: "overlapping collinear segments",
      expected: "OVERLAPPING_SEGMENT",
      objects: [
        square(3, 20, 20, 60),
        closedPath(4, [
          [20, 40],
          [80, 40],
          [80, 100],
          [20, 100],
        ]),
      ],
    },
    {
      label: "a self-intersecting bowtie contour",
      expected: "SELF_INTERSECTION",
      objects: [
        closedPath(5, [
          [20, 20],
          [80, 80],
          [80, 20],
          [20, 80],
        ]),
      ],
    },
    {
      label: "two separate contours that intersect",
      expected: "UNSUPPORTED_GEOMETRY",
      objects: [square(6, 20, 20, 60), square(7, 50, 50, 60)],
    },
  ];

  for (const { label, expected, objects } of cases) {
    it(`invents no solid for ${label}`, () => {
      const project = projectWith(objects);
      const scene = buildPhysicalPreviewScene(project, { layerId: LAYER_ID });
      const previewLayer = scene.layers[0];
      if (previewLayer === undefined) throw new Error("expected one physical layer");

      // No shapes at all: a region marked "ambiguous" cannot be trusted as
      // solid or hole, so extruding one would invent manufacturing geometry.
      expect(previewLayer.shapes, `${label} shapes`).toHaveLength(0);
      expect(scene.findings.map((finding) => finding.code), `${label} findings`).toContain(
        expected,
      );

      // The failure must be visible and attributed, never silent.
      expect(scene.findings.length).toBeGreaterThan(0);
      for (const finding of scene.findings) {
        expect(finding.layerId).toBe(LAYER_ID);
      }

      // The layer keeps its declared identity and thickness so it does not
      // silently vanish from the stack while still occupying Z space.
      expect(previewLayer.thicknessMm).toBe(6);
      expect(previewLayer.name).toBe("Face");
    });

    it(`reports a partial assembly with declared-incomplete depth for ${label}`, () => {
      const assembly = buildPhysicalPreviewAssembly(projectWith(objects));

      expect(assembly.status).toBe("partial");
      expect(assembly.depthStatus).toBe("declared-incomplete");
      expect(assembly.layers).toHaveLength(1);
      expect(assembly.layers[0]?.shapes).toHaveLength(0);
      // Declared depth is still reported, but explicitly not verified.
      expect(assembly.assembledDepthMm).toBe(6);
    });
  }
});

describe("exact canonical thickness for every stock designation kind", () => {
  it("preserves gauge, fractional-inch, and millimeter thickness exactly", () => {
    // Values come from domain's own tables rather than being hand-computed, so
    // the test cannot silently disagree with the manufacturing source of truth.
    const gauge = stockThicknessChoicesForMaterial("mild-steel").find(
      (choice) => choice.designation.kind === "gauge",
    );
    const fractional = stockThicknessChoicesForMaterial("mild-steel").find(
      (choice) => choice.designation.kind === "fractional-inch",
    );
    if (gauge === undefined || fractional === undefined) {
      throw new Error("domain no longer offers gauge and fractional-inch mild-steel stock");
    }

    for (const choice of [gauge, fractional]) {
      const base = physicalLayer(choice.thicknessMm);
      const manufacturing = base.manufacturing;
      if (manufacturing === undefined) throw new Error("fixture layer lost its metadata");
      const layer: Layer = {
        ...base,
        manufacturing: {
          ...manufacturing,
          thicknessMm: choice.thicknessMm,
          stockThicknessDesignation: choice.designation,
        },
      };
      const scene = buildPhysicalPreviewScene(projectWith([square(1, 20, 20, 60)], layer), {
        layerId: LAYER_ID,
      });
      const previewLayer = scene.layers[0];
      if (previewLayer === undefined) throw new Error("expected one physical layer");

      // Exact equality, not a tolerance: canonical millimetres must survive
      // promotion untouched.
      expect(previewLayer.thicknessMm).toBe(choice.thicknessMm);
      expect(previewLayer.material.stockThicknessDesignation?.label).toBe(choice.designation.label);
    }

    const millimetre = buildPhysicalPreviewScene(
      projectWith([square(1, 20, 20, 60)], physicalLayer(6)),
      { layerId: LAYER_ID },
    );
    expect(millimetre.layers[0]?.thicknessMm).toBe(6);
  });
});

describe("source immutability is proven, not asserted", () => {
  const deepClone = (project: LaserxProject): LaserxProject =>
    JSON.parse(JSON.stringify(project)) as LaserxProject;

  it("leaves the exact supplied object structurally unchanged", () => {
    const project = projectWith([square(1, 20, 20, 60)]);
    const before = JSON.stringify(project);

    buildPhysicalPreviewScene(project, { layerId: LAYER_ID });
    buildPhysicalPreviewAssembly(project);

    // Compared on the exact object that was passed in, not a copy of it.
    expect(JSON.stringify(project)).toBe(before);
  });

  it("would detect a mutation if one occurred", () => {
    // The negative half: if the comparison above could not fail, it would prove
    // nothing. Mutating the same shape of state the builders touch must trip it.
    const project = projectWith([square(1, 20, 20, 60)]);
    const before = JSON.stringify(project);

    const mutated = deepClone(project);
    const firstObject = mutated.document.objects[0];
    if (firstObject === undefined || firstObject.type !== "path") {
      throw new Error("fixture object missing");
    }
    firstObject.points[0] = { xMm: 999, yMm: 999 };

    expect(JSON.stringify(mutated)).not.toBe(before);
  });

  it("would detect a mutated layer thickness if one occurred", () => {
    const project = projectWith([square(1, 20, 20, 60)]);
    const before = JSON.stringify(project);

    const mutated = deepClone(project);
    const manufacturing = mutated.document.layers[0]?.manufacturing;
    if (manufacturing === undefined) throw new Error("fixture layer missing manufacturing");
    manufacturing.thicknessMm = 999;

    expect(JSON.stringify(mutated)).not.toBe(before);
  });
});

describe("deterministic output", () => {
  it("produces identical fingerprints and geometry across repeated builds", () => {
    const project = projectWith([square(1, 20, 20, 60)]);

    const fingerprints = new Set<string>();
    const geometry = new Set<string>();
    for (let run = 0; run < 8; run += 1) {
      const assembly = buildPhysicalPreviewAssembly(projectWith([square(1, 20, 20, 60)]));
      fingerprints.add(assembly.fingerprint);
      geometry.add(JSON.stringify(assembly.layers.map((layer) => layer.shapes)));
    }

    expect(fingerprints.size).toBe(1);
    expect(geometry.size).toBe(1);
    expect(buildPhysicalPreviewAssembly(project).fingerprint).toBe([...fingerprints][0]);
  });
});
