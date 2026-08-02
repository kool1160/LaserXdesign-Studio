import type { VectorImportCandidate } from "@laserx/domain";
import { parseProject, serializeProject } from "@laserx/project-format";
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
    findings: [{
      code: "repair-preview",
      severity: "repair",
      message: "Closed a small gap.",
      source: "path 1",
      pathIndex: 0,
      locationMm: { xMm: 0, yMm: 0 },
      repair: {
        action: "close-small-gap",
        summary: "Closed one gap.",
        changeCount: 1,
        toleranceMm: 0.1,
        appliedToPreview: true,
      },
    }],
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
      fitMode: "resize-stock",
      marginMm: 12.7,
      proposedDocumentDimensionsMm: { widthMm: 635, heightMm: 330.2 },
      skippedEntityCount: 1,
      partialImport: true,
    });
    expect(previewed.editor.importPreview?.findings.filter(
      (finding) => finding.message === "Text skipped.",
    )).toHaveLength(1);
    expect(previewed.editor.importPreview?.bounds?.minXmm).toBeCloseTo(12.7, 9);
    expect(previewed.editor.importPreview?.bounds?.minYmm).toBeCloseTo(12.7, 9);
    expect(previewed.editor.importPreview?.bounds?.maxXmm).toBeCloseTo(622.3, 9);
    expect(previewed.editor.importPreview?.bounds?.maxYmm).toBeCloseTo(317.5, 9);
    expect(previewed.editor.importPreview?.layers).toHaveLength(1);
    expect(previewed.editor.importPreview?.objects).toHaveLength(2);
    const findingObjectId = previewed.editor.importPreview?.findings[0]?.objectId;
    if (findingObjectId === null || findingObjectId === undefined) {
      throw new Error("Expected a geometry-linked finding.");
    }
    expect(session.focusVectorImportFinding(findingObjectId).editor.importPreview)
      .toMatchObject({ focusedObjectId: findingObjectId });

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
    expect(committed.project.document.dimensions).toEqual({ widthMm: 635, heightMm: 330.2 });
    expect(committed.editor.selectionIds).toHaveLength(2);

    const undone = session.undo();
    expect(undone.project.document).toEqual(before.document);
    expect(undone.editor.history.redoDepth).toBe(1);

    const redone = session.redo();
    expect(redone.project.document.objects).toHaveLength(2);
  });

  it("previews all three stock fitting choices without mutation and commits the chosen fit once", () => {
    const session = new ProjectSession(dependencies());
    const before = session.state.project;
    session.previewVectorImport(candidate(), "oversized.svg");

    const scaled = session.configureVectorImport("scale-artwork", 10);
    expect(scaled.project).toEqual(before);
    expect(scaled.editor.importPreview).toMatchObject({
      fitMode: "scale-artwork",
      proposedDocumentDimensionsMm: before.document.dimensions,
    });
    expect(scaled.editor.importPreview?.artworkScale).toBeLessThan(1);
    expect(scaled.editor.importPreview?.bounds?.minXmm).toBeGreaterThanOrEqual(10);
    expect(scaled.editor.importPreview?.bounds?.maxXmm).toBeLessThanOrEqual(590);
    expect(scaled.editor.importPreview?.bounds?.minYmm).toBeGreaterThanOrEqual(10);
    expect(scaled.editor.importPreview?.bounds?.maxYmm).toBeLessThanOrEqual(290);

    const kept = session.configureVectorImport("keep", 10);
    expect(kept.editor.importPreview).toMatchObject({
      fitMode: "keep",
      bounds: { minXmm: 0, minYmm: 0, maxXmm: 609.6, maxYmm: 304.8 },
    });
    const committed = session.commitVectorImport();
    expect(committed.project.document.dimensions).toEqual(before.document.dimensions);
    expect(committed.editor.history.undoDepth).toBe(1);
  });

  it("never shrinks non-empty stock or moves existing edge geometry during resize preview, cancel, commit, undo, redo, and reopen", () => {
    const session = new ProjectSession(dependencies());
    const layerId = session.state.project.document.activeLayerId;
    session.executeEditorCommand({
      type: "objects.import",
      layers: [],
      objects: [
        {
          id: "123e4567-e89b-42d3-a456-100000000001",
          type: "rectangle",
          layerId,
          transform: { a: 1, b: 0, c: 0, d: 1, eMm: 0, fMm: 0 },
          origin: { xMm: 0, yMm: 0 },
          widthMm: 20,
          heightMm: 20,
        },
        {
          id: "123e4567-e89b-42d3-a456-100000000002",
          type: "rectangle",
          layerId,
          transform: { a: 1, b: 0, c: 0, d: 1, eMm: 0, fMm: 0 },
          origin: { xMm: 569.6, yMm: 264.8 },
          widthMm: 40,
          heightMm: 40,
        },
      ],
    });
    const beforeImport = session.state;
    const wide = candidate();
    wide.format = "dxf";
    wide.sourceUnit = "millimeters";
    wide.paths = [{
      layerName: "Wide import",
      closed: true,
      points: [
        { xMm: 0, yMm: 0 },
        { xMm: 800, yMm: 0 },
        { xMm: 800, yMm: 100 },
        { xMm: 0, yMm: 100 },
      ],
    }];
    wide.findings = [];

    const firstPreview = session.previewVectorImport(wide, "wide.dxf");
    expect(firstPreview.project).toEqual(beforeImport.project);
    expect(firstPreview.editor.importPreview).toMatchObject({
      fitMode: "resize-stock",
      proposedDocumentDimensionsMm: { widthMm: 825.4, heightMm: 304.8 },
    });
    expect(firstPreview.editor.importPreview?.bounds?.minXmm).toBeCloseTo(12.7, 9);
    expect(firstPreview.editor.importPreview?.bounds?.minYmm).toBeCloseTo(102.4, 9);
    expect(firstPreview.editor.importPreview?.bounds?.maxXmm).toBeCloseTo(812.7, 9);
    expect(firstPreview.editor.importPreview?.bounds?.maxYmm).toBeCloseTo(202.4, 9);
    expect(session.cancelVectorImport().project).toEqual(beforeImport.project);
    expect(session.state.editor.history).toEqual(beforeImport.editor.history);

    session.previewVectorImport(wide, "wide.dxf");
    const committed = session.commitVectorImport();
    const committedDocument = committed.project.document;
    expect(committedDocument.dimensions).toEqual({ widthMm: 825.4, heightMm: 304.8 });
    expect(committedDocument.objects.slice(0, 2)).toEqual(
      beforeImport.project.document.objects,
    );
    expect(committed.editor.history.undoDepth)
      .toBe(beforeImport.editor.history.undoDepth + 1);

    expect(session.undo().project.document).toEqual(beforeImport.project.document);
    expect(session.redo().project.document).toEqual(committedDocument);
    expect(parseProject(serializeProject(session.state.project)).document)
      .toEqual(committedDocument);
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
