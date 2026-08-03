import { describe, expect, it } from "vitest";

import { MATERIAL_CATALOG } from "../src/index.js";
import {
  LIGHTBURN_LIBRARY_EXTENSION,
  LIGHTBURN_STARTER_MATERIALS,
  lightBurnCutLibraryKeys,
  lightBurnStarterIntegrityIssues,
  lightBurnStarterMaterialById,
  lightBurnStarterMaterialsForFamily,
  lightBurnSurfaceLibraryKeys,
} from "../src/lightburn.js";

const EXPECTED_STARTER_IDS = [
  "wood-mdf",
  "wood-basswood-plywood",
  "wood-birch-plywood",
  "wood-baltic-birch-plywood",
  "wood-hardwood-plywood",
  "wood-solid-hardwood",
  "wood-veneer",
  "wood-hardboard",
  "acrylic-cast-clear",
  "acrylic-cast-opaque",
  "acrylic-cast-translucent",
  "acrylic-extruded-clear",
  "acrylic-extruded-color",
  "acrylic-frosted",
  "acrylic-mirrored",
] as const;

describe("LightBurn-aligned starter taxonomy", () => {
  it("uses stable common-material ordering with no integrity defects", () => {
    expect(LIGHTBURN_STARTER_MATERIALS.map(({ id }) => id)).toEqual(
      EXPECTED_STARTER_IDS,
    );
    expect(lightBurnStarterIntegrityIssues()).toEqual([]);
    expect(LIGHTBURN_LIBRARY_EXTENSION).toBe(".clb");
  });

  it("prioritizes the wood materials laser users commonly recognize", () => {
    expect(lightBurnStarterMaterialsForFamily("wood").map(({ materialName }) =>
      materialName,
    )).toEqual([
      "MDF",
      "Basswood Plywood",
      "Birch Plywood",
      "Baltic Birch Plywood",
      "Hardwood Plywood",
      "Solid Hardwood",
      "Wood Veneer",
      "Hardboard / Masonite",
    ]);
  });

  it("separates cast, extruded, frosted, and mirrored acrylic groups", () => {
    expect(
      lightBurnStarterMaterialsForFamily("acrylic").map(({ materialName }) =>
        materialName,
      ),
    ).toEqual([
      "Cast Acrylic — Clear",
      "Cast Acrylic — Opaque Color",
      "Cast Acrylic — Transparent / Translucent Color",
      "Extruded Acrylic — Clear",
      "Extruded Acrylic — Color",
      "Acrylic — Frosted",
      "Acrylic — Mirrored",
    ]);
  });

  it("uses the LightBurn material-thickness-description hierarchy for cuts", () => {
    const keys = lightBurnCutLibraryKeys("acrylic-cast-clear", "Cut — polished edge");
    expect(keys.length).toBeGreaterThan(5);
    expect(keys[0]).toMatchObject({
      materialName: "Cast Acrylic — Clear",
      title: null,
      description: "Cut — polished edge",
    });
    expect(keys.every(({ thicknessMm, thicknessLabel }) =>
      thicknessMm !== null && thicknessLabel !== null,
    )).toBe(true);
  });

  it("uses No Thickness titles for surface operations", () => {
    expect(lightBurnSurfaceLibraryKeys("wood-mdf")).toEqual([
      {
        materialName: "MDF",
        thicknessMm: null,
        thicknessLabel: null,
        title: "Engrave",
        description: "Engrave — test on this machine",
      },
      {
        materialName: "MDF",
        thicknessMm: null,
        thicknessLabel: null,
        title: "Score",
        description: "Score — test on this machine",
      },
    ]);
  });

  it("keeps exact inch-to-millimeter conversion in the familiar thickness groups", () => {
    const basswood = lightBurnStarterMaterialById("wood-basswood-plywood");
    const acrylic = lightBurnStarterMaterialById("acrylic-cast-clear");
    expect(
      basswood?.commonThicknesses.find(({ id }) => id === "1-8in")
        ?.thicknessMm,
    ).toBe(3.175);
    expect(
      acrylic?.commonThicknesses.find(({ id }) => id === "3-16in")
        ?.thicknessMm,
    ).toBe(4.762499999999999);
  });

  it("maps existing physical materials and explicitly marks planned additions", () => {
    const physicalIds = new Set(MATERIAL_CATALOG.map(({ id }) => id));
    for (const material of LIGHTBURN_STARTER_MATERIALS) {
      if (material.physicalCatalogId !== null) {
        expect(physicalIds.has(material.physicalCatalogId)).toBe(true);
      }
    }
    expect(
      lightBurnStarterMaterialById("wood-basswood-plywood")?.physicalCatalogId,
    ).toBeNull();
    expect(
      lightBurnStarterMaterialById("acrylic-extruded-color")?.physicalCatalogId,
    ).toBeNull();
  });

  it("contains no universal machine settings because LightBurn libraries are device-specific", () => {
    for (const material of LIGHTBURN_STARTER_MATERIALS) {
      expect(material).not.toHaveProperty("speed");
      expect(material).not.toHaveProperty("power");
      expect(material).not.toHaveProperty("passes");
      expect(material).not.toHaveProperty("airAssist");
      expect(material).not.toHaveProperty("focusOffset");
    }
  });
});
