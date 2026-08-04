/**
 * Camera-fit proof.
 *
 * The previous fit was derived from stock size and Z span alone, and its tests
 * only checked that the result was finite, positive, and deterministic. That
 * proved nothing about fitting: a narrow viewport, or geometry extending outside
 * the stock rectangle, could clip while every test stayed green.
 *
 * These tests instead build the real Three perspective camera from the returned
 * descriptor and project **every corner** of the visible bounds through it,
 * asserting each lands inside the normalised device cube. That is the actual
 * claim "fit" makes.
 */

import type { PhysicalPreviewAssembly } from "@laserx/physical-preview-3d";
import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import {
  computeCameraFit,
  PREVIEW_VIEWS,
  visibleBoundsMm,
  type CameraFit,
  type PreviewBoundsMm,
  type Viewport,
} from "../src/camera.js";
import type { AssemblyMode } from "../src/placement.js";

interface LayerSpec {
  id: string;
  a: [number, number];
  e: [number, number];
  bounds: PhysicalPreviewAssembly["layers"][number]["boundsMm"];
}

function assembly(
  layers: LayerSpec[],
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
      shapes: entry.bounds === null ? [] : [{ id: `${entry.id}-s`, outerContour: { points: [] }, holeContours: [], sourceObjectIds: [] }],
      boundsMm: entry.bounds,
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

const box = (minX: number, minY: number, maxX: number, maxY: number) => ({
  minXmm: minX,
  minYmm: minY,
  maxXmm: maxX,
  maxYmm: maxY,
});

const singleLayer = () =>
  assembly([{ id: "a", a: [0, 3], e: [0, 3], bounds: box(0, 0, 200, 100) }]);

const multiLayer = () =>
  assembly([
    { id: "a", a: [0, 3], e: [0, 3], bounds: box(0, 0, 200, 100) },
    { id: "b", a: [3, 9], e: [23, 29], bounds: box(10, 10, 190, 90) },
    { id: "c", a: [9, 12], e: [49, 52], bounds: box(20, 20, 180, 80) },
  ]);

/** Geometry deliberately extending well outside the stock rectangle. */
const outsideStock = () =>
  assembly([{ id: "a", a: [0, 3], e: [0, 3], bounds: box(-150, -80, 350, 260) }]);

const WIDE: Viewport = { widthPx: 1920, heightPx: 600 };
const NARROW: Viewport = { widthPx: 420, heightPx: 1200 };
const SQUARE: Viewport = { widthPx: 900, heightPx: 900 };

function corners(bounds: PreviewBoundsMm): Vector3[] {
  const result: Vector3[] = [];
  for (const x of [bounds.minXmm, bounds.maxXmm]) {
    for (const y of [bounds.minYmm, bounds.maxYmm]) {
      for (const z of [bounds.minZmm, bounds.maxZmm]) {
        result.push(new Vector3(x, y, z));
      }
    }
  }
  return result;
}

/** Builds the real camera the descriptor specifies and projects the bounds. */
function projectCorners(fit: CameraFit): Vector3[] {
  const camera = new PerspectiveCamera(fit.fovDeg, fit.aspect, fit.near, fit.far);
  camera.position.set(...fit.position);
  camera.up.set(0, 1, 0);
  camera.lookAt(new Vector3(...fit.target));
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  return corners(fit.boundsMm).map((corner) => corner.clone().project(camera));
}

function expectAllCornersVisible(fit: CameraFit, label: string): void {
  for (const point of projectCorners(fit)) {
    // Normalised device coordinates: everything inside the frustum lies within
    // [-1, 1] on all three axes.
    expect(Math.abs(point.x), `${label} x`).toBeLessThanOrEqual(1);
    expect(Math.abs(point.y), `${label} y`).toBeLessThanOrEqual(1);
    expect(point.z, `${label} z near`).toBeGreaterThanOrEqual(-1);
    expect(point.z, `${label} z far`).toBeLessThanOrEqual(1);
  }
}

describe("visible bounds", () => {
  it("uses the visible layers' own bounds, including geometry outside stock", () => {
    const bounds = visibleBoundsMm(outsideStock(), "assembled");
    expect(bounds.minXmm).toBe(-150);
    expect(bounds.maxXmm).toBe(350);
    expect(bounds.maxYmm).toBe(260);
  });

  it("falls back to the stock rectangle when nothing is visible", () => {
    expect(visibleBoundsMm(assembly([]), "assembled")).toEqual({
      minXmm: 0,
      minYmm: 0,
      minZmm: 0,
      maxXmm: 200,
      maxYmm: 100,
      maxZmm: 0,
    });

    const hiddenAll = visibleBoundsMm(multiLayer(), "assembled", new Set());
    expect(hiddenAll.maxXmm).toBe(200);
    expect(hiddenAll.maxYmm).toBe(100);
  });

  it("ignores a failed layer's absent XY bounds but keeps its declared Z", () => {
    const mixed = assembly([
      { id: "ok", a: [0, 3], e: [0, 3], bounds: box(0, 0, 50, 50) },
      { id: "failed", a: [3, 9], e: [23, 29], bounds: null },
    ]);
    const bounds = visibleBoundsMm(mixed, "assembled");
    // XY comes only from the layer that rendered something...
    expect(bounds.maxXmm).toBe(50);
    // ...but the failed layer still occupies its declared Z slot.
    expect(bounds.maxZmm).toBe(9);
  });
});

describe("camera fit frames the visible bounds", () => {
  const cases: Array<[string, () => PhysicalPreviewAssembly]> = [
    ["single layer", singleLayer],
    ["multi layer", multiLayer],
    ["geometry outside stock", outsideStock],
    ["empty assembly", () => assembly([])],
  ];

  for (const [label, build] of cases) {
    for (const [viewportLabel, viewport] of [
      ["wide", WIDE],
      ["narrow", NARROW],
      ["square", SQUARE],
    ] as Array<[string, Viewport]>) {
      for (const mode of ["assembled", "exploded"] as AssemblyMode[]) {
        for (const view of PREVIEW_VIEWS) {
          it(`fits ${label} / ${viewportLabel} / ${mode} / ${view}`, () => {
            const fit = computeCameraFit(build(), mode, { view, viewport });
            expectAllCornersVisible(fit, `${label} ${viewportLabel} ${mode} ${view}`);
          });
        }
      }
    }
  }

  it("fits with every layer hidden", () => {
    for (const view of PREVIEW_VIEWS) {
      const fit = computeCameraFit(multiLayer(), "assembled", {
        view,
        viewport: NARROW,
        visibleLayerIds: new Set(),
      });
      expectAllCornersVisible(fit, `hidden-all ${view}`);
    }
  });

  it("pushes the camera back for a narrow viewport rather than clipping", () => {
    const wide = computeCameraFit(singleLayer(), "assembled", { view: "front", viewport: WIDE });
    const narrow = computeCameraFit(singleLayer(), "assembled", {
      view: "front",
      viewport: NARROW,
    });
    // The stock is 200x100; a tall narrow viewport must retreat further to fit
    // the 200mm width.
    expect(narrow.distance).toBeGreaterThan(wide.distance);
    expectAllCornersVisible(narrow, "narrow");
  });

  it("returns the projection assumptions it was solved for", () => {
    const fit = computeCameraFit(multiLayer(), "assembled", { view: "front", viewport: WIDE });
    expect(fit.fovDeg).toBe(45);
    expect(fit.aspect).toBeCloseTo(1920 / 600, 9);
    expect(fit.view).toBe("front");
  });

  it("keeps near and far finite, positive, and ordered", () => {
    for (const view of PREVIEW_VIEWS) {
      for (const build of [singleLayer, multiLayer, outsideStock, () => assembly([])]) {
        const fit = computeCameraFit(build(), "exploded", { view, viewport: SQUARE });
        expect(Number.isFinite(fit.near)).toBe(true);
        expect(Number.isFinite(fit.far)).toBe(true);
        expect(fit.near).toBeGreaterThan(0);
        expect(fit.far).toBeGreaterThan(fit.distance);
        expect(fit.distance).toBeGreaterThan(0);
      }
    }
  });

  it("stays usable for degenerate zero-sized stock", () => {
    const fit = computeCameraFit(assembly([], { widthMm: 0, heightMm: 0 }), "assembled", {
      view: "perspective",
      viewport: SQUARE,
    });
    expect(fit.distance).toBeGreaterThan(0);
    expect(Number.isFinite(fit.far)).toBe(true);
  });

  it("is deterministic for identical input", () => {
    for (const view of PREVIEW_VIEWS) {
      const first = computeCameraFit(multiLayer(), "assembled", { view, viewport: WIDE });
      const second = computeCameraFit(multiLayer(), "assembled", { view, viewport: WIDE });
      expect(second).toEqual(first);
    }
  });

  it("pulls back further when exploded", () => {
    const assembled = computeCameraFit(multiLayer(), "assembled", {
      view: "perspective",
      viewport: SQUARE,
    });
    const exploded = computeCameraFit(multiLayer(), "exploded", {
      view: "perspective",
      viewport: SQUARE,
    });
    expect(exploded.distance).toBeGreaterThan(assembled.distance);
  });

  it("does not mutate the supplied assembly", () => {
    const supplied = multiLayer();
    const before = JSON.stringify(supplied);
    computeCameraFit(supplied, "exploded", { view: "edge", viewport: NARROW });
    expect(JSON.stringify(supplied)).toBe(before);
  });
});
