import { createBlankProject } from "@laserx/domain";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { exportSvg, importSvg } from "../src/index.js";

describe("SVG interchange", () => {
  it("loads the representative 24 inch and 600 mm fixtures at physical scale", () => {
    const inches = importSvg(
      readFileSync(new URL("../../../fixtures/svg/24-inch.svg", import.meta.url), "utf8"),
    );
    const millimeters = importSvg(
      readFileSync(new URL("../../../fixtures/svg/600-mm.svg", import.meta.url), "utf8"),
    );
    expect(inches.dimensionsMm?.widthMm).toBeCloseTo(609.6, 9);
    expect(inches.paths[0]?.closed).toBe(true);
    expect(millimeters.dimensionsMm?.widthMm).toBe(600);
    expect(millimeters.paths.some((path) => path.handles !== undefined)).toBe(true);
  });

  it("imports a 24 inch viewBox at the intended physical scale", () => {
    const candidate = importSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" width="24in" height="10in" viewBox="0 0 24 10">
        <g data-layer="Cut"><line x1="0" y1="10" x2="24" y2="10"/></g>
      </svg>
    `);

    expect(candidate.sourceUnit).toBe("inches");
    expect(candidate.dimensionsMm).toEqual({ widthMm: 609.5999999999999, heightMm: 254 });
    expect(candidate.paths).toHaveLength(1);
    expect(candidate.paths[0]?.layerName).toBe("Cut");
    expect(candidate.paths[0]?.points[1]?.xMm).toBeCloseTo(609.6, 9);
    expect(candidate.paths[0]?.points[0]?.yMm).toBeCloseTo(0, 9);
  });

  it.each([
    ["96px", 25.4, "pixels"],
    ["1in", 25.4, "inches"],
    ["25.4mm", 25.4, "millimeters"],
    ["2.54cm", 25.4, "centimeters"],
  ] as const)("converts %s root dimensions through the 96 px/in CSS ratio", (width, expectedMm, unit) => {
    const candidate = importSvg(`<svg width="${width}" height="${width}" viewBox="0 0 1 1"><line x2="1" y2="1"/></svg>`);
    expect(candidate.sourceUnit).toBe(unit);
    expect(candidate.dimensionsMm?.widthMm).toBeCloseTo(expectedMm, 9);
  });

  it("documents the viewBox-only scale assumption", () => {
    const candidate = importSvg(`<svg viewBox="0 0 96 48"><rect width="96" height="48"/></svg>`);
    expect(candidate.dimensionsMm?.widthMm).toBeCloseTo(25.4, 9);
    expect(candidate.dimensionsMm?.heightMm).toBeCloseTo(12.7, 9);
    expect(candidate.assumptions.join(" ")).toContain("96 px per inch");
  });

  it("normalizes nested transforms and preserves closure", () => {
    const candidate = importSvg(`
      <svg width="100mm" height="100mm" viewBox="0 0 100 100">
        <g transform="translate(10 20)"><polygon transform="scale(2)" points="0,0 10,0 10,10"/></g>
      </svg>
    `);
    const path = candidate.paths[0];
    expect(path?.closed).toBe(true);
    expect(path?.points).toEqual([
      { xMm: 10, yMm: 80 },
      { xMm: 30, yMm: 80 },
      { xMm: 30, yMm: 60 },
    ]);
  });

  it("imports cubic and quadratic path curves as editable handles", () => {
    const candidate = importSvg(`<svg width="100mm" height="100mm" viewBox="0 0 100 100"><path d="M 0 0 C 10 0 10 20 20 20 Q 30 20 40 0 Z"/></svg>`);
    expect(candidate.paths[0]?.closed).toBe(true);
    expect(candidate.paths[0]?.handles).toHaveLength(3);
  });

  it("warns instead of silently reshaping unsupported geometry", () => {
    const candidate = importSvg(`<svg width="10mm" height="10mm"><text>cut me</text><path d="M0 0 A 2 2 0 0 0 4 4"/></svg>`);
    expect(candidate.paths).toHaveLength(0);
    expect(candidate.warnings.map((item) => item.code)).toEqual([
      "unsupported-svg-element",
      "unsupported-svg-geometry",
    ]);
  });

  it("fails safely for active content, entities, and oversized input", () => {
    expect(() => importSvg(`<!DOCTYPE svg [<!ENTITY x "boom">]><svg width="1mm" height="1mm"/>`)).toThrow(/entity declarations/u);
    expect(() => importSvg(`<svg width="1mm" height="1mm"><script/></svg>`)).toThrow(/Unsafe SVG/u);
    expect(() => importSvg(`<svg width="1mm" height="1mm" onload="bad()"/>`)).toThrow(/event-handler/u);
    expect(() => importSvg(" ".repeat(5_000_001))).toThrow(/5 MB/u);
  });

  it("exports explicit millimeter dimensions and round-trips world geometry", () => {
    const project = createBlankProject({
      id: "00000000-0000-5000-8000-000000000001",
      now: "2026-07-31T00:00:00.000Z",
      width: 600,
      height: 300,
      objects: [
        {
          id: "00000000-0000-5000-8000-000000000002",
          type: "line",
          layerId: "00000000-0000-5000-8000-000000000004",
          transform: { a: 1, b: 0, c: 0, d: 1, eMm: 0, fMm: 0 },
          start: { xMm: 0, yMm: 0 },
          end: { xMm: 600, yMm: 300 },
        },
      ],
      layers: [{ id: "00000000-0000-5000-8000-000000000004", name: "Cut", visible: true, locked: false }],
      activeLayerId: "00000000-0000-5000-8000-000000000004",
    });
    const artifact = exportSvg(project.document);
    expect(artifact.content).toContain('width="600mm" height="300mm" viewBox="0 0 600 300"');
    const candidate = importSvg(artifact.content);
    expect(candidate.paths[0]?.points).toEqual([
      { xMm: 0, yMm: 0 },
      { xMm: 600, yMm: 300 },
    ]);
    expect(artifact.summary).toMatchObject({ objectCount: 1, units: "millimeters", warningCount: 0 });
  });

  it("exports and reimports a 24 inch reference rectangle at 609.6 mm", () => {
    const layerId = "00000000-0000-5000-8000-000000000014";
    const project = createBlankProject({
      id: "00000000-0000-5000-8000-000000000011",
      now: "2026-07-31T00:00:00.000Z",
      width: 24,
      height: 12,
      inputUnit: "inches",
      layers: [{ id: layerId, name: "Cut", visible: true, locked: false }],
      activeLayerId: layerId,
      objects: [{
        id: "00000000-0000-5000-8000-000000000012",
        type: "rectangle",
        layerId,
        transform: { a: 1, b: 0, c: 0, d: 1, eMm: 0, fMm: 0 },
        origin: { xMm: 0, yMm: 0 },
        widthMm: 609.6,
        heightMm: 304.8,
      }],
    });
    const artifact = exportSvg(project.document);
    const candidate = importSvg(artifact.content);
    expect(candidate.dimensionsMm?.widthMm).toBeCloseTo(609.6, 9);
    expect(candidate.paths[0]).toMatchObject({ closed: true });
    expect(candidate.paths[0]?.points[1]?.xMm).toBeCloseTo(609.6, 9);
    expect(candidate.paths[0]?.points[2]?.yMm).toBeCloseTo(304.8, 9);
  });
});
