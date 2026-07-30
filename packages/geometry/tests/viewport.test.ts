import { describe, expect, it } from "vitest";

import {
  COORDINATE_TOLERANCE_MM,
  domainToScreen,
  fitBoundsToView,
  panViewport,
  resetViewport,
  screenToDomain,
  zoomViewportAt,
  type PointMm,
  type ViewportSizeCssPx,
  type ViewportTransform,
} from "../src/index.js";

const viewport: ViewportTransform = {
  originScreenXCssPx: 100,
  originScreenYCssPx: 200,
  zoomCssPxPerMm: 2,
};

const size: ViewportSizeCssPx = {
  widthCssPx: 1_000,
  heightCssPx: 700,
  devicePixelRatio: 1,
};

describe("viewport coordinate conversion", () => {
  it("converts Cartesian positive Y to decreasing screen Y", () => {
    expect(domainToScreen({ xMm: 10, yMm: 20 }, viewport)).toEqual({
      xCssPx: 120,
      yCssPx: 160,
    });
  });

  it("round-trips screen and domain coordinates within tolerance", () => {
    const point: PointMm = { xMm: 123.456, yMm: -78.9 };
    const roundTrip = screenToDomain(domainToScreen(point, viewport), viewport);
    expect(Math.abs(roundTrip.xMm - point.xMm)).toBeLessThanOrEqual(
      COORDINATE_TOLERANCE_MM,
    );
    expect(Math.abs(roundTrip.yMm - point.yMm)).toBeLessThanOrEqual(
      COORDINATE_TOLERANCE_MM,
    );
  });

  it("keeps the domain position under a zoom pointer stable", () => {
    const pointer = { xCssPx: 333, yCssPx: 251 };
    const before = screenToDomain(pointer, viewport);
    const zoomed = zoomViewportAt(viewport, pointer, 7.5);
    const after = screenToDomain(pointer, zoomed);
    expect(Math.abs(after.xMm - before.xMm)).toBeLessThanOrEqual(
      COORDINATE_TOLERANCE_MM,
    );
    expect(Math.abs(after.yMm - before.yMm)).toBeLessThanOrEqual(
      COORDINATE_TOLERANCE_MM,
    );
  });

  it("pans and zooms without mutating document coordinates", () => {
    const point = Object.freeze({ xMm: 42, yMm: 23 });
    panViewport(viewport, { xCssPx: 15, yCssPx: -7 });
    zoomViewportAt(viewport, { xCssPx: 50, yCssPx: 60 }, 4);
    expect(point).toEqual({ xMm: 42, yMm: 23 });
  });

  it("fits bounds and resets a view deterministically", () => {
    const bounds = { minXmm: 0, minYmm: 0, maxXmm: 600, maxYmm: 300 };
    expect(fitBoundsToView(bounds, size)).toEqual(
      fitBoundsToView(bounds, size),
    );
    expect(resetViewport(bounds, size).zoomCssPxPerMm).toBe(1);
  });

  it("does not let device-pixel ratio change measurements", () => {
    const highDpiSize = { ...size, devicePixelRatio: 2.5 };
    const bounds = { minXmm: 0, minYmm: 0, maxXmm: 600, maxYmm: 300 };
    expect(fitBoundsToView(bounds, highDpiSize)).toEqual(
      fitBoundsToView(bounds, size),
    );
  });
});
