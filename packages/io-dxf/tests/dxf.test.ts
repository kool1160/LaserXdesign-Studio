import { createBlankProject } from "@laserx/domain";
import DxfParser from "dxf-parser";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { exportDxf, importDxf } from "../src/index.js";

function dxf(entities: string, units = 4): string {
  return `0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n${String(units)}\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${entities}0\nENDSEC\n0\nEOF\n`;
}

function referenceRectangleProject(widthMm: number, heightMm: number) {
  const layerId = "00000000-0000-5000-8000-000000000024";
  return createBlankProject({
    id: "00000000-0000-5000-8000-000000000021",
    now: "2026-07-31T00:00:00.000Z",
    width: widthMm,
    height: heightMm,
    layers: [{ id: layerId, name: "Cut", visible: true, locked: false }],
    activeLayerId: layerId,
    objects: [{
      id: "00000000-0000-5000-8000-000000000022",
      type: "path",
      layerId,
      transform: { a: 1, b: 0, c: 0, d: 1, eMm: 0, fMm: 0 },
      closed: true,
      points: [
        { xMm: 0, yMm: 0 },
        { xMm: widthMm, yMm: 0 },
        { xMm: widthMm, yMm: heightMm },
        { xMm: 0, yMm: heightMm },
      ],
    }],
  });
}

function transformedCubicProject() {
  const layerId = "00000000-0000-5000-8000-000000000034";
  return createBlankProject({
    id: "00000000-0000-5000-8000-000000000031",
    now: "2026-07-31T00:00:00.000Z",
    width: 600,
    height: 500,
    layers: [{ id: layerId, name: "Cut", visible: true, locked: false }],
    activeLayerId: layerId,
    objects: [{
      id: "00000000-0000-5000-8000-000000000032",
      type: "group",
      layerId,
      transform: { a: 5, b: 0, c: 0, d: 5, eMm: 20, fMm: 30 },
      children: [{
        id: "00000000-0000-5000-8000-000000000033",
        type: "path",
        layerId,
        transform: { a: 10, b: 0, c: 0, d: 10, eMm: 2, fMm: 3 },
        closed: false,
        points: [{ xMm: 0, yMm: 0 }, { xMm: 10, yMm: 0 }],
        handles: [
          { incoming: null, outgoing: { xMm: 0, yMm: 10 } },
          { incoming: { xMm: 10, yMm: 10 }, outgoing: null },
        ],
      }],
    }],
  });
}

function independentlyParsedPolylineBounds(content: string) {
  const inspected = new DxfParser().parseSync(content);
  if (inspected === null) {
    throw new Error("Independent DXF inspector returned no document.");
  }
  const entity = inspected.entities[0];
  const vertices = (entity as { vertices?: Array<{ x: number; y: number }> } | undefined)
    ?.vertices;
  if (entity?.type !== "LWPOLYLINE" || vertices === undefined || vertices.length === 0) {
    throw new Error("Independent DXF inspector did not return a polyline with vertices.");
  }
  return {
    units: inspected.header.$INSUNITS,
    type: entity.type,
    shape: (entity as { shape?: boolean }).shape,
    bounds: vertices.reduce(
      (bounds, vertex) => ({
        minXmm: Math.min(bounds.minXmm, vertex.x),
        minYmm: Math.min(bounds.minYmm, vertex.y),
        maxXmm: Math.max(bounds.maxXmm, vertex.x),
        maxYmm: Math.max(bounds.maxYmm, vertex.y),
      }),
      {
        minXmm: Number.POSITIVE_INFINITY,
        minYmm: Number.POSITIVE_INFINITY,
        maxXmm: Number.NEGATIVE_INFINITY,
        maxYmm: Number.NEGATIVE_INFINITY,
      },
    ),
  };
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

  it("keeps circles at or below tolerance as valid three-node contours", () => {
    const candidate = importDxf(dxf(
      "0\nCIRCLE\n8\nCut\n10\n0\n20\n0\n40\n0.005\n",
    ));
    const points = candidate.paths[0]?.points ?? [];
    const distinctPoints = new Set(
      points.map((point) => `${point.xMm.toPrecision(12)},${point.yMm.toPrecision(12)}`),
    );
    expect(candidate.paths[0]).toMatchObject({ closed: true });
    expect(points.length).toBeGreaterThanOrEqual(3);
    expect(distinctPoints.size).toBeGreaterThanOrEqual(3);
  });

  it("rejects a sub-5-MB expanded-geometry bomb before exceeding the point budget", () => {
    const circle = "0\nCIRCLE\n8\nCut\n10\n0\n20\n0\n40\n1000000000000\n";
    const source = dxf(circle.repeat(49));
    expect(source.length).toBeLessThan(5_000_000);
    expect(() => importDxf(source)).toThrow(/200,000 geometry-point safety limit/u);
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

  it.each([
    ["600 mm", 600, 300],
    ["24 inch", 609.6, 304.8],
  ] as const)("independently validates the exported %s reference coordinates and bounds", (
    _label,
    widthMm,
    heightMm,
  ) => {
    const artifact = exportDxf(
      referenceRectangleProject(widthMm, heightMm).document,
    );
    const inspected = independentlyParsedPolylineBounds(artifact.content);
    expect(inspected).toMatchObject({
      units: 4,
      type: "LWPOLYLINE",
      shape: true,
      bounds: {
        minXmm: 0,
        minYmm: 0,
        maxXmm: widthMm,
        maxYmm: heightMm,
      },
    });
  });

  it("round-trips nested transformed cubic bounds within the 0.01 mm world tolerance", () => {
    const artifact = exportDxf(transformedCubicProject().document);
    const candidate = importDxf(artifact.content);
    const points = candidate.paths[0]?.points ?? [];
    const bounds = points.reduce(
      (current, point) => ({
        minXmm: Math.min(current.minXmm, point.xMm),
        minYmm: Math.min(current.minYmm, point.yMm),
        maxXmm: Math.max(current.maxXmm, point.xMm),
        maxYmm: Math.max(current.maxYmm, point.yMm),
      }),
      {
        minXmm: Number.POSITIVE_INFINITY,
        minYmm: Number.POSITIVE_INFINITY,
        maxXmm: Number.NEGATIVE_INFINITY,
        maxYmm: Number.NEGATIVE_INFINITY,
      },
    );
    expect(Math.abs(bounds.minXmm - 30)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(bounds.minYmm - 45)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(bounds.maxXmm - 530)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(bounds.maxYmm - 420)).toBeLessThanOrEqual(0.01);
    expect(artifact.summary.bounds).toEqual(bounds);
  });

  it("rejects malformed, binary, and oversized ASCII input safely", () => {
    expect(() => importDxf("0\nSECTION\n2")).toThrow(/line pairs/u);
    expect(() => importDxf("0\nEOF\0\n")).toThrow(/binary/u);
    expect(() => importDxf(" ".repeat(5_000_001))).toThrow(/5 MB/u);
  });
});
