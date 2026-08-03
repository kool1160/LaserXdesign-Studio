import type { ManufacturingMaterial } from "@laserx/domain";

export interface MaterialAppearance {
  color: string;
  metalness: number;
  roughness: number;
  opacity: number;
  transparent: boolean;
}

/**
 * Presentation-only appearance, not manufacturing evidence: distinguishes
 * materials visually in the preview. Never used to compute geometry.
 */
const MATERIAL_APPEARANCE: Record<ManufacturingMaterial, MaterialAppearance> = {
  "mild-steel": { color: "#8a8f96", metalness: 0.6, roughness: 0.5, opacity: 1, transparent: false },
  "stainless-steel": {
    color: "#cfd6db",
    metalness: 0.85,
    roughness: 0.2,
    opacity: 1,
    transparent: false,
  },
  aluminum: { color: "#d9dcdf", metalness: 0.7, roughness: 0.3, opacity: 1, transparent: false },
  wood: { color: "#a1703f", metalness: 0, roughness: 0.85, opacity: 1, transparent: false },
  acrylic: { color: "#8ecdf0", metalness: 0.05, roughness: 0.15, opacity: 0.55, transparent: true },
  other: { color: "#9a9a9a", metalness: 0.2, roughness: 0.6, opacity: 1, transparent: false },
};

export function materialAppearance(material: ManufacturingMaterial): MaterialAppearance {
  return MATERIAL_APPEARANCE[material];
}
