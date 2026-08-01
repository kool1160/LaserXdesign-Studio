import { identityTransform } from "@laserx/domain";
import type { SignGenerationCandidate } from "@laserx/sign-tools";
import { describe, expect, it } from "vitest";

import { ProjectSession } from "../src/index.js";

function dependencies() {
  let sequence = 1;
  return {
    createId: () => `10000000-0000-4000-8000-${String(sequence++).padStart(12, "0")}`,
    now: () => "2026-07-31T12:00:00.000Z",
  };
}

function candidate(): SignGenerationCandidate {
  const layerId = "20000000-0000-4000-8000-000000000001";
  return {
    layers: [{ id: layerId, name: "Sign Backing", visible: true, locked: false }],
    objects: [{
      id: "30000000-0000-4000-8000-000000000001",
      type: "rectangle",
      layerId,
      transform: identityTransform(),
      origin: { xMm: 0, yMm: 0 },
      widthMm: 609.6,
      heightMm: 304.8,
    }],
    summary: {
      operation: "template",
      objectCount: 1,
      layerCount: 1,
      warnings: [],
      assumptions: ["Fixture"],
      provenanceIds: ["laserx:algorithmic-sign-primitives-v1"],
    },
    template: {
      templateVersion: 1,
      stylePresetId: "industrial-stencil",
      parameters: {
        kind: "address",
        shape: "rounded-rectangle",
        widthMm: 609.6,
        heightMm: 304.8,
        borderWidthMm: 12,
        holeDiameterMm: 6,
        holeInsetMm: 25.4,
        fontId: "bundled:saira-stencil-one",
        fontSizeMm: 42,
        primaryText: "1042",
        secondaryText: "OAK STREET",
        arcRadiusMm: null,
      },
    },
  };
}

describe("M09 application workflow", () => {
  it("previews without mutation, saves a reusable template, and accepts geometry as one undoable command", () => {
    const session = new ProjectSession(dependencies());
    const originalObjectCount = session.state.project.document.objects.length;
    session.previewSignTool(candidate());
    expect(session.state.project.document.objects).toHaveLength(originalObjectCount);
    expect(session.state.editor.signToolPreview?.objects).toHaveLength(1);
    expect(session.state.editor.history.undoDepth).toBe(0);

    session.saveSignToolPreviewTemplate("Address plate");
    expect(session.state.project.document.templates).toHaveLength(1);
    expect(session.state.editor.signToolPreview).not.toBeNull();
    expect(session.state.editor.history.undoDepth).toBe(1);

    session.acceptSignToolPreview();
    expect(session.state.project.document.objects).toHaveLength(originalObjectCount + 1);
    expect(session.state.editor.selectionIds).toEqual([
      "30000000-0000-4000-8000-000000000001",
    ]);
    expect(session.state.editor.signToolPreview).toBeNull();
    expect(session.state.editor.history.undoDepth).toBe(2);

    session.undo();
    expect(session.state.project.document.objects).toHaveLength(originalObjectCount);
    expect(session.state.project.document.templates).toHaveLength(1);
    session.undo();
    expect(session.state.project.document.templates).toHaveLength(0);
  });

  it("rejects stale previews after document changes", () => {
    const session = new ProjectSession(dependencies());
    session.previewSignTool(candidate());
    session.dispatch({ type: "project.set-display-unit", displayUnit: "inches" });
    expect(() => session.acceptSignToolPreview()).toThrow(/project changed/);
  });
});
