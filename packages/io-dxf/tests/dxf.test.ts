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

  it("converts planar rational DXF splines into bounded editable preview paths", () => {
    const candidate = importDxf(dxf(
      "0\nSPLINE\n8\nSpline cut\n70\n4\n71\n2\n72\n6\n73\n3\n" +
      "40\n0\n40\n0\n40\n0\n40\n1\n40\n1\n40\n1\n" +
      "41\n1\n41\n1\n41\n1\n" +
      "10\n0\n20\n0\n10\n5\n20\n10\n10\n10\n20\n0\n",
    ));
    expect(candidate.paths).toHaveLength(1);
    expect(candidate.paths[0]).toMatchObject({ layerName: "Spline cut", closed: false });
    expect(candidate.paths[0]?.points.length).toBeGreaterThan(2);
    expect(candidate.paths[0]?.points[0]).toMatchObject({ xMm: 0, yMm: 0 });
    expect(candidate.paths[0]?.points.at(-1)).toMatchObject({ xMm: 10, yMm: 0 });
    expect(candidate.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "dxf-spline-converted", pathIndex: 0 }),
    ]));
  });

  it("samples every non-empty knot span of a multi-span spline", () => {
    const candidate = importDxf(dxf(
      "0\nSPLINE\n8\nMulti span\n70\n0\n71\n2\n72\n8\n73\n5\n" +
      "40\n0\n40\n0\n40\n0\n40\n1\n40\n2\n40\n3\n40\n3\n40\n3\n" +
      "10\n0\n20\n0\n10\n10\n20\n30\n10\n20\n20\n-20\n" +
      "10\n30\n20\n30\n10\n40\n20\n0\n",
    ));
    const points = candidate.paths[0]?.points ?? [];
    expect(points.length).toBeGreaterThan(10);
    expect(points[0]).toMatchObject({ xMm: 0, yMm: 0 });
    expect(points.at(-1)).toMatchObject({ xMm: 40, yMm: 0 });
    expect(points.some((point) => point.xMm > 15 && point.xMm < 25 && point.yMm < 5))
      .toBe(true);
  });

  it("defines closed and periodic splines by coincident sampled endpoints", () => {
    const closedSpline = (flags: 1 | 2, layer: string): string =>
      `0\nSPLINE\n8\n${layer}\n70\n${String(flags)}\n71\n1\n72\n7\n73\n5\n` +
      "40\n0\n40\n0\n40\n1\n40\n2\n40\n3\n40\n4\n40\n4\n" +
      "10\n0\n20\n0\n10\n10\n20\n0\n10\n10\n20\n10\n" +
      "10\n0\n20\n10\n10\n0\n20\n0\n";
    const candidate = importDxf(dxf(
      closedSpline(1, "Closed") + closedSpline(2, "Periodic"),
    ));
    expect(candidate.paths).toHaveLength(2);
    expect(candidate.paths).toEqual(expect.arrayContaining([
      expect.objectContaining({ layerName: "Closed", closed: true }),
      expect.objectContaining({ layerName: "Periodic", closed: true }),
    ]));
    expect(candidate.paths.every((path) => path.points.length === 4)).toBe(true);
  });

  it("fails visibly instead of inventing closure or accepting over-tolerance splines", () => {
    const openEndedClosed = importDxf(dxf(
      "0\nSPLINE\n8\nBad closed\n70\n1\n71\n1\n72\n5\n73\n3\n" +
      "40\n0\n40\n0\n40\n1\n40\n2\n40\n2\n" +
      "10\n0\n20\n0\n10\n10\n20\n10\n10\n20\n20\n0\n",
    ));
    expect(openEndedClosed.paths).toHaveLength(0);
    expect(openEndedClosed.warnings[0]?.message).toMatch(/refusing an implicit straight closing segment/u);
    expect(openEndedClosed.findings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "dxf-spline-converted" }),
    ]));

    const overTolerance = importDxf(dxf(
      "0\nSPLINE\n8\nHigh curvature\n70\n0\n71\n2\n72\n6\n73\n3\n" +
      "40\n0\n40\n0\n40\n0\n40\n1\n40\n1\n40\n1\n" +
      "10\n0\n20\n0\n10\n0.000001\n20\n1000000\n10\n1\n20\n0\n",
    ), { curveToleranceMm: 1e-15 });
    expect(overTolerance.paths).toHaveLength(0);
    expect(overTolerance.warnings[0]?.message).toMatch(/requested tolerance|subdivision limit|4,096/u);
    expect(overTolerance.findings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "dxf-spline-converted" }),
    ]));
  });

  it("shows bounded near-closure and duplicate-node repairs in the preview", () => {
    const candidate = importDxf(dxf(
      "0\nLWPOLYLINE\n8\nRepair\n90\n5\n70\n0\n" +
      "10\n0\n20\n0\n10\n10\n20\n0\n10\n10.0000001\n20\n0\n" +
      "10\n10\n20\n10\n10\n0.05\n20\n0.04\n",
    ));
    expect(candidate.paths[0]).toMatchObject({ closed: true });
    expect(candidate.paths[0]?.points).toHaveLength(3);
    expect(candidate.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "duplicate-nodes-removed", severity: "repair" }),
      expect.objectContaining({ code: "small-gap-closed", severity: "repair" }),
    ]));
    expect(candidate.assumptions.join(" ")).toMatch(/fixed 0.1 mm tolerance/u);
  });

  it("removes only exact same-layer canonical duplicates and retains nearby paths deterministically", () => {
    const polyline = (
      layer: string,
      points: readonly (readonly [number, number])[],
    ): string =>
      `0\nLWPOLYLINE\n8\n${layer}\n90\n${String(points.length)}\n70\n1\n` +
      points.map(([xMm, yMm]) => `10\n${String(xMm)}\n20\n${String(yMm)}\n`).join("");
    const square = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ] as const;
    const source = dxf(
      polyline("Cut", square) +
      polyline("Cut", [[10, 10], [0, 10], [0, 0], [10, 0]]) +
      polyline("Cut", [[0, 0], [0, 10], [10, 10], [10, 0]]) +
      polyline("Cut", [[0.04, 0], [10.04, 0], [10.04, 10], [0.04, 10]]) +
      polyline("Cut", [[0.06, 0], [10.06, 0], [10.06, 10], [0.06, 10]]) +
      polyline("Other", square),
    );

    const first = importDxf(source);
    const second = importDxf(source);
    expect(second).toEqual(first);
    expect(first.paths).toHaveLength(4);
    expect(first.paths.map((path) => path.layerName)).toEqual([
      "Cut",
      "Cut",
      "Cut",
      "Other",
    ]);
    expect(first.paths[1]?.points[0]?.xMm).toBe(0.04);
    expect(first.paths[2]?.points[0]?.xMm).toBe(0.06);
    const duplicateFindings = first.findings?.filter(
      (finding) => finding.code === "duplicate-path-removed",
    );
    expect(duplicateFindings).toHaveLength(2);
    expect(duplicateFindings?.every((finding) =>
      finding.pathIndex === 0 &&
      finding.repair?.action === "remove-duplicate-path" &&
      finding.repair.toleranceMm === 0,
    )).toBe(true);
    expect(first.assumptions.join(" ")).toMatch(/exact canonical coordinates and layer identity/u);
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
      "invalid-dxf-entity",
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
