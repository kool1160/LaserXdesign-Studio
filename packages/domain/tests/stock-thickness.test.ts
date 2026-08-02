import { describe, expect, it } from "vitest";

import {
  DEFAULT_MANUFACTURING_SETTINGS,
  copyManufacturingSettings,
  formatStockThickness,
  stockThicknessChoicesForMaterial,
} from "../src/index.js";

describe("U.S. stock thickness designations", () => {
  it("keeps gauge tables material-specific while retaining canonical millimeters", () => {
    const mild = stockThicknessChoicesForMaterial("mild-steel").find(
      (choice) => choice.designation.kind === "gauge" && choice.designation.label === "16 ga",
    );
    const stainless = stockThicknessChoicesForMaterial("stainless-steel").find(
      (choice) => choice.designation.kind === "gauge" && choice.designation.label === "16 ga",
    );
    if (mild === undefined || stainless === undefined) throw new Error("Missing reviewed gauge fixtures.");
    expect(mild.thicknessMm).toBeCloseTo(1.51892, 9);
    expect(stainless.thicknessMm).toBeCloseTo(1.5875, 9);
    expect(mild.thicknessMm).not.toBe(stainless.thicknessMm);
    expect(mild.designation.material).toBe("mild-steel");
    expect(stainless.designation.material).toBe("stainless-steel");
  });

  it("formats gauge, fractional, metric, and custom stock with dual-unit context", () => {
    const choices = [
      ...stockThicknessChoicesForMaterial("mild-steel"),
      ...stockThicknessChoicesForMaterial("stainless-steel"),
      ...stockThicknessChoicesForMaterial("aluminum"),
    ];
    expect(choices.find((choice) => choice.id === "gauge:mild-steel:14 ga")?.label)
      .toBe("14 ga · 0.0747 in · 1.897 mm");
    expect(choices.find((choice) => choice.id === "gauge:stainless-steel:14 ga")?.label)
      .toBe("14 ga · 0.078125 in · 1.984 mm");
    expect(choices.find((choice) => choice.id === "gauge:aluminum:14 ga")?.label)
      .toBe("14 ga · 0.0641 in · 1.628 mm");
    expect(choices.find((choice) => choice.id === "fractional-inch:1/8 in")?.label)
      .toBe("1/8 in · 3.175 mm");
    expect(choices.find((choice) => choice.id === "millimeter:3")?.label)
      .toBe("3 mm · 0.11811 in");
    expect(formatStockThickness(2.345, {
      kind: "custom",
      label: "Custom",
      material: null,
    })).toBe("Custom · 0.092323 in · 2.345 mm");
  });

  it("accepts matching gauge, fractional, millimeter, and custom choices", () => {
    for (const kind of ["gauge", "fractional-inch", "millimeter"] as const) {
      const choice = stockThicknessChoicesForMaterial("mild-steel").find(
        (candidate) => candidate.designation.kind === kind,
      );
      if (choice === undefined) throw new Error(`Missing ${kind} stock fixture.`);
      expect(() => copyManufacturingSettings({
        ...DEFAULT_MANUFACTURING_SETTINGS,
        thicknessMm: choice.thicknessMm,
        stockThicknessDesignation: choice.designation,
      })).not.toThrow();
    }
    expect(() => copyManufacturingSettings({
      ...DEFAULT_MANUFACTURING_SETTINGS,
      thicknessMm: 2.345,
      stockThicknessDesignation: { kind: "custom", label: "Customer stock", material: null },
    })).not.toThrow();
  });

  it("rejects a cross-material or numerically mismatched gauge", () => {
    expect(() => copyManufacturingSettings({
      ...DEFAULT_MANUFACTURING_SETTINGS,
      material: "stainless-steel",
      thicknessMm: 1.51892,
      stockThicknessDesignation: {
        kind: "gauge",
        label: "16 ga",
        material: "mild-steel",
      },
    })).toThrow(/selected material/u);

    expect(() => copyManufacturingSettings({
      ...DEFAULT_MANUFACTURING_SETTINGS,
      thicknessMm: 3,
      stockThicknessDesignation: {
        kind: "gauge",
        label: "16 ga",
        material: "mild-steel",
      },
    })).toThrow(/does not match/u);
  });
});
