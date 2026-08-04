import type {
  PhysicalPreviewAssembly,
  PhysicalPreviewContourMm,
  PhysicalPreviewLayer,
  PhysicalPreviewShape,
} from "@laserx/physical-preview-3d";
import { ExtrudeGeometry, Path, Shape, Vector2 } from "three";

/**
 * Pure conversion from the accepted scene contract's outer/hole contours to
 * Three `Shape`/`Shape.holes`, extruded to the exact scene `thicknessMm`.
 *
 * Deliberately outside any React component: React may orchestrate rendering,
 * but must never own authoritative geometry math (ADR 0024 §2).
 *
 * Nothing here invents, repairs, closes, simplifies, unions, or reinterprets
 * geometry. A layer that the scene package failed closed on carries zero
 * shapes, and this module therefore produces zero geometry for it.
 */
export interface LayerShapeGeometry {
  shapeId: string;
  sourceObjectIds: string[];
  geometry: ExtrudeGeometry;
}

/**
 * The contours arriving here are already flattened polylines produced by
 * cutability, so there are no curves left to subdivide. Extruding with
 * `curveSegments: 1` therefore adds no error and avoids multiplying vertex
 * counts on the dense text-heavy inputs G1 measured.
 */
const EXTRUDE_CURVE_SEGMENTS = 1;

/**
 * Worst-case error between an authoritative millimetre value and the same value
 * read back out of rendered geometry.
 *
 * Three stores vertex positions in a `Float32Array`, so canonical millimetres
 * cannot be represented exactly in the buffer: gauge thickness `1.51892 mm`
 * reads back as `1.5189199447631836 mm`, an error of ~5.5e-8 mm. That is larger
 * than domain's `COORDINATE_TOLERANCE_MM` (1e-9) and smaller than
 * `GEOMETRY_ENGINE_TOLERANCE_MM` (1e-6).
 *
 * This is a property of the renderer, not of LaserX's geometry: the exact value
 * stays exact on `PhysicalPreviewLayer.thicknessMm` and in every manufacturing
 * export, and is what dimension readouts must display. Only the *rendered*
 * vertex positions are float32, and nothing downstream may treat a value read
 * back from a buffer as manufacturing evidence.
 */
export const RENDERED_MM_TOLERANCE = 1e-6;

function toVector2Points(points: PhysicalPreviewContourMm["points"]): Vector2[] {
  return points.map((point) => new Vector2(point.xMm, point.yMm));
}

function shapeToThreeShape(shape: PhysicalPreviewShape): Shape {
  const threeShape = new Shape(toVector2Points(shape.outerContour.points));
  for (const hole of shape.holeContours) {
    threeShape.holes.push(new Path(toVector2Points(hole.points)));
  }
  return threeShape;
}

export function buildLayerGeometries(layer: PhysicalPreviewLayer): LayerShapeGeometry[] {
  return layer.shapes.map((shape) => ({
    shapeId: shape.id,
    sourceObjectIds: [...shape.sourceObjectIds],
    geometry: new ExtrudeGeometry(shapeToThreeShape(shape), {
      // Exact canonical thickness, never rounded or defaulted.
      depth: layer.thicknessMm,
      bevelEnabled: false,
      curveSegments: EXTRUDE_CURVE_SEGMENTS,
    }),
  }));
}

export interface AssemblyLayerGeometry {
  layerId: string;
  order: number;
  geometries: LayerShapeGeometry[];
}

/**
 * Converts every layer of an assembly, preserving authoritative order.
 *
 * Layers that produced no shapes are still returned, with an empty geometry
 * list, so a caller cannot lose track of a declared physical layer that failed
 * — it stays visible in readouts while contributing nothing to the render.
 */
export function buildAssemblyGeometries(
  assembly: PhysicalPreviewAssembly,
): AssemblyLayerGeometry[] {
  return assembly.layers.map((layer) => ({
    layerId: layer.layerId,
    order: layer.order,
    geometries: buildLayerGeometries(layer),
  }));
}

/** Releases every GPU buffer owned by the supplied conversion result. */
export function disposeLayerGeometries(entries: readonly LayerShapeGeometry[]): void {
  for (const entry of entries) entry.geometry.dispose();
}

export function disposeAssemblyGeometries(
  layers: readonly AssemblyLayerGeometry[],
): void {
  for (const layer of layers) disposeLayerGeometries(layer.geometries);
}
