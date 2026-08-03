import { MATERIAL_CATALOG } from "@laserx/material-catalog";
import type { PhysicalPreviewAssemblyLayer } from "@laserx/physical-preview-3d";

/**
 * Chooses which catalog material each physical layer is presented with.
 *
 * Kept out of React on purpose: components receive an already-built map and
 * never reason about material identity. Assignments are made by **layer
 * order**, not by hard-coded layer IDs, so a regenerated fixture does not
 * silently lose its material mapping.
 *
 * Every assignment here is ephemeral presentation state. None of it is
 * persisted, and none of it is schema data.
 */

/** Every catalog identifier, in catalog order — the research selector list. */
export const CATALOG_MATERIAL_IDS: readonly string[] = MATERIAL_CATALOG.map(
  (entry) => entry.id,
);

export function isKnownCatalogMaterialId(id: string): boolean {
  return CATALOG_MATERIAL_IDS.includes(id);
}

/**
 * Fixed per-fixture assignments, applied to physical layers in document
 * order. A fixture absent from this table receives no catalog identifiers at
 * all, which preserves the pre-existing domain-material presentation.
 */
const FIXTURE_MATERIAL_ORDER: Readonly<Record<string, readonly string[]>> = {
  // Illuminated-style stack: mirrored face, clear spacer, translucent
  // diffuser, opaque wood backing.
  "material-mixed-assembly": [
    "acrylic-mirrored",
    "acrylic-cast-clear",
    "acrylic-cast-translucent",
    "wood-mdf",
  ],
};

/** Default swatch material per swatch fixture, used when none is requested. */
const SWATCH_DEFAULTS: Readonly<Record<string, string>> = {
  "material-swatch-wood": "wood-baltic-birch-plywood",
  "material-swatch-acrylic": "acrylic-cast-clear",
};

export function defaultMaterialForFixture(fixtureKey: string): string | null {
  return SWATCH_DEFAULTS[fixtureKey] ?? null;
}

/** Reads the research-only `?material=` override. Unknown values are passed through
 *  deliberately so the unknown-material fallback path stays reachable and testable. */
export function requestedMaterialFromLocation(search: string): string | null {
  return new URLSearchParams(search).get("material");
}

/**
 * Builds the ephemeral `layerId -> catalogMaterialId` map.
 *
 * A single-layer swatch fixture takes the requested override (or its
 * default). Multi-layer fixtures use their fixed ordered assignment. An
 * explicit override always wins on swatch fixtures so unknown identifiers
 * can be exercised end to end.
 */
export function catalogMaterialIdsForFixture(
  fixtureKey: string,
  physicalLayers: readonly PhysicalPreviewAssemblyLayer[],
  requestedMaterialId: string | null,
): Record<string, string> {
  const map: Record<string, string> = {};

  const swatchDefault = SWATCH_DEFAULTS[fixtureKey];
  if (swatchDefault !== undefined) {
    const chosen = requestedMaterialId ?? swatchDefault;
    for (const layer of physicalLayers) map[layer.layerId] = chosen;
    return map;
  }

  const ordered = FIXTURE_MATERIAL_ORDER[fixtureKey];
  if (ordered !== undefined) {
    physicalLayers.forEach((layer, index) => {
      const materialId = ordered[index];
      if (materialId !== undefined) map[layer.layerId] = materialId;
    });
  }

  return map;
}
