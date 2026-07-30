import { createBlankProject } from "@laserx/domain";
import { describe, expect, it } from "vitest";

import { ProjectSession } from "../src/index.js";

function dependencies() {
  let sequence = 0;
  return {
    createId: () =>
      sequence++ === 0
        ? "123e4567-e89b-42d3-a456-426614174000"
        : "123e4567-e89b-42d3-a456-426614174001",
    now: () => "2026-07-30T12:00:00.000Z",
  };
}

describe("ProjectSession", () => {
  it("creates, changes, saves, and reopens a blank project", () => {
    const session = new ProjectSession(dependencies());

    session.dispatch({
      type: "project.set-display-unit",
      displayUnit: "inches",
    });
    const saved = session.prepareSave();
    session.completeSave(saved, "C:\\projects\\sign.laserx");

    const reopenedSession = new ProjectSession(dependencies());
    const reopened = reopenedSession.open(
      saved,
      "C:\\projects\\sign.laserx",
    );

    expect(reopened.project.project.id).toBe(
      "123e4567-e89b-42d3-a456-426614174000",
    );
    expect(reopened.project.document.settings.displayUnit).toBe("inches");
    expect(reopened.dirty).toBe(false);
  });

  it("marks a changed project dirty", () => {
    const session = new ProjectSession(dependencies());
    expect(session.state.dirty).toBe(false);

    const project = createBlankProject({
      id: "123e4567-e89b-42d3-a456-426614174000",
      now: "2026-07-30T12:00:00.000Z",
    });
    session.open(project, "C:\\projects\\saved.laserx");
    expect(session.state.dirty).toBe(false);

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
