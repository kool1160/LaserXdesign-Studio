import { createBlankProject } from "@laserx/domain";
import DxfParser from "dxf-parser";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { exportDxf, importDxf } from "../src/index.js";

function dxf(entities: string, units = 4): string {
  return `0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n${String(units)}\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${entities}0\nENDSEC\n0\nEOF\n`;
}

describe("DXF interchange", () => {
  it("loads the representative 24 inch and 600 mm fixtures at physical scale", () => {
    const inches = importDxf(
      readFileSync(new URL("../../../fixtures/dxf/24-inch.dxf", import.meta.url), "utf8"),
    );
    const millimeters = importDxf(
      readFileSync(new URL("../../../fixtures/dxf/600-mm.dxf", import.meta.url), "utf8"),
    );
    expect(inches.paths[0]?.points[1]?.xMm).toBeCloseTo(609.6, 9);
    expect(inches.paths[1]?.closed).toBe(true);
    expect(millimeters.paths[0]?.points[1]?.xMm).toBe(600);
    expect(millimeters.paths).toHaveLength(3);
  });

  it("imports millimeter LINE and closed LWPOLYLINE entities with layers", () => {
    const candidate = importDxf(dxf(
      "0\nLINE\n8\nEtch\n10\n0\n20\n0\n11\n600\n21\n0\n" +
      "0\nLWPOLYLINE\n8\nCut\n90\n3\n70\n1\n10\n0\n20\n0\n10\n10\n20\n0\n10\n10\n20\n10\n",
    ));
    expect(candidate.sourceUnit).toBe("millimeters");
    expect(candidate.paths).toHaveLength(2);
    expect(candidate.paths[0]?.points[1]?.xMm).toBe(600);
    expect(candidate.paths[1]).toMatchObject({ layerName: "Cut", closed: true });
  });

  it("converts inch DXF dimensions exactly to canonical millimeters", () => {
    const candidate = importDxf(dxf("0\nLINE\n10\n0\n20\n0\n11\n24\n21\n0\n", 1));
    expect(candidate.paths[0]?.points[1]?.xMm).toBeCloseTo(609.6, 9);
  });

  it("requires and records an explicit assumption for unitless DXF", () => {
    const source = dxf("0\nLINE\n10\n0\n20\n0\n11\n24\n21\n0\n", 0);
    expect(() => importDxf(source)).toThrow(/Choose whether/u);
    const candidate = importDxf(source, { unitlessUnit: "inches" });
    expect(candidate.sourceUnit).toBe("unitless");
    expect(candidate.paths[0]?.points[1]?.xMm).toBeCloseTo(609.6, 9);
    expect(candidate.assumptions[0]).toContain("explicitly as inches");
  });

  it("flattens circles, arcs, and polyline bulges within a bounded tolerance", () => {
    const candidate = importDxf(dxf(
      "0\nCIRCLE\n8\nCut\n10\n20\n20\n20\n40\n10\n" +
      "0\nARC\n8\nCut\n10\n50\n20\n50\n40\n20\n50\n0\n51\n90\n" +
      "0\nLWPOLYLINE\n8\nCut\n90\n2\n70\n0\n10\n0\n20\n0\n42\n1\n10\n20\n20\n0\n",
    ));
    expect(candidate.paths[0]?.closed).toBe(true);
    expect(candidate.paths[0]?.points.length).toBeGreaterThan(20);
    expect(candidate.paths[1]?.closed).toBe(false);
    expect(candidate.paths[1]?.points.at(-1)).toMatchObject({ xMm: 50, yMm: 70 });
    expect(candidate.paths[2]?.points.length).toBeGreaterThan(2);
  });

  it("imports legacy 2D POLYLINE and warns for unsupported entities and 3D data", () => {
    const candidate = importDxf(dxf(
      "0\nPOLYLINE\n8\nLegacy\n70\n1\n" +
      "0\nVERTEX\n10\n0\n20\n0\n" +
      "0\nVERTEX\n10\n10\n20\n0\n" +
      "0\nVERTEX\n10\n10\n20\n10\n" +
      "0\nSEQEND\n" +
      "0\nSPLINE\n8\nCut\n" +
      "0\nLINE\n10\n0\n20\n0\n30\n1\n11\n2\n21\n2\n",
    ));
    expect(candidate.paths[0]).toMatchObject({ layerName: "Legacy", closed: true });
    expect(candidate.warnings.map((item) => item.code)).toEqual([
      "unsupported-dxf-entity",
      "unsupported-3d-entity",
    ]);
  });

  it("exports explicit millimeter units and preserves 600 mm closure on round trip", () => {
    const layerId = "00000000-0000-5000-8000-000000000004";
    const project = createBlankProject({
      id: "00000000-0000-5000-8000-000000000001",
      now: "2026-07-31T00:00:00.000Z",
      width: 600,
      height: 300,
      layers: [{ id: layerId, name: "Cut", visible: true, locked: false }],
      activeLayerId: layerId,
      objects: [{
        id: "00000000-0000-5000-8000-000000000002",
        type: "path",
        layerId,
        transform: { a: 1, b: 0, c: 0, d: 1, eMm: 0, fMm: 0 },
        closed: true,
        points: [
          { xMm: 0, yMm: 0 },
          { xMm: 600, yMm: 0 },
          { xMm: 600, yMm: 300 },
          { xMm: 0, yMm: 300 },
        ],
      }],
    });
    const artifact = exportDxf(project.document);
    expect(artifact.content).toContain("$INSUNITS\n70\n4\n");
    const candidate = importDxf(artifact.content);
    expect(candidate.paths[0]).toMatchObject({ layerName: "Cut", closed: true });
    expect(candidate.paths[0]?.points[1]?.xMm).toBe(600);
    expect(artifact.summary).toMatchObject({ objectCount: 1, units: "millimeters", warningCount: 0 });

    const independentlyInspected = new DxfParser().parseSync(artifact.content);
    if (independentlyInspected === null) {
      throw new Error("Independent DXF inspector returned no document.");
    }
    expect(independentlyInspected.header.$INSUNITS).toBe(4);
    expect(independentlyInspected.entities).toHaveLength(1);
    expect(independentlyInspected.entities[0]).toMatchObject({
      type: "LWPOLYLINE",
      shape: true,
    });
  });

  it("rejects malformed, binary, and oversized ASCII input safely", () => {
    expect(() => importDxf("0\nSECTION\n2")).toThrow(/line pairs/u);
    expect(() => importDxf("0\nEOF\0\n")).toThrow(/binary/u);
    expect(() => importDxf(" ".repeat(5_000_001))).toThrow(/5 MB/u);
  });
});
