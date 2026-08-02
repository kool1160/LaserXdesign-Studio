import type { PhysicalPreviewLayer } from "@laserx/physical-preview-3d";
import type * as THREE from "three";
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
});
