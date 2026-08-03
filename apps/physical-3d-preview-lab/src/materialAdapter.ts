import type { MaterialAppearance, MaterialCatalogEntry } from "@laserx/material-catalog";
import { materialById } from "@laserx/material-catalog";
import type { PhysicalPreviewAssemblyLayer } from "@laserx/physical-preview-3d";

import { materialAppearance } from "./materialAppearance";

/**
 * Renderer-side adapter between the read-only material catalog and Three.js.
 *
 * This module is the **only** place that knows catalog material identity.
 * `@laserx/physical-preview-3d` carries the catalog ID through opaquely and
 * React components consume the resolved descriptors below, so material
 * identity is never hard-coded in a component.
 *
 * Nothing here mutates the catalog: entries are deeply frozen upstream and
 * every value read out is copied into a fresh descriptor.
 */

/** Which Three material class the resolved parameters require. */
export type ThreeMaterialClass = "standard" | "physical";

export interface ThreeMaterialParams {
  materialClass: ThreeMaterialClass;
  color: string;
  roughness: number;
  metalness: number;
  opacity: number;
  transparent: boolean;
  /** `MeshPhysicalMaterial` only; 0 for standard materials. */
  transmission: number;
  /** Physical thickness fed to transmission, in millimetres (scene units). */
  thicknessMm: number;
  /** Index of refraction; only meaningful when `transmission > 0`. */
  ior: number;
  /** Transparent surfaces must not write depth, or they occlude layers behind them. */
  depthWrite: boolean;
  /** Render both faces for light-transmitting sheets so interior walls stay visible. */
  doubleSided: boolean;
  /** True when this material needs the generated environment map to look correct. */
  needsEnvironment: boolean;
}

export type MaterialResolutionStatus = "catalog" | "fallback-unknown-id" | "fallback-no-id";

export interface ResolvedLayerMaterial {
  layerId: string;
  /** The requested catalog ID, or `null` when the layer named none. */
  requestedCatalogMaterialId: string | null;
  status: MaterialResolutionStatus;
  /** Human-readable material name for readouts. Never a raw ID when resolved. */
  displayLabel: string;
  appearanceKind: MaterialAppearance["kind"] | "unknown";
  params: ThreeMaterialParams;
}

export interface MaterialAdapterFinding {
  code: "UNKNOWN_CATALOG_MATERIAL";
  layerId: string;
  requestedCatalogMaterialId: string;
  message: string;
}

export interface ResolvedAssemblyMaterials {
  layers: ResolvedLayerMaterial[];
  findings: MaterialAdapterFinding[];
}

/**
 * Hard presentation bounds. The catalog already constrains its own values to
 * 0..1, but this adapter must not depend on that remaining true, and some
 * physically-valid values are still bad *presentation* values — full
 * transmission renders a sheet effectively invisible, and roughness of
 * exactly 0 produces a mirror so sharp it reads as a rendering artefact.
 * These caps are deliberately conservative and are asserted by tests.
 */
const BOUNDS = {
  maxTransmission: 0.85,
  maxMetalness: 0.95,
  minRoughness: 0.03,
  minOpacity: 0.12,
  maxIor: 1.6,
  minIor: 1,
} as const;

/** Neutral, clearly-visible grey used when a material cannot be resolved. */
const NEUTRAL_FALLBACK: ThreeMaterialParams = {
  materialClass: "standard",
  color: "#9a9a9a",
  roughness: 0.6,
  metalness: 0.1,
  opacity: 1,
  transparent: false,
  transmission: 0,
  thicknessMm: 0,
  ior: 1,
  depthWrite: true,
  doubleSided: false,
  needsEnvironment: false,
};

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Maps a catalog appearance descriptor onto bounded Three material
 * parameters. Presentation only — it never affects geometry, thickness, or
 * layer order, and it deliberately does not attempt photorealism.
 */
export function threeParamsForAppearance(
  appearance: MaterialAppearance,
  thicknessMm: number,
): ThreeMaterialParams {
  const roughness = clamp(appearance.roughness, BOUNDS.minRoughness, 1);
  const metalness = clamp(appearance.metalness, 0, BOUNDS.maxMetalness);
  const transmission = clamp(appearance.transmission, 0, BOUNDS.maxTransmission);
  const opacity = clamp(appearance.opacity, BOUNDS.minOpacity, 1);
  const safeThicknessMm = Number.isFinite(thicknessMm) && thicknessMm > 0 ? thicknessMm : 0;

  switch (appearance.kind) {
    case "wood":
    case "opaque":
      return {
        materialClass: "standard",
        color: appearance.baseColorHex,
        roughness,
        metalness,
        opacity: 1,
        transparent: false,
        transmission: 0,
        thicknessMm: safeThicknessMm,
        ior: 1,
        depthWrite: true,
        doubleSided: false,
        needsEnvironment: false,
      };

    case "mirrored":
      // A high-metalness surface with no environment renders near-black, so
      // mirrored stock explicitly requires the generated environment map.
      return {
        materialClass: "standard",
        color: appearance.baseColorHex,
        roughness,
        metalness,
        opacity: 1,
        transparent: false,
        transmission: 0,
        thicknessMm: safeThicknessMm,
        ior: 1,
        depthWrite: true,
        doubleSided: false,
        needsEnvironment: true,
      };

    case "transparent":
    case "translucent":
    case "frosted":
      // Roughness is what visually separates these three: clear stock stays
      // sharp, translucent diffuses, frosted scatters strongly.
      return {
        materialClass: "physical",
        color: appearance.baseColorHex,
        roughness,
        metalness,
        opacity,
        transparent: true,
        transmission,
        thicknessMm: safeThicknessMm,
        ior: clamp(1.49, BOUNDS.minIor, BOUNDS.maxIor),
        depthWrite: false,
        doubleSided: true,
        needsEnvironment: true,
      };
  }
}

function labelForEntry(entry: MaterialCatalogEntry): string {
  return entry.label;
}

/**
 * Resolves every layer's ephemeral catalog identifier into bounded Three
 * material parameters, degrading visibly rather than silently:
 *
 * - identifier present and known → catalog appearance;
 * - identifier present but unknown → neutral fallback **plus a finding**;
 * - no identifier → neutral fallback, no finding (nothing was claimed).
 */
export function resolveAssemblyMaterials(
  layers: readonly PhysicalPreviewAssemblyLayer[],
): ResolvedAssemblyMaterials {
  const findings: MaterialAdapterFinding[] = [];

  const resolved = layers.map<ResolvedLayerMaterial>((layer) => {
    const requested = layer.catalogMaterialId;

    if (requested === null) {
      // No catalog material was claimed for this layer, so nothing failed.
      // Preserve the pre-catalog domain-material presentation exactly rather
      // than degrading to the neutral placeholder — the neutral appearance is
      // reserved for genuine resolution failures, so it stays a meaningful
      // signal instead of the common case.
      const domain = materialAppearance(layer.material.material);
      return {
        layerId: layer.layerId,
        requestedCatalogMaterialId: null,
        status: "fallback-no-id",
        displayLabel: layer.material.material,
        appearanceKind: "unknown",
        params: {
          materialClass: "standard",
          color: domain.color,
          roughness: clamp(domain.roughness, BOUNDS.minRoughness, 1),
          metalness: clamp(domain.metalness, 0, BOUNDS.maxMetalness),
          opacity: clamp(domain.opacity, BOUNDS.minOpacity, 1),
          transparent: domain.transparent,
          transmission: 0,
          thicknessMm: layer.thicknessMm,
          ior: 1,
          depthWrite: !domain.transparent,
          doubleSided: domain.transparent,
          needsEnvironment: false,
        },
      };
    }

    const entry = materialById(requested);
    if (entry === undefined) {
      findings.push({
        code: "UNKNOWN_CATALOG_MATERIAL",
        layerId: layer.layerId,
        requestedCatalogMaterialId: requested,
        message: `Layer "${layer.name}" requests unknown catalog material "${requested}"; showing a neutral placeholder appearance.`,
      });
      return {
        layerId: layer.layerId,
        requestedCatalogMaterialId: requested,
        status: "fallback-unknown-id",
        displayLabel: `Unknown material (${requested})`,
        appearanceKind: "unknown",
        params: { ...NEUTRAL_FALLBACK },
      };
    }

    return {
      layerId: layer.layerId,
      requestedCatalogMaterialId: requested,
      status: "catalog",
      displayLabel: labelForEntry(entry),
      appearanceKind: entry.appearance.kind,
      params: threeParamsForAppearance(entry.appearance, layer.thicknessMm),
    };
  });

  return { layers: resolved, findings };
}

export const MATERIAL_PRESENTATION_BOUNDS = BOUNDS;
export const NEUTRAL_FALLBACK_PARAMS: Readonly<ThreeMaterialParams> = Object.freeze({
  ...NEUTRAL_FALLBACK,
});
