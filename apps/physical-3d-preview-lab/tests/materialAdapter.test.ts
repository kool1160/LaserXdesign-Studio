import { MATERIAL_CATALOG, materialById } from "@laserx/material-catalog";
import type { PhysicalPreviewAssemblyLayer } from "@laserx/physical-preview-3d";
import { describe, expect, it } from "vitest";

import {
  MATERIAL_PRESENTATION_BOUNDS,
  resolveAssemblyMaterials,
  threeParamsForAppearance,
} from "../src/materialAdapter";

/** The ten catalog identifiers this slice is required to present. */
const REQUIRED_MATERIAL_IDS = [
  "wood-mdf",
  "wood-baltic-birch-plywood",
  "wood-hardwood-plywood",
  "wood-hardboard",
  "acrylic-cast-clear",
  "acrylic-cast-opaque",
  "acrylic-cast-translucent",
  "acrylic-extruded-clear",
  "acrylic-mirrored",
  "acrylic-frosted",
] as const;

/** Fetches a catalog entry or fails the test loudly; the repo forbids `!`. */
function requireEntry(id: string) {
  const entry = materialById(id);
  if (entry === undefined) throw new Error(`Missing catalog entry: ${id}`);
  return entry;
}

function requireLayer<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`Missing resolved layer: ${label}`);
  return value;
}

function layerStub(
  overrides: Partial<PhysicalPreviewAssemblyLayer> = {},
): PhysicalPreviewAssemblyLayer {
  return {
    layerId: "layer-1",
    name: "Layer 1",
    role: "face",
    thicknessMm: 6,
    material: {
      material: "acrylic",
      stockThicknessDesignation: null,
      displayLabel: "6 mm",
    },
    shapes: [],
    boundsMm: null,
    order: 0,
    assembledZRangeMm: { minZmm: 0, maxZmm: 6 },
    explodedZRangeMm: { minZmm: 0, maxZmm: 6 },
    catalogMaterialId: null,
    ...overrides,
  };
}

describe("required catalog coverage", () => {
  it("the catalog still contains every material this slice must present", () => {
    for (const id of REQUIRED_MATERIAL_IDS) {
      expect(materialById(id), `missing catalog entry: ${id}`).toBeDefined();
    }
  });

  it("covers every appearance kind the catalog declares", () => {
    const kinds = new Set(MATERIAL_CATALOG.map((entry) => entry.appearance.kind));
    expect([...kinds].sort()).toEqual(
      ["frosted", "mirrored", "opaque", "translucent", "transparent", "wood"].sort(),
    );
  });
});

describe("threeParamsForAppearance", () => {
  it.each(REQUIRED_MATERIAL_IDS)("produces bounded parameters for %s", (id) => {
    const entry = materialById(id);
    if (entry === undefined) throw new Error(`missing ${id}`);
    const params = threeParamsForAppearance(entry.appearance, 6);

    expect(params.roughness).toBeGreaterThanOrEqual(MATERIAL_PRESENTATION_BOUNDS.minRoughness);
    expect(params.roughness).toBeLessThanOrEqual(1);
    expect(params.metalness).toBeGreaterThanOrEqual(0);
    expect(params.metalness).toBeLessThanOrEqual(MATERIAL_PRESENTATION_BOUNDS.maxMetalness);
    expect(params.transmission).toBeGreaterThanOrEqual(0);
    expect(params.transmission).toBeLessThanOrEqual(
      MATERIAL_PRESENTATION_BOUNDS.maxTransmission,
    );
    expect(params.opacity).toBeGreaterThanOrEqual(MATERIAL_PRESENTATION_BOUNDS.minOpacity);
    expect(params.opacity).toBeLessThanOrEqual(1);
    expect(params.ior).toBeGreaterThanOrEqual(MATERIAL_PRESENTATION_BOUNDS.minIor);
    expect(params.ior).toBeLessThanOrEqual(MATERIAL_PRESENTATION_BOUNDS.maxIor);
    expect(params.color).toMatch(/^#[0-9a-f]{6}$/iu);
  });

  it("clamps hostile out-of-range values instead of trusting the input", () => {
    const params = threeParamsForAppearance(
      {
        kind: "transparent",
        baseColorHex: "#ffffff",
        opacity: -5,
        roughness: 99,
        metalness: 42,
        transmission: 7,
      },
      6,
    );
    expect(params.transmission).toBe(MATERIAL_PRESENTATION_BOUNDS.maxTransmission);
    expect(params.metalness).toBe(MATERIAL_PRESENTATION_BOUNDS.maxMetalness);
    expect(params.roughness).toBe(1);
    expect(params.opacity).toBe(MATERIAL_PRESENTATION_BOUNDS.minOpacity);
  });

  it("never lets full transmission make a sheet invisible", () => {
    const params = threeParamsForAppearance(
      { kind: "transparent", baseColorHex: "#ffffff", opacity: 1, roughness: 0, metalness: 0, transmission: 1 },
      6,
    );
    expect(params.transmission).toBeLessThan(1);
  });

  it("separates transparent, translucent, and frosted by roughness", () => {
    const clear = threeParamsForAppearance(
      requireEntry("acrylic-cast-clear").appearance,
      6,
    );
    const translucent = threeParamsForAppearance(
      requireEntry("acrylic-cast-translucent").appearance,
      6,
    );
    const frosted = threeParamsForAppearance(requireEntry("acrylic-frosted").appearance, 6);

    expect(clear.roughness).toBeLessThan(translucent.roughness);
    expect(translucent.roughness).toBeLessThan(frosted.roughness);
    // All three transmit light, and all three use the physical material.
    for (const params of [clear, translucent, frosted]) {
      expect(params.materialClass).toBe("physical");
      expect(params.transmission).toBeGreaterThan(0);
      expect(params.transparent).toBe(true);
      // Transmissive sheets must not write depth or they occlude the layers
      // behind them in an assembled stack.
      expect(params.depthWrite).toBe(false);
      expect(params.doubleSided).toBe(true);
    }
  });

  it("makes clear acrylic transmit more than translucent acrylic", () => {
    const clear = threeParamsForAppearance(requireEntry("acrylic-cast-clear").appearance, 6);
    const translucent = threeParamsForAppearance(
      requireEntry("acrylic-cast-translucent").appearance,
      6,
    );
    expect(clear.transmission).toBeGreaterThan(translucent.transmission);
  });

  it("renders wood and opaque acrylic as fully opaque standard materials", () => {
    for (const id of ["wood-mdf", "wood-baltic-birch-plywood", "acrylic-cast-opaque"]) {
      const params = threeParamsForAppearance(requireEntry(id).appearance, 6);
      expect(params.materialClass).toBe("standard");
      expect(params.transparent).toBe(false);
      expect(params.opacity).toBe(1);
      expect(params.transmission).toBe(0);
      expect(params.depthWrite).toBe(true);
    }
  });

  it("marks mirrored acrylic as reflective and requiring an environment", () => {
    const params = threeParamsForAppearance(requireEntry("acrylic-mirrored").appearance, 6);
    expect(params.metalness).toBeGreaterThan(0.5);
    expect(params.roughness).toBeLessThan(0.2);
    // Without an environment map a high-metalness surface renders near-black.
    expect(params.needsEnvironment).toBe(true);
  });

  it("gives every wood material a distinct colour", () => {
    const colors = ["wood-mdf", "wood-baltic-birch-plywood", "wood-hardwood-plywood", "wood-hardboard"]
      .map((id) => threeParamsForAppearance(requireEntry(id).appearance, 6).color);
    expect(new Set(colors).size).toBe(4);
  });

  it("feeds the layer's real thickness to transmission, and rejects invalid thickness", () => {
    const entry = requireEntry("acrylic-cast-clear");
    expect(threeParamsForAppearance(entry.appearance, 12.7).thicknessMm).toBe(12.7);
    expect(threeParamsForAppearance(entry.appearance, -1).thicknessMm).toBe(0);
    expect(threeParamsForAppearance(entry.appearance, Number.NaN).thicknessMm).toBe(0);
  });

  it("is deterministic", () => {
    for (const id of REQUIRED_MATERIAL_IDS) {
      const entry = requireEntry(id);
      expect(threeParamsForAppearance(entry.appearance, 6)).toEqual(
        threeParamsForAppearance(entry.appearance, 6),
      );
    }
  });
});

describe("resolveAssemblyMaterials", () => {
  it("resolves a known catalog identifier and reports its label", () => {
    const { layers, findings } = resolveAssemblyMaterials([
      layerStub({ catalogMaterialId: "wood-baltic-birch-plywood" }),
    ]);
    expect(findings).toEqual([]);
    expect(layers[0]?.status).toBe("catalog");
    expect(layers[0]?.displayLabel).toBe("Baltic birch plywood");
    expect(layers[0]?.appearanceKind).toBe("wood");
  });

  it("falls back neutrally AND reports a finding for an unknown identifier", () => {
    const { layers, findings } = resolveAssemblyMaterials([
      layerStub({ catalogMaterialId: "wood-unobtainium", name: "Face" }),
    ]);
    expect(layers[0]?.status).toBe("fallback-unknown-id");
    expect(layers[0]?.appearanceKind).toBe("unknown");
    expect(layers[0]?.displayLabel).toContain("wood-unobtainium");
    // The fallback must remain visible, not invisible or black.
    expect(layers[0]?.params.opacity).toBe(1);
    expect(layers[0]?.params.transparent).toBe(false);
    expect(layers[0]?.params.color).toMatch(/^#[0-9a-f]{6}$/iu);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.code).toBe("UNKNOWN_CATALOG_MATERIAL");
    expect(findings[0]?.requestedCatalogMaterialId).toBe("wood-unobtainium");
    expect(findings[0]?.layerId).toBe("layer-1");
    expect(findings[0]?.message).toContain("Face");
  });

  it("preserves pre-catalog domain presentation when no identifier is claimed", () => {
    // Nothing failed here, so this must NOT be the neutral placeholder and
    // must NOT raise a finding.
    const { layers, findings } = resolveAssemblyMaterials([
      layerStub({ catalogMaterialId: null }),
    ]);
    expect(findings).toEqual([]);
    expect(layers[0]?.status).toBe("fallback-no-id");
    expect(layers[0]?.displayLabel).toBe("acrylic");
  });

  it("resolves a mixed stack independently, per layer", () => {
    const { layers, findings } = resolveAssemblyMaterials([
      layerStub({ layerId: "a", catalogMaterialId: "acrylic-mirrored" }),
      layerStub({ layerId: "b", catalogMaterialId: "acrylic-cast-clear" }),
      layerStub({ layerId: "c", catalogMaterialId: "acrylic-cast-translucent" }),
      layerStub({ layerId: "d", catalogMaterialId: "wood-mdf" }),
    ]);
    expect(findings).toEqual([]);
    expect(layers.map((entry) => entry.appearanceKind)).toEqual([
      "mirrored",
      "transparent",
      "translucent",
      "wood",
    ]);
    expect(layers.map((entry) => entry.params.materialClass)).toEqual([
      "standard",
      "physical",
      "physical",
      "standard",
    ]);
  });

  it("reports one finding per unresolvable layer without blocking resolvable ones", () => {
    const { layers, findings } = resolveAssemblyMaterials([
      layerStub({ layerId: "a", catalogMaterialId: "wood-mdf" }),
      layerStub({ layerId: "b", catalogMaterialId: "nope-1" }),
      layerStub({ layerId: "c", catalogMaterialId: "nope-2" }),
    ]);
    expect(layers[0]?.status).toBe("catalog");
    expect(findings).toHaveLength(2);
    expect(findings.map((finding) => finding.layerId)).toEqual(["b", "c"]);
  });

  it("is deterministic and does not mutate the frozen catalog", () => {
    const layers = [layerStub({ catalogMaterialId: "acrylic-frosted" })];
    const first = resolveAssemblyMaterials(layers);
    const second = resolveAssemblyMaterials(layers);
    expect(second).toEqual(first);

    // The catalog is deeply frozen upstream; confirm the adapter neither
    // relies on mutating it nor has silently done so.
    const entry = requireEntry("acrylic-frosted");
    expect(Object.isFrozen(entry)).toBe(true);
    expect(Object.isFrozen(entry.appearance)).toBe(true);
    expect(entry.appearance.roughness).toBe(0.64);
  });

  it("does not mutate the supplied assembly layers", () => {
    const layers = [layerStub({ catalogMaterialId: "wood-mdf" })];
    const before = structuredClone(layers);
    resolveAssemblyMaterials(layers);
    expect(layers).toEqual(before);
  });

  it("returns fresh parameter objects that cannot alias each other", () => {
    const { layers } = resolveAssemblyMaterials([
      layerStub({ layerId: "a", catalogMaterialId: "wood-mdf" }),
      layerStub({ layerId: "b", catalogMaterialId: "wood-mdf" }),
    ]);
    expect(layers[0]?.params).not.toBe(layers[1]?.params);
    requireLayer(layers[0], "a").params.roughness = 0.999;
    expect(layers[1]?.params.roughness).not.toBe(0.999);
  });
});
