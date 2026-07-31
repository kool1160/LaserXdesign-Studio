import type { RasterTraceCandidate } from "@laserx/domain";
import { describe, expect, it } from "vitest";

import { ProjectSession } from "../src/index.js";

function dependencies() {
  let sequence = 0;
  return {
    createId: () =>
      `923e4567-e89b-42d3-a456-${String(sequence++).padStart(12, "0")}`,
    now: () => "2026-07-31T14:00:00.000Z",
  };
}

function candidate(): RasterTraceCandidate {
  const settings = {
    preset: "balanced" as const,
    outputWidthMm: 80,
    crop: { left: 0, top: 0, right: 0, bottom: 0 },
    rotationDeg: 0 as const,
    grayscaleMode: "luminance" as const,
    contrast: 0,
    threshold: 128,
    invert: false,
    blurRadiusPx: 1,
    denoiseRadiusPx: 1,
    background: "auto" as const,
    speckleAreaPx: 6,
    smoothingPasses: 1,
    simplificationToleranceMm: 0.2,
  };
  const points = [
    { xMm: 10, yMm: 10 },
    { xMm: 70, yMm: 10 },
    { xMm: 70, yMm: 50 },
    { xMm: 10, yMm: 50 },
  ];
  return {
    source: {
      format: "png",
      widthPx: 800,
      heightPx: 600,
      sourceBytes: 40_000,
      decodedBytes: 1_920_000,
    },
    settings,
    paths: [{ layerName: "Raster Trace", closed: true, points }],
    warnings: [
      {
        code: "trace-requires-cutability-analysis",
        message: "Cutability review required.",
        source: null,
      },
    ],
    assumptions: ["Square pixels mapped to millimeters."],
    summary: {
      engineId: "laserx-grid-trace",
      engineVersion: "1.0.0",
      sourceWidthPx: 800,
      sourceHeightPx: 600,
      traceWidthPx: 800,
      traceHeightPx: 600,
      outputWidthMm: 80,
      outputHeightMm: 60,
      pathCount: 1,
      nodeCount: 4,
      sourceBoundaryNodeCount: 2_000,
      smallestFeatureMm: 40,
      speckleThresholdPx: 6,
      removedSpeckleCount: 2,
      removedSpeckleAreaPx: 4,
      simplificationToleranceMm: 0.2,
      bounds: { minXmm: 10, minYmm: 10, maxXmm: 70, maxYmm: 50 },
    },
  };
}

describe("raster trace preview and acceptance", () => {
  it("previews and rejects without changing project, dirty state, or history", () => {
    const session = new ProjectSession(dependencies());
    const before = session.state;
    const previewed = session.previewRasterTrace(candidate(), "clean-logo.png");

    expect(previewed.project).toEqual(before.project);
    expect(previewed.dirty).toBe(false);
    expect(previewed.editor.history.undoDepth).toBe(0);
    expect(previewed.editor.rasterTracePreview).toMatchObject({
      sourceName: "clean-logo.png",
      summary: { pathCount: 1, nodeCount: 4, removedSpeckleCount: 2 },
    });

    const rejected = session.cancelRasterTrace();
    expect(rejected.project).toEqual(before.project);
    expect(rejected.editor.rasterTracePreview).toBeNull();
    expect(rejected.editor.history).toEqual(before.editor.history);
  });

  it("accepts editable paths as one command and persists through undo/redo", () => {
    const session = new ProjectSession(dependencies());
    const before = session.state.project.document;
    session.previewRasterTrace(candidate(), "clean-logo.png");

    const accepted = session.commitRasterTrace();
    expect(accepted.editor.rasterTracePreview).toBeNull();
    expect(accepted.editor.history.undoDepth).toBe(1);
    expect(accepted.editor.selectionIds).toHaveLength(1);
    expect(accepted.project.document.objects[0]).toMatchObject({
      type: "path",
      closed: true,
      points: candidate().paths[0]?.points,
    });

    expect(session.undo().project.document).toEqual(before);
    expect(session.redo().project.document.objects).toHaveLength(1);
  });

  it("rejects a stale trace without committing geometry", () => {
    const session = new ProjectSession(dependencies());
    session.previewRasterTrace(candidate(), "clean-logo.png");
    session.dispatch({ type: "project.set-display-unit", displayUnit: "inches" });

    expect(() => session.commitRasterTrace()).toThrow(/project changed/u);
    expect(session.state.project.document.objects).toHaveLength(0);
    expect(session.state.editor.history.undoDepth).toBe(1);
  });
});
