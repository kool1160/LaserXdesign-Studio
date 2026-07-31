import type { VectorImportCandidate } from "@laserx/domain";
import { describe, expect, it } from "vitest";

import { ProjectSession } from "../src/index.js";

function dependencies() {
  let sequence = 0;
  return {
    createId: () =>
      `123e4567-e89b-42d3-a456-${String(sequence++).padStart(12, "0")}`,
    now: () => "2026-07-31T12:00:00.000Z",
  };
}

function candidate(): VectorImportCandidate {
  return {
    format: "svg",
    sourceUnit: "inches",
    dimensionsMm: { widthMm: 609.6, heightMm: 304.8 },
    paths: [
      {
        layerName: "Cut",
        closed: true,
        points: [
          { xMm: 0, yMm: 0 },
          { xMm: 609.6, yMm: 0 },
          { xMm: 609.6, yMm: 304.8 },
        ],
      },
      {
        layerName: null,
        closed: false,
        points: [{ xMm: 0, yMm: 0 }, { xMm: 50, yMm: 50 }],
      },
    ],
    warnings: [{ code: "unsupported-svg-element", message: "Text skipped.", source: "<text>" }],
    assumptions: [],
  };
}

describe("vector import preview", () => {
  it("previews without mutating the project, dirty state, or history", () => {
    const session = new ProjectSession(dependencies());
    const before = session.state;

    const previewed = session.previewVectorImport(candidate(), "24-inch.svg");

    expect(previewed.project).toEqual(before.project);
    expect(previewed.dirty).toBe(false);
    expect(previewed.editor.history.undoDepth).toBe(0);
    expect(previewed.editor.importPreview).toMatchObject({
      sourceName: "24-inch.svg",
      format: "svg",
      sourceUnit: "inches",
      bounds: { minXmm: 0, minYmm: 0, maxXmm: 609.6, maxYmm: 304.8 },
    });
    expect(previewed.editor.importPreview?.layers).toHaveLength(1);
    expect(previewed.editor.importPreview?.objects).toHaveLength(2);

    const canceled = session.cancelVectorImport();
    expect(canceled.project).toEqual(before.project);
    expect(canceled.editor.importPreview).toBeNull();
  });

  it("commits layers and paths atomically as one undoable command", () => {
    const session = new ProjectSession(dependencies());
    const before = session.state.project;
    session.previewVectorImport(candidate(), "sign.svg");

    const committed = session.commitVectorImport();
    expect(committed.editor.importPreview).toBeNull();
    expect(committed.editor.history.undoDepth).toBe(1);
    expect(committed.dirty).toBe(true);
    expect(committed.project.document.layers).toHaveLength(before.document.layers.length + 1);
    expect(committed.project.document.objects).toHaveLength(2);
    expect(committed.project.document.objects[0]).toMatchObject({ type: "path", closed: true });
    expect(committed.editor.selectionIds).toHaveLength(2);

    const undone = session.undo();
    expect(undone.project.document).toEqual(before.document);
    expect(undone.editor.history.redoDepth).toBe(1);

    const redone = session.redo();
    expect(redone.project.document.objects).toHaveLength(2);
  });

  it("rejects a stale preview after another project edit", () => {
    const session = new ProjectSession(dependencies());
    session.previewVectorImport(candidate(), "sign.svg");
    session.dispatch({ type: "project.set-display-unit", displayUnit: "inches" });

    expect(() => session.commitVectorImport()).toThrow(/project changed/u);
    expect(session.state.project.document.objects).toHaveLength(0);
  });

  it("rejects an expanded-geometry overflow before preview state or history changes", () => {
    const session = new ProjectSession(dependencies());
    const before = session.state;
    const oversized = candidate();
    oversized.paths = [{
      layerName: "Cut",
      closed: false,
      points: Array.from({ length: 200_001 }, (_unused, index) => ({
        xMm: index,
        yMm: 0,
      })),
    }];

    expect(() => session.previewVectorImport(oversized, "expansion-bomb.dxf"))
      .toThrow(/200,000 expanded geometry points/u);
    expect(session.state.project).toEqual(before.project);
    expect(session.state.dirty).toBe(false);
    expect(session.state.editor.importPreview).toBeNull();
    expect(session.state.editor.history).toEqual(before.editor.history);
  });
});
