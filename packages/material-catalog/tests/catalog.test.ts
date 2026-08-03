import { describe, expect, it } from "vitest";

import {
  CATALOG_PROCESSES,
  MATERIAL_CATALOG,
  catalogIntegrityIssues,
  compatibilityForProcess,
  materialById,
  materialsForFamily,
  resolveCatalogThickness,
  stockPresetsForMaterial,
} from "../src/index.js";

const EXPECTED_MATERIAL_IDS = [
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

describe("material catalog", () => {
  it("has stable deterministic material order and no integrity defects", () => {
    expect(MATERIAL_CATALOG.map(({ id }) => id)).toEqual(EXPECTED_MATERIAL_IDS);
    expect(catalogIntegrityIssues()).toEqual([]);
  });

  it("keeps material, stock, appearance, process, and note collections immutable", () => {
    expect(Object.isFrozen(MATERIAL_CATALOG)).toBe(true);
    for (const material of MATERIAL_CATALOG) {
      expect(Object.isFrozen(material)).toBe(true);
      expect(Object.isFrozen(material.stockPresets)).toBe(true);
      expect(Object.isFrozen(material.processCompatibility)).toBe(true);
      expect(Object.isFrozen(material.appearance)).toBe(true);
      expect(Object.isFrozen(material.notes)).toBe(true);
    }
  });

  it("contains material-scoped globally unique stock IDs", () => {
    const stockIds = MATERIAL_CATALOG.flatMap(({ stockPresets }) =>
      stockPresets.map(({ id }) => id),
    );
    expect(new Set(stockIds).size).toBe(stockIds.length);
    expect(
      MATERIAL_CATALOG.every((material) =>
        material.stockPresets.every((stock) =>
          stock.id.startsWith(`${material.id}:`),
        ),
      ),
    ).toBe(true);
  });

  it("normalizes common fractional-inch stock exactly to canonical millimeters", () => {
    const acrylic = stockPresetsForMaterial("acrylic-cast-clear");
    expect(acrylic.find(({ id }) => id.endsWith(":1-8in"))?.nominalThicknessMm).toBe(
      3.175,
    );
    expect(acrylic.find(({ id }) => id.endsWith(":1-4in"))?.nominalThicknessMm).toBe(
      6.35,
    );

    const plywood = stockPresetsForMaterial("wood-baltic-birch-plywood");
    expect(plywood.find(({ id }) => id.endsWith(":3-4in"))?.nominalThicknessMm).toBe(
      19.05,
    );
  });

  it("uses material-specific stock lists rather than one generic non-metal list", () => {
    const mdf = stockPresetsForMaterial("wood-mdf");
    const hardboard = stockPresetsForMaterial("wood-hardboard");
    const acrylic = stockPresetsForMaterial("acrylic-cast-clear");

    expect(mdf.some(({ id }) => id.endsWith(":25mm"))).toBe(true);
    expect(hardboard.some(({ id }) => id.endsWith(":25mm"))).toBe(false);
    expect(acrylic.some(({ id }) => id.endsWith(":1-16in"))).toBe(true);
    expect(mdf.some(({ id }) => id.endsWith(":1-16in"))).toBe(false);
  });

  it("never treats nominal wood thickness as a measured physical value", () => {
    const preset = stockPresetsForMaterial("wood-mdf").find(({ id }) =>
      id.endsWith(":3-4in"),
    );
    expect(preset).toBeDefined();
    if (preset === undefined) throw new Error("Expected MDF 3/4 in stock.");

    expect(resolveCatalogThickness(preset)).toEqual({
      thicknessMm: 19.05,
      source: "nominal",
      measurementPolicy: "measure-required",
      needsMeasurement: true,
    });
    expect(resolveCatalogThickness(preset, 18.42)).toEqual({
      thicknessMm: 18.42,
      source: "measured",
      measurementPolicy: "measure-required",
      needsMeasurement: false,
    });
  });

  it("marks acrylic nominal stock for measurement without discarding the exact preset", () => {
    const preset = stockPresetsForMaterial("acrylic-cast-clear").find(({ id }) =>
      id.endsWith(":1-4in"),
    );
    expect(preset).toBeDefined();
    if (preset === undefined) throw new Error("Expected acrylic 1/4 in stock.");

    expect(resolveCatalogThickness(preset)).toEqual({
      thicknessMm: 6.35,
      source: "nominal",
      measurementPolicy: "measure-recommended",
      needsMeasurement: true,
    });
    expect(resolveCatalogThickness(preset, 5.91).thicknessMm).toBe(5.91);
  });

  it("rejects invalid measured thickness overrides", () => {
    const preset = stockPresetsForMaterial("acrylic-cast-clear")[0];
    expect(preset).toBeDefined();
    if (preset === undefined) throw new Error("Expected acrylic stock.");

    expect(() => resolveCatalogThickness(preset, 0)).toThrow("positive finite");
    expect(() => resolveCatalogThickness(preset, Number.NaN)).toThrow(
      "positive finite",
    );
  });

  it("provides complete process guidance for every material", () => {
    for (const material of MATERIAL_CATALOG) {
      expect(material.processCompatibility.map(({ process }) => process)).toEqual(
        CATALOG_PROCESSES,
      );
    }

    expect(compatibilityForProcess("acrylic-cast-clear", "co2-laser")).toMatchObject({
      support: "supported",
    });
    expect(compatibilityForProcess("acrylic-cast-clear", "diode-laser")).toMatchObject({
      support: "unsupported",
    });
    expect(compatibilityForProcess("wood-mdf", "router")).toMatchObject({
      support: "supported",
    });
    expect(compatibilityForProcess("wood-mdf", "waterjet")).toMatchObject({
      support: "unsupported",
    });
  });

  it("separates wood and acrylic families and supports stable lookup", () => {
    expect(materialsForFamily("wood")).toHaveLength(4);
    expect(materialsForFamily("acrylic")).toHaveLength(6);
    expect(materialById("acrylic-mirrored")?.appearance.kind).toBe("mirrored");
    expect(materialById("missing")).toBeUndefined();
    expect(stockPresetsForMaterial("missing")).toEqual([]);
  });
});
