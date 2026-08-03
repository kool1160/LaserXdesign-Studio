/**
 * The single authoritative list of reviewed physical-preview fixtures.
 * Shared by the browser lab's `?fixture=` hook and the Phase 3 benchmark
 * harness so neither can drift from the other or silently skip a fixture.
 */
export interface FixtureDescriptor {
  /** Stable key used by the lab's `?fixture=` query hook and benchmark output. */
  key: string;
  /** File name under `fixtures/physical-preview/`. */
  file: string;
  /** What this fixture is evidence for. */
  purpose: string;
  /** Expected assembly status, pinned by tests so a fixture cannot silently change meaning. */
  expectedStatus: "complete" | "partial" | "unavailable";
}

export const FIXTURE_REGISTRY: readonly FixtureDescriptor[] = [
  {
    key: "single-layer",
    file: "single-layer-face-plate.laserx",
    purpose: "Single physical layer, millimeter stock, one through-hole.",
    expectedStatus: "complete",
  },
  {
    key: "two-layer",
    file: "two-layer-face-backing.laserx",
    purpose: "Two ordered layers, mixed materials, excluded non-cut-preview layer.",
    expectedStatus: "complete",
  },
  {
    key: "partial-assembly",
    file: "partial-assembly-empty-layer.laserx",
    purpose: "Declared physical layer with no renderable geometry.",
    expectedStatus: "partial",
  },
  {
    key: "gauge-stock",
    file: "gauge-stock-sign.laserx",
    purpose: "Gauge stock designation (16 ga mild steel).",
    expectedStatus: "complete",
  },
  {
    key: "fractional-inch-stock",
    file: "fractional-inch-stock-sign.laserx",
    purpose: "Fractional-inch stock designation (1/8 in stainless).",
    expectedStatus: "complete",
  },
  {
    key: "transformed-group",
    file: "transformed-group-sign.laserx",
    purpose: "Group scale/rotate/translate composed with child translations.",
    expectedStatus: "complete",
  },
  {
    key: "multi-layer-mixed-stock",
    file: "multi-layer-mixed-stock.laserx",
    purpose: "Three layers spanning gauge, fractional-inch, and millimeter stock.",
    expectedStatus: "complete",
  },
  {
    key: "invalid-open-contour",
    file: "invalid-open-contour.laserx",
    purpose: "Open contour; must fail visibly rather than invent a solid.",
    expectedStatus: "partial",
  },
  {
    key: "invalid-self-intersecting",
    file: "invalid-self-intersecting.laserx",
    purpose: "Self-intersecting bowtie; must fail visibly.",
    expectedStatus: "partial",
  },
  {
    key: "high-complexity",
    file: "high-complexity-sign.laserx",
    purpose:
      "Representative high-complexity sign: 58 objects across two layers, 10 solid shapes, 48 interior cutouts.",
    expectedStatus: "complete",
  },
  {
    key: "material-swatch-wood",
    file: "material-swatch-wood.laserx",
    purpose:
      "Single wood layer used to present each wood catalog material on an identical shape.",
    expectedStatus: "complete",
  },
  {
    key: "material-swatch-acrylic",
    file: "material-swatch-acrylic.laserx",
    purpose:
      "Single acrylic layer used to present each acrylic catalog material on an identical shape.",
    expectedStatus: "complete",
  },
  {
    key: "material-mixed-assembly",
    file: "material-mixed-assembly.laserx",
    purpose:
      "Four-layer mixed-material stack: mirrored face, clear spacer, translucent diffuser, opaque wood backing.",
    expectedStatus: "complete",
  },
];

export function fixtureByKey(key: string): FixtureDescriptor | undefined {
  return FIXTURE_REGISTRY.find((fixture) => fixture.key === key);
}
