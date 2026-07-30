import { createBlankProject } from "@laserx/domain";
import { describe, expect, it } from "vitest";

import { ProjectSession } from "../src/index.js";

function dependencies() {
  let sequence = 0;
  return {
    createId: () =>
      `123e4567-e89b-42d3-a456-${String(sequence++).padStart(12, "0")}`,
    now: () => "2026-07-30T12:00:00.000Z",
  };
}

describe("ProjectSession", () => {
  it("creates an exact document, saves, and reopens all viewport state", () => {
    const session = new ProjectSession(dependencies());
    session.dispatch({
      type: "project.create-document",
      width: 24,
      height: 12,
      inputUnit: "inches",
    });
    session.dispatch({
      type: "project.set-viewport-preferences",
      updates: {
        gridSpacingMm: 12.7,
        gridVisible: false,
        snappingEnabled: true,
      },
    });
    const saved = session.prepareSave();
    session.completeSave(saved, "C:\\projects\\sign.laserx");

    const reopenedSession = new ProjectSession(dependencies());
    const reopened = reopenedSession.open(
      saved,
      "C:\\projects\\sign.laserx",
    );

    expect(reopened.project.document.dimensions).toEqual({
      widthMm: 609.6,
      heightMm: 304.8,
    });
    expect(reopened.project.document.settings.displayUnit).toBe("inches");
    expect(reopened.project.document.settings.viewport).toMatchObject({
      gridSpacingMm: 12.7,
      gridVisible: false,
      snapping: { enabled: true },
    });
    expect(reopened.dirty).toBe(false);
  });

  it("marks display and viewport preference changes dirty", () => {
    const session = new ProjectSession(dependencies());
    expect(session.state.dirty).toBe(false);

    const project = createBlankProject({
      id: "123e4567-e89b-42d3-a456-426614174000",
      documentId: "123e4567-e89b-42d3-a456-426614174001",
      now: "2026-07-30T12:00:00.000Z",
    });
    session.open(project, "C:\\projects\\saved.laserx");
    session.dispatch({
      type: "project.set-display-unit",
      displayUnit: "inches",
    });
    expect(session.state.dirty).toBe(true);
  });

  it("restores recovery as dirty and retains the original path", () => {
    const session = new ProjectSession(dependencies());
    const project = createBlankProject({
      id: "123e4567-e89b-42d3-a456-426614174000",
      documentId: "123e4567-e89b-42d3-a456-426614174001",
      now: "2026-07-30T12:00:00.000Z",
    });
    session.open(project, "C:\\projects\\original.laserx");
    session.dispatch({
      type: "project.set-display-unit",
      displayUnit: "inches",
    });

    const snapshot = session.createRecoverySnapshot();
    const recoveredSession = new ProjectSession(dependencies());
    const recovered = recoveredSession.recover(snapshot);

    expect(recovered.filePath).toBe("C:\\projects\\original.laserx");
    expect(recovered.dirty).toBe(true);
    expect(recovered.recovered).toBe(true);
    expect(recovered.project.document.settings.displayUnit).toBe("inches");
  });
});
