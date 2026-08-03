import { readFileSync } from "node:fs";

import { buildPhysicalPreviewAssembly } from "@laserx/physical-preview-3d";
import { parseProject } from "@laserx/project-format";
import { describe, expect, it } from "vitest";

import { FIXTURE_REGISTRY } from "../src/fixtureRegistry";

function readFixture(file: string): string {
  return readFileSync(
    new URL(`../../../fixtures/physical-preview/${file}`, import.meta.url),
    "utf8",
  );
}

describe("reviewed physical-preview fixtures", () => {
  it.each(FIXTURE_REGISTRY)(
    "$key parses at schema v9 and reports its reviewed status",
    (descriptor) => {
      const project = parseProject(readFixture(descriptor.file));
      expect(project.schemaVersion).toBe(9);
      const assembly = buildPhysicalPreviewAssembly(project);
      expect(assembly.status).toBe(descriptor.expectedStatus);
    },
  );

  it("pins exact canonical thicknesses for each stock designation kind", () => {
    const gauge = buildPhysicalPreviewAssembly(
      parseProject(readFixture("gauge-stock-sign.laserx")),
    );
    // 16 ga mild steel = 0.0598 in x 25.4 mm/in, carried exactly.
    expect(gauge.layers[0]?.thicknessMm).toBeCloseTo(1.51892, 9);
    expect(gauge.layers[0]?.material.stockThicknessDesignation).toEqual({
      kind: "gauge",
      label: "16 ga",
      material: "mild-steel",
    });

    const fractional = buildPhysicalPreviewAssembly(
      parseProject(readFixture("fractional-inch-stock-sign.laserx")),
    );
    // 1/8 in = 3.175 mm exactly.
    expect(fractional.layers[0]?.thicknessMm).toBe(3.175);
    expect(fractional.layers[0]?.material.stockThicknessDesignation?.kind).toBe(
      "fractional-inch",
    );

    const mixed = buildPhysicalPreviewAssembly(
      parseProject(readFixture("multi-layer-mixed-stock.laserx")),
    );
    expect(mixed.layers.map((layer) => layer.material.stockThicknessDesignation?.kind)).toEqual([
      "gauge",
      "fractional-inch",
      "millimeter",
    ]);
    expect(mixed.layers.map((layer) => layer.material.material)).toEqual([
      "mild-steel",
      "aluminum",
      "acrylic",
    ]);
    // 14 ga mild steel, 1/4 in aluminum, 6 mm acrylic — declared depth sums exactly.
    expect(mixed.assembledDepthMm).toBeCloseTo(1.89738 + 6.35 + 6, 9);
    expect(mixed.depthStatus).toBe("verified");
  });

  it("fails visibly for the open-contour fixture without inventing a solid", () => {
    const assembly = buildPhysicalPreviewAssembly(
      parseProject(readFixture("invalid-open-contour.laserx")),
    );
    expect(assembly.status).toBe("partial");
    expect(assembly.depthStatus).toBe("declared-incomplete");
    expect(assembly.layers[0]?.shapes).toEqual([]);
    expect(assembly.findings.map((finding) => finding.code)).toContain("OPEN_CONTOUR");
  });

  it("fails visibly for the self-intersecting fixture without inventing a solid", () => {
    const assembly = buildPhysicalPreviewAssembly(
      parseProject(readFixture("invalid-self-intersecting.laserx")),
    );
    expect(assembly.status).toBe("partial");
    expect(assembly.layers[0]?.shapes).toEqual([]);
    expect(assembly.findings.map((finding) => finding.code)).toContain("SELF_INTERSECTION");
  });

  it("pins the high-complexity fixture's reviewed composition", () => {
    const assembly = buildPhysicalPreviewAssembly(
      parseProject(readFixture("high-complexity-sign.laserx")),
    );
    expect(assembly.status).toBe("complete");
    expect(assembly.layers).toHaveLength(2);
    const shapes = assembly.layers.reduce((sum, layer) => sum + layer.shapes.length, 0);
    const holes = assembly.layers.reduce(
      (sum, layer) =>
        sum + layer.shapes.reduce((inner, shape) => inner + shape.holeContours.length, 0),
      0,
    );
    expect(shapes).toBe(10);
    expect(holes).toBe(48);
  });

  it("preserves exact world-space geometry for the transformed-group fixture", () => {
    const assembly = buildPhysicalPreviewAssembly(
      parseProject(readFixture("transformed-group-sign.laserx")),
    );
    const shape = assembly.layers[0]?.shapes[0];
    if (shape === undefined) throw new Error("Expected one transformed shape.");
    // Group {a:0,b:2,c:-2,d:0,e:120,f:15} means world = (120 - 2y, 2x + 15),
    // composed with the child's own translate(5, 4).
    expect(shape.outerContour.points).toEqual([
      { xMm: 112, yMm: 25 },
      { xMm: 112, yMm: 105 },
      { xMm: 62, yMm: 105 },
      { xMm: 62, yMm: 25 },
    ]);
    expect(shape.holeContours).toHaveLength(1);
  });
});
