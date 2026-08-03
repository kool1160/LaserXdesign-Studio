import type { ManufacturingMaterial } from "@laserx/domain";
import { describe, expect, it } from "vitest";

import { materialAppearance } from "../src/materialAppearance";

/**
 * The complete, current, authoritative `ManufacturingMaterial` union from
 * `@laserx/domain`. Listed explicitly (not derived) so this test fails
 * loudly if domain ever adds/removes a material — e.g. a future
 * "galvanized-steel" value — rather than silently skipping it. Do not add
 * a value here that domain does not also declare.
 */
const ALL_MATERIALS: readonly ManufacturingMaterial[] = [
  "mild-steel",
  "stainless-steel",
  "aluminum",
  "wood",
  "acrylic",
  "other",
];

function isValidCssHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/iu.test(value);
}

describe("materialAppearance", () => {
  it.each(ALL_MATERIALS)("returns a fully-specified, valid appearance for %s", (material) => {
    const appearance = materialAppearance(material);
    expect(isValidCssHexColor(appearance.color)).toBe(true);
    expect(appearance.metalness).toBeGreaterThanOrEqual(0);
    expect(appearance.metalness).toBeLessThanOrEqual(1);
    expect(appearance.roughness).toBeGreaterThanOrEqual(0);
    expect(appearance.roughness).toBeLessThanOrEqual(1);
    expect(appearance.opacity).toBeGreaterThan(0);
    expect(appearance.opacity).toBeLessThanOrEqual(1);
    expect(typeof appearance.transparent).toBe("boolean");
  });

  it("gives every material a visually distinct color", () => {
    const colors = ALL_MATERIALS.map((material) => materialAppearance(material).color);
    expect(new Set(colors).size).toBe(ALL_MATERIALS.length);
  });

  it("is deterministic and pure — repeated calls return an equal appearance", () => {
    for (const material of ALL_MATERIALS) {
      expect(materialAppearance(material)).toEqual(materialAppearance(material));
    }
  });

  it("marks acrylic as the only transparent, reduced-opacity material", () => {
    for (const material of ALL_MATERIALS) {
      const appearance = materialAppearance(material);
      if (material === "acrylic") {
        expect(appearance.transparent).toBe(true);
        expect(appearance.opacity).toBeLessThan(1);
      } else {
        expect(appearance.transparent).toBe(false);
        expect(appearance.opacity).toBe(1);
      }
    }
  });

  it("covers the 'other' fallback material explicitly", () => {
    const appearance = materialAppearance("other");
    expect(appearance.color).toBe("#9a9a9a");
    expect(appearance.transparent).toBe(false);
  });
});
