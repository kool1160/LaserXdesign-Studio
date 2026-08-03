import type { PhysicalPreviewLayer } from "@laserx/physical-preview-3d";
import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { buildLayerGeometries } from "../src/sceneToThree";

function makeLayer(): PhysicalPreviewLayer {
  return {
    layerId: "layer-1",
    name: "Face",
    role: "face",
    thicknessMm: 5,
    material: { material: "mild-steel", stockThicknessDesignation: null, displayLabel: "5 mm" },
    shapes: [
      {
        id: "shape-1",
        outerContour: {
          points: [
            { xMm: 0, yMm: 0 },
            { xMm: 20, yMm: 0 },
            { xMm: 20, yMm: 10 },
            { xMm: 0, yMm: 10 },
          ],
        },
        holeContours: [
          {
            points: [
              { xMm: 5, yMm: 3 },
              { xMm: 9, yMm: 3 },
              { xMm: 9, yMm: 7 },
              { xMm: 5, yMm: 7 },
            ],
          },
        ],
        sourceObjectIds: ["obj-outer", "obj-hole"],
      },
    ],
    boundsMm: { minXmm: 0, minYmm: 0, maxXmm: 20, maxYmm: 10 },
  };
}

function requireBoundingBox(geometry: THREE.ExtrudeGeometry) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (box === null) throw new Error("Expected a computed bounding box.");
  return box;
}

function requirePositionAttribute(geometry: THREE.ExtrudeGeometry) {
  const position = geometry.attributes.position;
  if (position === undefined) throw new Error("Expected a position attribute.");
  return position;
}

/**
 * Casts a ray straight through the extrusion's Z axis (through-thickness) at
 * a world (x, y) point and returns every triangle it hits. A genuinely open
 * through-hole has zero cap material anywhere along that column, so the ray
 * passes clean through with no intersections; retained material has both a
 * front-cap and a back-cap triangle, so the ray hits exactly twice.
 */
function castThroughThickness(
  geometry: THREE.ExtrudeGeometry,
  xMm: number,
  yMm: number,
  thicknessMm: number,
): THREE.Intersection[] {
  // DoubleSide: the raycaster otherwise culls back-facing triangles (e.g.
  // the back cap, seen from inside the solid), which would under-count
  // legitimate intersections through retained material.
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const raycaster = new THREE.Raycaster(
    new THREE.Vector3(xMm, yMm, thicknessMm + 10),
    new THREE.Vector3(0, 0, -1),
    0,
    thicknessMm + 20,
  );
  return raycaster.intersectObject(mesh, false);
}

describe("buildLayerGeometries", () => {
  it("maps one shape per region, carrying its source object IDs", () => {
    const geometries = buildLayerGeometries(makeLayer());
    expect(geometries).toHaveLength(1);
    const entry = geometries[0];
    if (entry === undefined) throw new Error("Expected one shape geometry.");
    expect(entry.shapeId).toBe("shape-1");
    expect(entry.sourceObjectIds).toEqual(["obj-outer", "obj-hole"]);
  });

  it("extrudes to the exact thicknessMm and preserves the outer contour's world bounds", () => {
    const entry = buildLayerGeometries(makeLayer())[0];
    if (entry === undefined) throw new Error("Expected one shape geometry.");
    const box = requireBoundingBox(entry.geometry);

    expect(box.min.z).toBeCloseTo(0, 9);
    expect(box.max.z).toBeCloseTo(5, 9);
    expect(box.min.x).toBeCloseTo(0, 9);
    expect(box.max.x).toBeCloseTo(20, 9);
    expect(box.min.y).toBeCloseTo(0, 9);
    expect(box.max.y).toBeCloseTo(10, 9);
  });

  it("actually removes the hole's material rather than silently dropping it", () => {
    const withHole = makeLayer();
    const withoutHole = makeLayer();
    const withoutHoleShape = withoutHole.shapes[0];
    if (withoutHoleShape === undefined) throw new Error("Expected a shape.");
    withoutHoleShape.holeContours = [];

    const solidEntry = buildLayerGeometries(withoutHole)[0];
    const holedEntry = buildLayerGeometries(withHole)[0];
    if (solidEntry === undefined || holedEntry === undefined) {
      throw new Error("Expected one shape geometry for each layer.");
    }
    const solidVertexCount = requirePositionAttribute(solidEntry.geometry).count;
    const holedVertexCount = requirePositionAttribute(holedEntry.geometry).count;
    expect(holedVertexCount).not.toBe(solidVertexCount);
  });

  it("does not mutate the source layer", () => {
    const layer = makeLayer();
    const before = structuredClone(layer);
    buildLayerGeometries(layer);
    expect(layer).toEqual(before);
  });

  it("produces stable, deterministic geometry across repeated conversions", () => {
    const layer = makeLayer();
    const first = buildLayerGeometries(layer)[0];
    const second = buildLayerGeometries(layer)[0];
    if (first === undefined || second === undefined) {
      throw new Error("Expected geometry from both conversions.");
    }
    expect(Array.from(requirePositionAttribute(second.geometry).array)).toEqual(
      Array.from(requirePositionAttribute(first.geometry).array),
    );
  });

  it("proves the hole is genuinely open through both caps, not merely a smaller vertex count", () => {
    const layer = makeLayer();
    const entry = buildLayerGeometries(layer)[0];
    if (entry === undefined) throw new Error("Expected one shape geometry.");

    // Hole spans (5,3)-(9,7); its center is unambiguously inside it.
    const throughHole = castThroughThickness(entry.geometry, 7, 5, layer.thicknessMm);
    expect(throughHole).toHaveLength(0);

    // (2,2) is inside the outer rectangle (0,0)-(20,10) and outside the hole.
    const throughSolid = castThroughThickness(entry.geometry, 2, 2, layer.thicknessMm);
    expect(throughSolid).toHaveLength(2);
    const hitZs = throughSolid.map((hit) => hit.point.z).sort((left, right) => left - right);
    expect(hitZs[0]).toBeCloseTo(0, 9);
    expect(hitZs[1]).toBeCloseTo(layer.thicknessMm, 9);

    // Outside the outer contour entirely: no material either.
    const throughOutside = castThroughThickness(entry.geometry, 25, 25, layer.thicknessMm);
    expect(throughOutside).toHaveLength(0);
  });
});
