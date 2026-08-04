import type { PhysicalPreviewAssembly } from "@laserx/physical-preview-3d";
import type { MeshStandardMaterial } from "three";

import {
  buildAssemblyGeometries,
  disposeAssemblyGeometries,
  type AssemblyLayerGeometry,
} from "./geometry.js";
import { createLayerMaterial, layerAppearance } from "./material.js";
import { assemblyPlacements, type AssemblyMode, type LayerPlacement } from "./placement.js";

/**
 * Everything the adapter allocates for one assembly, with a single owner and a
 * single `dispose()`.
 *
 * The research lab leaked resources precisely because geometry and material
 * lifetimes were tracked ad hoc across React effects. Bundling them means a
 * caller cannot dispose the geometries and forget the materials, and repeated
 * build/dispose cycles stay bounded.
 */
export interface PreviewResources {
  layers: AssemblyLayerGeometry[];
  placements: LayerPlacement[];
  materialsByLayerId: Map<string, MeshStandardMaterial>;
  /** Idempotent: calling it twice is safe and disposes nothing twice. */
  dispose: () => void;
}

export function buildPreviewResources(
  assembly: PhysicalPreviewAssembly,
  mode: AssemblyMode,
): PreviewResources {
  // Geometry conversion is exception-safe on its own; if it throws here nothing
  // has been allocated yet from this call's perspective.
  const layers = buildAssemblyGeometries(assembly);
  const materialsByLayerId = new Map<string, MeshStandardMaterial>();

  let placements;
  try {
    placements = assemblyPlacements(assembly, mode);
    for (const layer of assembly.layers) {
      // A layer that rendered nothing gets no material: allocating one would be
      // a resource with no purpose, and disposal counts are part of this
      // contract.
      if (layer.shapes.length === 0) continue;
      materialsByLayerId.set(layer.layerId, createLayerMaterial(layerAppearance(layer)));
    }
  } catch (error) {
    // The geometries are already allocated and the caller will never receive
    // them, so this call owns releasing them — along with any material built
    // before the failure.
    disposeAssemblyGeometries(layers);
    for (const material of materialsByLayerId.values()) material.dispose();
    materialsByLayerId.clear();
    throw error;
  }

  let disposed = false;
  return {
    layers,
    placements,
    materialsByLayerId,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      disposeAssemblyGeometries(layers);
      for (const material of materialsByLayerId.values()) material.dispose();
      materialsByLayerId.clear();
    },
  };
}
