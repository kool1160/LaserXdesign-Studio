import type { PhysicalPreviewAssembly } from "@laserx/physical-preview-3d";
import { describe, expect, it } from "vitest";

import { computeCameraPose, PREVIEW_VIEWS } from "../src/camera.js";
import { assemblyPlacements, assemblyZExtent } from "../src/placement.js";

function assembly(
  layers: Array<{ id: string; a: [number, number]; e: [number, number] }>,
  stock = { widthMm: 200, heightMm: 100 },
): PhysicalPreviewAssembly {
  return {
    identity: { projectId: "p", documentId: "d", projectUpdatedAt: "t" },
    stockMm: stock,
    status: "complete",
    spacing: { assembledGapMm: 0, explodedGapMm: 20 },
    layers: layers.map((entry, order) => ({
      layerId: entry.id,
      name: entry.id,
      role: "face",
      thicknessMm: entry.a[1] - entry.a[0],
      material: { material: "mild-steel", stockThicknessDesignation: null, displayLabel: "" },
      shapes: [],
      boundsMm: null,
      order,
      assembledZRangeMm: { minZmm: entry.a[0], maxZmm: entry.a[1] },
      explodedZRangeMm: { minZmm: entry.e[0], maxZmm: entry.e[1] },
    })),
    assembledDepthMm: 0,
    depthStatus: "verified",
    findings: [],
    fingerprint: "fp",
  } as unknown as PhysicalPreviewAssembly;
}

const threeLayer = () =>
  assembly([
    { id: "a", a: [0, 3], e: [0, 3] },
    { id: "b", a: [3, 9], e: [23, 29] },
    { id: "c", a: [9, 12], e: [49, 52] },
  ]);

describe("assembly placement", () => {
  it("uses authoritative Z ranges verbatim for both modes", () => {
    const assembled = assemblyPlacements(threeLayer(), "assembled");
    expect(assembled.map((entry) => entry.originZmm)).toEqual([0, 3, 9]);
    expect(assembled.map((entry) => entry.order)).toEqual([0, 1, 2]);

    const exploded = assemblyPlacements(threeLayer(), "exploded");
    expect(exploded.map((entry) => entry.originZmm)).toEqual([0, 23, 49]);
    // Exploding must move layers only; thickness spans are unchanged.
    expect(exploded.map((entry) => entry.zRangeMm.maxZmm - entry.zRangeMm.minZmm)).toEqual(
      assembled.map((entry) => entry.zRangeMm.maxZmm - entry.zRangeMm.minZmm),
    );
  });

  it("returns copies that cannot mutate the supplied assembly", () => {
    const supplied = threeLayer();
    const before = JSON.stringify(supplied);
    const placements = assemblyPlacements(supplied, "assembled");
    const first = placements[0];
    if (first === undefined) throw new Error("expected a placement");
    first.zRangeMm.minZmm = 999;
    expect(JSON.stringify(supplied)).toBe(before);
  });

  it("computes Z extent for empty, single, and multi-layer assemblies", () => {
    // An empty assembly must yield a finite zero extent, not Infinity from an
    // empty Math.min.
    expect(assemblyZExtent(assembly([]), "assembled")).toEqual({ minZmm: 0, maxZmm: 0 });
    expect(assemblyZExtent(assembly([{ id: "a", a: [0, 3], e: [0, 3] }]), "assembled")).toEqual({
      minZmm: 0,
      maxZmm: 3,
    });
    expect(assemblyZExtent(threeLayer(), "exploded")).toEqual({ minZmm: 0, maxZmm: 52 });
  });

  it("honours a visible-layer filter", () => {
    expect(assemblyZExtent(threeLayer(), "assembled", new Set(["b"]))).toEqual({
      minZmm: 3,
      maxZmm: 9,
    });
    // Hiding everything is a real state and must stay finite.
    expect(assemblyZExtent(threeLayer(), "assembled", new Set())).toEqual({
      minZmm: 0,
      maxZmm: 0,
    });
  });
});

describe("camera poses", () => {
  const target: readonly [number, number, number] = [10, 20, 5];

  it("places each axis-aligned view on its documented axis", () => {
    expect(computeCameraPose("front", target, 100).position).toEqual([10, 20, 105]);
    expect(computeCameraPose("back", target, 100).position).toEqual([10, 20, -95]);
    expect(computeCameraPose("edge", target, 100).position).toEqual([110, 20, 5]);
  });

  it("places every view at exactly the requested distance from the target", () => {
    // The perspective direction is normalised, so `distance` is a true distance
    // for every view. The research used raw offset ratios (0.7, 0.55, 0.9),
    // which placed the perspective camera ~1.27x further out than requested —
    // harmless in the lab, but it would silently under-frame a solved fit.
    for (const view of PREVIEW_VIEWS) {
      const pose = computeCameraPose(view, target, 100);
      const measured = Math.hypot(
        pose.position[0] - target[0],
        pose.position[1] - target[1],
        pose.position[2] - target[2],
      );
      expect(measured, view).toBeCloseTo(100, 9);
    }
  });

  it("keeps the perspective view angled on all three axes", () => {
    const pose = computeCameraPose("perspective", target, 100);
    expect(pose.position[0]).toBeGreaterThan(target[0]);
    expect(pose.position[1]).toBeGreaterThan(target[1]);
    expect(pose.position[2]).toBeGreaterThan(target[2]);
  });

  it("keeps every view upright and deterministic", () => {
    for (const view of PREVIEW_VIEWS) {
      const first = computeCameraPose(view, target, 100);
      const second = computeCameraPose(view, target, 100);
      expect(second).toEqual(first);
      expect(first.up).toEqual([0, 1, 0]);
    }
  });

  it("covers exactly the four approved views", () => {
    expect([...PREVIEW_VIEWS]).toEqual(["front", "back", "edge", "perspective"]);
  });

  it("puts front and back on opposite sides of the target", () => {
    const front = computeCameraPose("front", target, 100).position[2];
    const back = computeCameraPose("back", target, 100).position[2];
    expect(front - target[2]).toBe(-(back - target[2]));
  });
});
