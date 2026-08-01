import type { AiNormalizedConcept } from "@laserx/ai/concept";
import { identityTransform } from "@laserx/domain";
import { describe, expect, it } from "vitest";

import { ProjectSession } from "../src/index.js";

function dependencies() {
  let sequence = 1;
  return {
    createId: () => `10000000-0000-4000-8000-${String(sequence++).padStart(12, "0")}`,
    now: () => "2026-08-01T12:00:00.000Z",
  };
}

function concept(wordingMatches = true): AiNormalizedConcept {
  const layerId = "20000000-0000-4000-8000-000000000001";
  return {
    summary: {
      id: "concept-1",
      title: "Industrial address",
      description: "Editable template geometry",
      source: "structured-vector",
      requestedWording: "1042 OAK STREET",
      observedWording: wordingMatches ? "1042 OAK STREET" : "1042 OAK ST",
      wordingMatches,
      objectCount: 1,
      layerCount: 1,
      warnings: [],
    },
    layers: [{ id: layerId, name: "AI Sign", visible: true, locked: false }],
    objects: [{
      id: "30000000-0000-4000-8000-000000000001",
      type: "rectangle",
      layerId,
      transform: identityTransform(),
      origin: { xMm: 0, yMm: 0 },
      widthMm: 609.6,
      heightMm: 304.8,
    }],
    providerId: "mock-openai",
    model: "mock-model",
    requestId: "mock-request",
    usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    analysis: {
      status: "complete",
      issueCount: 0,
      errorCount: 0,
      warningCount: 0,
      cutReady: false,
      disclaimer: "Cutability analysis is guidance, not certification.",
    },
    provenanceSaved: false,
  };
}

describe("M10 application workflow", () => {
  it("previews without mutation and accepts editable geometry as one undoable command", () => {
    const session = new ProjectSession(dependencies());
    const original = session.state.project.document.objects.length;
    session.previewAiConcept(concept(), session.projectFingerprint);
    expect(session.state.project.document.objects).toHaveLength(original);
    expect(session.state.editor.aiConceptPreview?.objects).toHaveLength(1);
    expect(session.state.editor.history.undoDepth).toBe(0);

    session.acceptAiConceptPreview();
    expect(session.state.project.document.objects).toHaveLength(original + 1);
    expect(session.state.editor.selectionIds).toEqual([
      "30000000-0000-4000-8000-000000000001",
    ]);
    expect(session.state.editor.history.undoDepth).toBe(1);
    session.undo();
    expect(session.state.project.document.objects).toHaveLength(original);
  });

  it("blocks mismatched wording and stale concepts without mutating history", () => {
    const session = new ProjectSession(dependencies());
    session.previewAiConcept(concept(false), session.projectFingerprint);
    expect(() => session.acceptAiConceptPreview()).toThrow(/wording/u);
    expect(session.state.editor.history.undoDepth).toBe(0);
    session.cancelAiConceptPreview();

    session.previewAiConcept(concept(), session.projectFingerprint);
    session.dispatch({ type: "project.set-display-unit", displayUnit: "inches" });
    expect(() => session.acceptAiConceptPreview()).toThrow(/project changed/u);
  });

  it("rejects a stale concept instead of stamping it onto the current project", () => {
    const session = new ProjectSession(dependencies());
    const sourceProjectFingerprint = session.projectFingerprint;
    session.dispatch({ type: "project.set-display-unit", displayUnit: "inches" });

    expect(() => session.previewAiConcept(
      concept(),
      sourceProjectFingerprint,
    )).toThrow(/stale preview/u);
    expect(session.state.editor.aiConceptPreview).toBeNull();
    expect(session.state.editor.history.undoDepth).toBe(1);
  });
});
