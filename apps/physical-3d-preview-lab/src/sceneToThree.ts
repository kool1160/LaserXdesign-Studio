import type {
  PhysicalPreviewContourMm,
  PhysicalPreviewLayer,
  PhysicalPreviewShape,
} from "@laserx/physical-preview-3d";
import * as THREE from "three";

/**
 * Pure, renderer-facing conversion from the scene contract's outer/hole
 * contours to `THREE.Shape`/`Shape.holes`, extruded to the exact scene
 * `thicknessMm`. Deliberately outside any React component: React may
 * orchestrate rendering but must not own authoritative geometry math.
 */
export interface LayerShapeGeometry {
  shapeId: string;
  sourceObjectIds: string[];
  geometry: THREE.ExtrudeGeometry;
}

const EXTRUDE_CURVE_SEGMENTS = 32;

function toVector2Points(points: PhysicalPreviewContourMm["points"]): THREE.Vector2[] {
  return points.map((point) => new THREE.Vector2(point.xMm, point.yMm));
}

function shapeToThreeShape(shape: PhysicalPreviewShape): THREE.Shape {
  const threeShape = new THREE.Shape(toVector2Points(shape.outerContour.points));
  for (const hole of shape.holeContours) {
    threeShape.holes.push(new THREE.Path(toVector2Points(hole.points)));
  }
  return threeShape;
}

export function buildLayerGeometries(layer: PhysicalPreviewLayer): LayerShapeGeometry[] {
  return layer.shapes.map((shape) => ({
    shapeId: shape.id,
    sourceObjectIds: [...shape.sourceObjectIds],
    geometry: new THREE.ExtrudeGeometry(shapeToThreeShape(shape), {
      depth: layer.thicknessMm,
      bevelEnabled: false,
      curveSegments: EXTRUDE_CURVE_SEGMENTS,
    }),
  }));
}
