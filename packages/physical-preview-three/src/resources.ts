import type { PhysicalPreviewAssembly } from "@laserx/physical-preview-3d";
import type { MeshStandardMaterial } from "three";

import {
  buildAssemblyGeometries,
  disposeAssemblyGeometries,
  PreviewConversionError,
  type AssemblyLayerGeometry,
  type LayerShapeGeometry,
} from "./geometry.js";
import { createLayerMaterial, layerAppearance } from "./material.js";
import { assemblyPlacements, type AssemblyMode, type LayerPlacement } from "./placement.js";

/** A read-only view of one layer's renderer resources. */
export interface PreviewResourceLayer {
  readonly layerId: string;
  readonly order: number;
  readonly geometries: readonly LayerShapeGeometry[];
}

/**
 * Everything the adapter allocates for one assembly, with a single owner and a
 * single `dispose()`.
 *
 * Public collections are read-only views. Disposal retains separate private
 * ownership, so a consumer cannot clear an exposed collection and accidentally
 * prevent the adapter from releasing resources it allocated.
 */
export interface PreviewResources {
  readonly layers: readonly PreviewResourceLayer[];
  readonly placements: readonly LayerPlacement[];
  readonly materialsByLayerId: ReadonlyMap<string, MeshStandardMaterial>;
  /** Idempotent: calling it twice is safe and disposes nothing twice. */
  readonly dispose: () => void;
}

function readonlyMapView<K, V>(source: ReadonlyMap<K, V>): ReadonlyMap<K, V> {
  const view: ReadonlyMap<K, V> = Object.freeze({
    get size() {
      return source.size;
    },
    get(key: K) {
      return source.get(key);
    },
    has(key: K) {
      return source.has(key);
    },
    forEach(callbackfn: (value: V, key: K, map: ReadonlyMap<K, V>) => void, thisArg?: unknown) {
      source.forEach((value, key) => callbackfn.call(thisArg, value, key, view));
    },
    entries() {
      return source.entries();
    },
    keys() {
      return source.keys();
    },
    values() {
      return source.values();
    },
    [Symbol.iterator]() {
      return source[Symbol.iterator]();
    },
  });
  return view;
}

function exposedLayers(layers: readonly AssemblyLayerGeometry[]): readonly PreviewResourceLayer[] {
  return Object.freeze(
    layers.map((layer) =>
      Object.freeze({
        layerId: layer.layerId,
        order: layer.order,
        geometries: Object.freeze([...layer.geometries]),
      }),
    ),
  );
}

function exposedPlacements(placements: readonly LayerPlacement[]): readonly LayerPlacement[] {
  return Object.freeze(
    placements.map((placement) =>
      Object.freeze({
        ...placement,
        zRangeMm: Object.freeze({ ...placement.zRangeMm }),
      }),
    ),
  );
}

export function buildPreviewResources(
  assembly: PhysicalPreviewAssembly,
  mode: AssemblyMode,
): PreviewResources {
  // Geometry conversion is exception-safe on its own; if it throws here nothing
  // has been allocated yet from this call's perspective.
  const ownedLayers = buildAssemblyGeometries(assembly);
  const ownedMaterials = new Map<string, MeshStandardMaterial>();

  let placements: LayerPlacement[];
  try {
    placements = assemblyPlacements(assembly, mode);
    for (const layer of assembly.layers) {
      // A layer that rendered nothing gets no material: allocating one would be
      // a resource with no purpose, and disposal counts are part of this
      // contract.
      if (layer.shapes.length === 0) continue;
      try {
        ownedMaterials.set(layer.layerId, createLayerMaterial(layerAppearance(layer)));
      } catch (error) {
        // Attributed the same way a geometry conversion failure is: a raw
        // Three/JS error here would give G4 no way to identify which layer's
        // material failed to build.
        throw new PreviewConversionError(
          `Physical layer "${layer.name}" could not be given a preview material.`,
          {
            layerId: layer.layerId,
            shapeId: null,
            sourceObjectIds: [
              ...new Set(layer.shapes.flatMap((shape) => shape.sourceObjectIds)),
            ],
          },
          { cause: error },
        );
      }
    }
  } catch (error) {
    // The geometries are already allocated and the caller will never receive
    // them, so this call owns releasing them — along with any material built
    // before the failure.
    disposeAssemblyGeometries(ownedLayers);
    for (const material of ownedMaterials.values()) material.dispose();
    ownedMaterials.clear();
    throw error;
  }

  const layers = exposedLayers(ownedLayers);
  const visiblePlacements = exposedPlacements(placements);
  const materialsByLayerId = readonlyMapView(ownedMaterials);
  let disposed = false;

  return Object.freeze({
    layers,
    placements: visiblePlacements,
    materialsByLayerId,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      disposeAssemblyGeometries(ownedLayers);
      for (const material of ownedMaterials.values()) material.dispose();
      ownedMaterials.clear();
    },
  });
}
