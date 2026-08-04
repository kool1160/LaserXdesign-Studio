import type { PhysicalPreviewLayer } from "@laserx/physical-preview-3d";
import { MeshStandardMaterial } from "three";

/**
 * Presentation-only appearance. **Never manufacturing evidence** and never used
 * to compute geometry — it exists solely to tell materials apart on screen.
 *
 * Keyed by the *current* schema-v9 `ManufacturingMaterial` values carried on the
 * scene contract. The M16 material catalog is deliberately not promoted here:
 * ADR 0024 §2 requires this package to stay catalog-independent, so an unknown
 * value falls back to a neutral appearance rather than reaching for a richer
 * source of truth that M14 has not accepted.
 */
export interface MaterialAppearance {
  color: string;
  metalness: number;
  roughness: number;
  opacity: number;
  transparent: boolean;
}

const NEUTRAL_FALLBACK: MaterialAppearance = {
  color: "#9a9a9a",
  metalness: 0.2,
  roughness: 0.6,
  opacity: 1,
  transparent: false,
};

const MATERIAL_APPEARANCE: Readonly<Record<string, MaterialAppearance>> = {
  "mild-steel": {
    color: "#8a8f96",
    metalness: 0.6,
    roughness: 0.5,
    opacity: 1,
    transparent: false,
  },
  "stainless-steel": {
    color: "#cfd6db",
    metalness: 0.85,
    roughness: 0.2,
    opacity: 1,
    transparent: false,
  },
  aluminum: {
    color: "#d9dcdf",
    metalness: 0.7,
    roughness: 0.3,
    opacity: 1,
    transparent: false,
  },
  wood: { color: "#a1703f", metalness: 0, roughness: 0.85, opacity: 1, transparent: false },
  acrylic: {
    color: "#8ecdf0",
    metalness: 0.05,
    roughness: 0.15,
    opacity: 0.55,
    transparent: true,
  },
  other: NEUTRAL_FALLBACK,
};

/**
 * Returns a copy, so a caller cannot mutate the shared table and silently change
 * every later layer's appearance.
 */
export function materialAppearance(material: string): MaterialAppearance {
  return { ...(MATERIAL_APPEARANCE[material] ?? NEUTRAL_FALLBACK) };
}

export function layerAppearance(layer: PhysicalPreviewLayer): MaterialAppearance {
  return materialAppearance(layer.material.material);
}

export const NEUTRAL_FALLBACK_APPEARANCE: MaterialAppearance = { ...NEUTRAL_FALLBACK };

/**
 * Creates the Three material for an appearance.
 *
 * The adapter owns this resource, so it also owns disposing it — see
 * {@link disposeMaterials}. Materials are not shared between layers: sharing one
 * instance would make disposal order a hazard for the caller.
 */
export function createLayerMaterial(appearance: MaterialAppearance): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: appearance.color,
    metalness: appearance.metalness,
    roughness: appearance.roughness,
    opacity: appearance.opacity,
    transparent: appearance.transparent,
  });
}

export function disposeMaterials(materials: readonly MeshStandardMaterial[]): void {
  for (const material of materials) material.dispose();
}
