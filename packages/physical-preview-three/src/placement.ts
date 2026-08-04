import type {
  PhysicalPreviewAssembly,
  PhysicalPreviewAssemblyLayer,
  PhysicalPreviewZRangeMm,
} from "@laserx/physical-preview-3d";

export type AssemblyMode = "assembled" | "exploded";

/**
 * Where a layer's extruded geometry is placed along Z.
 *
 * `ExtrudeGeometry` extrudes from z=0 to z=+depth, so translating the layer's
 * group to `minZmm` reproduces the authoritative range exactly. The Z values
 * are taken verbatim from the scene contract and never recomputed here — this
 * module chooses no spacing and derives no thickness of its own.
 */
export interface LayerPlacement {
  layerId: string;
  order: number;
  /** Group translation on Z, in millimetres. */
  originZmm: number;
  zRangeMm: PhysicalPreviewZRangeMm;
}

export function layerZRange(
  layer: PhysicalPreviewAssemblyLayer,
  mode: AssemblyMode,
): PhysicalPreviewZRangeMm {
  return mode === "assembled" ? layer.assembledZRangeMm : layer.explodedZRangeMm;
}

export function assemblyPlacements(
  assembly: PhysicalPreviewAssembly,
  mode: AssemblyMode,
): LayerPlacement[] {
  return assembly.layers.map((layer) => {
    const zRangeMm = layerZRange(layer, mode);
    return {
      layerId: layer.layerId,
      order: layer.order,
      originZmm: zRangeMm.minZmm,
      // Copied, so a consumer cannot mutate the supplied assembly through it.
      zRangeMm: { minZmm: zRangeMm.minZmm, maxZmm: zRangeMm.maxZmm },
    };
  });
}

/**
 * Total Z extent across the layers being shown.
 *
 * An empty assembly is a real state (a document with no physical layers), and
 * it must produce a usable zero extent rather than `Infinity` from an empty
 * `Math.min`.
 */
export function assemblyZExtent(
  assembly: PhysicalPreviewAssembly,
  mode: AssemblyMode,
  visibleLayerIds?: ReadonlySet<string>,
): PhysicalPreviewZRangeMm {
  const layers = assembly.layers.filter(
    (layer) => visibleLayerIds === undefined || visibleLayerIds.has(layer.layerId),
  );
  if (layers.length === 0) return { minZmm: 0, maxZmm: 0 };

  const ranges = layers.map((layer) => layerZRange(layer, mode));
  return {
    minZmm: Math.min(...ranges.map((range) => range.minZmm)),
    maxZmm: Math.max(...ranges.map((range) => range.maxZmm)),
  };
}
