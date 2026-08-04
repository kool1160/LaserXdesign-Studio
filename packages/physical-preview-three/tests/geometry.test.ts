import type {
  PhysicalPreviewAssembly,
  PhysicalPreviewLayer,
  PhysicalPreviewShape,
} from "@laserx/physical-preview-3d";
import type {
  Box3,
  BufferGeometry} from "three";
import {
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  Vector3,
  type Intersection,
} from "three";
import { describe, expect, it } from "vitest";

import {
  buildAssemblyGeometries,
  buildLayerGeometries,
  disposeAssemblyGeometries,
  RENDERED_MM_TOLERANCE,
} from "../src/geometry.js";

function rect(x: number, y: number, width: number, height: number) {
  return {
    points: [
      { xMm: x, yMm: y },
      { xMm: x + width, yMm: y },
      { xMm: x + width, yMm: y + height },
      { xMm: x, yMm: y + height },
    ],
  };
}

function shape(id: string, holes: Array<ReturnType<typeof rect>> = []): PhysicalPreviewShape {
  return {
    id,
    outerContour: rect(0, 0, 20, 10),
    holeContours: holes,
    sourceObjectIds: ["obj-outer"],
  };
}

function layer(overrides: Partial<PhysicalPreviewLayer> = {}): PhysicalPreviewLayer {
  return {
    layerId: "layer-1",
    name: "Face",
    role: "face",
    thicknessMm: 5,
    material: {
      material: "mild-steel",
      stockThicknessDesignation: null,
      displayLabel: "5 mm",
    },
    shapes: [shape("shape-1", [rect(5, 3, 4, 4)])],
    boundsMm: { minXmm: 0, minYmm: 0, maxXmm: 20, maxYmm: 10 },
    ...overrides,
  };
}

function requireBoundingBox(geometry: BufferGeometry): Box3 {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (box === null) throw new Error("Expected a bounding box.");
  return box;
}

/**
 * Casts a ray straight down through the solid at (x, y).
 *
 * `DoubleSide` matters: the raycaster otherwise culls back-facing triangles
 * (the back cap seen from inside the solid), which would under-count legitimate
 * intersections through retained material and make a hole look identical to
 * solid stock.
 */
function castThrough(
  geometry: BufferGeometry,
  xMm: number,
  yMm: number,
  thicknessMm: number,
): Array<Intersection> {
  const mesh = new Mesh(geometry, new MeshBasicMaterial({ side: DoubleSide }));
  const raycaster = new Raycaster(
    new Vector3(xMm, yMm, thicknessMm + 10),
    new Vector3(0, 0, -1),
    0,
    thicknessMm + 20,
  );
  return raycaster.intersectObject(mesh, false);
}

describe("buildLayerGeometries", () => {
  it("maps one geometry per shape, carrying its source object IDs", () => {
    const geometries = buildLayerGeometries(layer());
    expect(geometries).toHaveLength(1);
    expect(geometries[0]?.shapeId).toBe("shape-1");
    expect(geometries[0]?.sourceObjectIds).toEqual(["obj-outer"]);
    disposeAssemblyGeometries([{ layerId: "l", order: 0, geometries }]);
  });

  it("extrudes to the exact thicknessMm and preserves world bounds", () => {
    const entry = buildLayerGeometries(layer())[0];
    if (entry === undefined) throw new Error("Expected one shape geometry.");
    const box = requireBoundingBox(entry.geometry);

    expect(box.min.z).toBeCloseTo(0, 9);
    expect(box.max.z).toBeCloseTo(5, 9);
    expect(box.min.x).toBeCloseTo(0, 9);
    expect(box.max.x).toBeCloseTo(20, 9);
    expect(box.min.y).toBeCloseTo(0, 9);
    expect(box.max.y).toBeCloseTo(10, 9);
    entry.geometry.dispose();
  });

  it("passes gauge, fractional-inch, and millimetre thickness through exactly", () => {
    // The authoritative value must survive conversion untouched. This is the
    // assertion that matters: it is what readouts and exports use.
    for (const thicknessMm of [1.51892, 3.175, 6]) {
      const supplied = layer({ thicknessMm });
      const entry = buildLayerGeometries(supplied)[0];
      if (entry === undefined) throw new Error("Expected one shape geometry.");
      expect(entry.geometry.parameters.options.depth).toBe(thicknessMm);
      expect(supplied.thicknessMm).toBe(thicknessMm);
      entry.geometry.dispose();
    }
  });

  it("renders thickness within the documented float32 buffer precision", () => {
    // Three stores positions in a Float32Array, so 1.51892 reads back as
    // 1.5189199447631836 — ~5.5e-8 mm. Asserting exact equality here would be
    // asserting something the renderer cannot do; asserting a loose tolerance
    // would hide a real regression. RENDERED_MM_TOLERANCE pins the real bound.
    for (const thicknessMm of [1.51892, 3.175, 6]) {
      const entry = buildLayerGeometries(layer({ thicknessMm }))[0];
      if (entry === undefined) throw new Error("Expected one shape geometry.");
      const box = requireBoundingBox(entry.geometry);
      const rendered = box.max.z - box.min.z;

      expect(Math.abs(rendered - thicknessMm)).toBeLessThan(RENDERED_MM_TOLERANCE);
      // And the error is genuinely float32-sized, not a scaling bug.
      expect(Math.abs(rendered - thicknessMm)).toBeLessThan(
        Math.max(Math.abs(thicknessMm), 1) * 1e-7,
      );
      entry.geometry.dispose();
    }
  });

  it("produces a genuinely open through-hole, not a painted one", () => {
    const entry = buildLayerGeometries(layer())[0];
    if (entry === undefined) throw new Error("Expected one shape geometry.");

    // Through the hole centre: the ray must pass through the wall surfaces but
    // hit no cap, so it never enters retained material.
    const throughHole = castThrough(entry.geometry, 7, 5, 5);
    const capHits = throughHole.filter(
      (hit) => Math.abs(hit.point.z) < 1e-6 || Math.abs(hit.point.z - 5) < 1e-6,
    );
    expect(capHits, "hole centre must not be capped").toHaveLength(0);

    // Through solid stock: front and back caps are both present.
    const throughSolid = castThrough(entry.geometry, 16, 5, 5);
    const solidCaps = throughSolid.filter(
      (hit) => Math.abs(hit.point.z) < 1e-6 || Math.abs(hit.point.z - 5) < 1e-6,
    );
    expect(solidCaps.length, "solid stock must be capped").toBeGreaterThanOrEqual(2);
    entry.geometry.dispose();
  });

  it("keeps a nested island solid inside a hole", () => {
    // Outer plate, a large hole, and an island back inside it — the island must
    // remain retained material rather than being swallowed by the hole.
    const island: PhysicalPreviewShape = {
      id: "island",
      outerContour: rect(7, 4, 2, 2),
      holeContours: [],
      sourceObjectIds: ["obj-island"],
    };
    const geometries = buildLayerGeometries(
      layer({ shapes: [shape("plate", [rect(5, 3, 8, 4)]), island] }),
    );
    expect(geometries).toHaveLength(2);

    const islandGeometry = geometries.find((entry) => entry.shapeId === "island");
    if (islandGeometry === undefined) throw new Error("Expected the island geometry.");
    const hits = castThrough(islandGeometry.geometry, 8, 5, 5);
    expect(hits.length).toBeGreaterThan(0);

    for (const entry of geometries) entry.geometry.dispose();
  });

  it("builds no geometry for a failed layer and never invents a solid", () => {
    // A layer the scene package failed closed on carries zero shapes.
    const geometries = buildLayerGeometries(layer({ shapes: [], boundsMm: null }));
    expect(geometries).toEqual([]);
  });

  it("is deterministic across repeated conversions", () => {
    const first = buildLayerGeometries(layer())[0];
    const second = buildLayerGeometries(layer())[0];
    if (first === undefined || second === undefined) throw new Error("Expected geometries.");

    const positionsOf = (geometry: BufferGeometry): number[] =>
      Array.from(geometry.getAttribute("position").array as Float32Array);

    expect(positionsOf(second.geometry)).toEqual(positionsOf(first.geometry));
    expect(requireBoundingBox(second.geometry).max.toArray()).toEqual(
      requireBoundingBox(first.geometry).max.toArray(),
    );
    first.geometry.dispose();
    second.geometry.dispose();
  });

  it("does not mutate the supplied layer", () => {
    const supplied = layer();
    const before = JSON.stringify(supplied);
    const geometries = buildLayerGeometries(supplied);
    expect(JSON.stringify(supplied)).toBe(before);
    for (const entry of geometries) entry.geometry.dispose();
  });
});

describe("buildAssemblyGeometries", () => {
  const assembly = (): PhysicalPreviewAssembly =>
    ({
      identity: { projectId: "p", documentId: "d", projectUpdatedAt: "t" },
      stockMm: { widthMm: 100, heightMm: 50 },
      status: "partial",
      spacing: { assembledGapMm: 0, explodedGapMm: 20 },
      layers: [
        {
          ...layer({ layerId: "front" }),
          order: 0,
          assembledZRangeMm: { minZmm: 0, maxZmm: 5 },
          explodedZRangeMm: { minZmm: 0, maxZmm: 5 },
        },
        {
          ...layer({ layerId: "failed", shapes: [], boundsMm: null }),
          order: 1,
          assembledZRangeMm: { minZmm: 5, maxZmm: 10 },
          explodedZRangeMm: { minZmm: 25, maxZmm: 30 },
        },
      ],
      assembledDepthMm: 10,
      depthStatus: "declared-incomplete",
      findings: [],
      fingerprint: "fp",
    }) as unknown as PhysicalPreviewAssembly;

  it("keeps a failed layer listed with zero geometry beside a valid one", () => {
    const built = buildAssemblyGeometries(assembly());
    expect(built.map((entry) => entry.layerId)).toEqual(["front", "failed"]);
    expect(built[0]?.geometries.length).toBeGreaterThan(0);
    // The failed layer contributes nothing but is not silently dropped.
    expect(built[1]?.geometries).toEqual([]);
    disposeAssemblyGeometries(built);
  });

  it("does not mutate the supplied assembly", () => {
    const supplied = assembly();
    const before = JSON.stringify(supplied);
    const built = buildAssemblyGeometries(supplied);
    expect(JSON.stringify(supplied)).toBe(before);
    disposeAssemblyGeometries(built);
  });
});
