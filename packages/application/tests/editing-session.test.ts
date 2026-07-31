import {
  createBlankProject,
  getObjectBounds,
  identityTransform,
  type DocumentObject,
  type EditorCommand,
  type LaserxProject,
} from "@laserx/domain";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_HISTORY_LIMIT,
  ProjectSession,
  type LifecycleDependencies,
} from "../src/index.js";

const NOW = "2026-07-30T12:00:00.000Z";
const PROJECT_ID = "10000000-0000-4000-8000-000000000000";
const DOCUMENT_ID = "20000000-0000-4000-8000-000000000000";
const LAYER_ID = "30000000-0000-4000-8000-000000000000";
const LOCKED_LAYER_ID = "40000000-0000-4000-8000-000000000000";
const HIDDEN_LAYER_ID = "50000000-0000-4000-8000-000000000000";
const RECT_ONE = "60000000-0000-4000-8000-000000000000";
const RECT_TWO = "70000000-0000-4000-8000-000000000000";
const RECT_THREE = "80000000-0000-4000-8000-000000000000";

function dependencies(): LifecycleDependencies {
  let sequence = 1;
  return {
    createId: () =>
      `f0000000-0000-4000-8000-${String(sequence++).padStart(12, "0")}`,
    now: () => NOW,
  };
}

function rectangle(
  id: string,
  layerId: string,
  xMm: number,
  yMm: number,
): DocumentObject {
  return {
    id,
    type: "rectangle",
    layerId,
    transform: identityTransform(),
    origin: { xMm, yMm },
    widthMm: 20,
    heightMm: 10,
  };
}

function projectFixture(): LaserxProject {
  return createBlankProject({
    id: PROJECT_ID,
    documentId: DOCUMENT_ID,
    now: NOW,
    width: 200,
    height: 100,
    layers: [
      { id: LAYER_ID, name: "Artwork", visible: true, locked: false },
      {
        id: LOCKED_LAYER_ID,
        name: "Locked",
        visible: true,
        locked: true,
      },
      {
        id: HIDDEN_LAYER_ID,
        name: "Hidden",
        visible: false,
        locked: false,
      },
    ],
    activeLayerId: LAYER_ID,
    objects: [
      rectangle(RECT_ONE, LAYER_ID, 10, 10),
      rectangle(RECT_TWO, LAYER_ID, 50, 10),
      rectangle(RECT_THREE, LAYER_ID, 90, 30),
      rectangle(
        "90000000-0000-4000-8000-000000000000",
        LOCKED_LAYER_ID,
        130,
        10,
      ),
      rectangle(
        "a0000000-0000-4000-8000-000000000000",
        HIDDEN_LAYER_ID,
        160,
        10,
      ),
    ],
  });
}

function sessionWithFixture(historyLimit = DEFAULT_HISTORY_LIMIT) {
  const session = new ProjectSession(dependencies(), historyLimit);
  session.open(projectFixture(), "C:\\projects\\editing.laserx");
  return session;
}

function projectJson(session: ProjectSession): string {
  return JSON.stringify(session.state.project);
}

function boundsCenter(bounds: {
  minXmm: number;
  minYmm: number;
  maxXmm: number;
  maxYmm: number;
}) {
  return {
    xMm: (bounds.minXmm + bounds.maxXmm) / 2,
    yMm: (bounds.minYmm + bounds.maxYmm) / 2,
  };
}

function expectUndoRedo(
  session: ProjectSession,
  command: EditorCommand,
): void {
  const before = projectJson(session);
  session.executeEditorCommand(command);
  const after = projectJson(session);
  expect(after).not.toBe(before);
  session.undo();
  expect(projectJson(session)).toBe(before);
  session.redo();
  expect(projectJson(session)).toBe(after);
}

describe("editing ProjectSession", () => {
  it("owns single, modifier, and marquee selection outside the document", () => {
    const session = sessionWithFixture();
    session.performEditorAction({
      type: "selection.point",
      point: { xMm: 15, yMm: 15 },
      toleranceMm: 1,
      mode: "replace",
    });
    expect(session.state.editor.selectionIds).toEqual([RECT_ONE]);

    session.performEditorAction({
      type: "selection.point",
      point: { xMm: 55, yMm: 15 },
      toleranceMm: 1,
      mode: "add",
    });
    expect(session.state.editor.selectionIds).toEqual([
      RECT_ONE,
      RECT_TWO,
    ]);

    session.performEditorAction({
      type: "selection.marquee",
      bounds: { minXmm: 0, minYmm: 0, maxXmm: 120, maxYmm: 50 },
      mode: "replace",
    });
    expect(session.state.editor.selectionIds).toEqual([
      RECT_ONE,
      RECT_TWO,
      RECT_THREE,
    ]);
    expect(session.state.project.document).not.toHaveProperty("selection");

    session.performEditorAction({
      type: "selection.point",
      point: { xMm: 135, yMm: 15 },
      toleranceMm: 1,
      mode: "replace",
    });
    expect(session.state.editor.selectionIds).toEqual([]);
  });

  it("undoes and redoes every persistent editing command without ID corruption", () => {
    const session = sessionWithFixture();
    const selectionBounds = session.state.project.document.objects
      .filter((object) => [RECT_ONE, RECT_TWO].includes(object.id))
      .map((object) => getObjectBounds(object));
    const pivot = boundsCenter({
      minXmm: Math.min(...selectionBounds.map((bounds) => bounds.minXmm)),
      minYmm: Math.min(...selectionBounds.map((bounds) => bounds.minYmm)),
      maxXmm: Math.max(...selectionBounds.map((bounds) => bounds.maxXmm)),
      maxYmm: Math.max(...selectionBounds.map((bounds) => bounds.maxYmm)),
    });
    const duplicateId = "b0000000-0000-4000-8000-000000000000";
    const groupId = "c0000000-0000-4000-8000-000000000000";
    const layerId = "d0000000-0000-4000-8000-000000000000";
    const guideId = "e0000000-0000-4000-8000-000000000000";

    const commands: EditorCommand[] = [
      {
        type: "objects.move",
        objectIds: [RECT_ONE],
        deltaXmm: 5,
        deltaYmm: 7,
      },
      {
        type: "objects.set-bounds",
        objectIds: [RECT_ONE],
        xMm: 20,
        yMm: 15,
        widthMm: 30,
        heightMm: 15,
        lockAspectRatio: false,
      },
      {
        type: "objects.scale",
        objectIds: [RECT_ONE],
        scaleX: 1.1,
        scaleY: 0.9,
        pivot,
      },
      {
        type: "objects.rotate",
        objectIds: [RECT_ONE],
        angleDeg: 15,
        pivot,
      },
      {
        type: "objects.mirror",
        objectIds: [RECT_ONE],
        axis: "vertical",
        pivot,
      },
      {
        type: "objects.duplicate",
        objectIds: [RECT_ONE],
        idMap: { [RECT_ONE]: duplicateId },
        offsetXmm: 10,
        offsetYmm: 10,
      },
      {
        type: "objects.delete",
        objectIds: [duplicateId],
      },
      {
        type: "objects.align",
        objectIds: [RECT_ONE, RECT_TWO],
        alignment: "bottom",
      },
      {
        type: "objects.distribute",
        objectIds: [RECT_ONE, RECT_TWO, RECT_THREE],
        distribution: "horizontal",
      },
      {
        type: "objects.group",
        objectIds: [RECT_ONE, RECT_TWO],
        groupId,
        layerId: LAYER_ID,
      },
      {
        type: "objects.rotate",
        objectIds: [groupId],
        angleDeg: 20,
        pivot,
      },
      {
        type: "objects.ungroup",
        objectIds: [groupId],
      },
      {
        type: "objects.z-order",
        objectIds: [RECT_ONE],
        action: "bring-front",
      },
      {
        type: "layer.add",
        layer: {
          id: layerId,
          name: "Details",
          visible: true,
          locked: false,
        },
      },
      { type: "layer.rename", layerId, name: "Cut details" },
      { type: "layer.reorder", layerId, toIndex: 0 },
      { type: "layer.set-visibility", layerId, visible: false },
      { type: "layer.set-locked", layerId, locked: true },
      { type: "layer.activate", layerId: LAYER_ID },
      {
        type: "guide.add",
        guide: { id: guideId, axis: "x", positionMm: 25 },
      },
      { type: "guide.move", guideId, positionMm: 30 },
      { type: "guide.delete", guideId },
      {
        type: "layer.delete",
        layerId,
        fallbackLayerId: LAYER_ID,
      },
    ];

    for (const command of commands) {
      expectUndoRedo(session, command);
    }
    const ids = session.state.project.document.objects.flatMap((object) =>
      object.type === "group"
        ? [object.id, ...object.children.map((child) => child.id)]
        : [object.id],
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("groups a transaction into one bounded history entry", () => {
    const session = sessionWithFixture();
    const before = projectJson(session);
    session.beginTransaction("Pointer move");
    for (let index = 0; index < 10; index += 1) {
      session.executeEditorCommand({
        type: "objects.move",
        objectIds: [RECT_ONE],
        deltaXmm: 1,
        deltaYmm: 0,
      });
    }
    expect(session.state.editor.history.undoDepth).toBe(0);
    expect(session.state.editor.history.transactionActive).toBe(true);
    session.commitTransaction();
    expect(session.state.editor.history.undoDepth).toBe(1);
    const after = projectJson(session);

    session.undo();
    expect(projectJson(session)).toBe(before);
    session.redo();
    expect(projectJson(session)).toBe(after);
  });

  it("restores selection and preserves redo when a transaction is canceled", () => {
    const session = sessionWithFixture();
    session.performEditorAction({
      type: "selection.point",
      point: { xMm: 15, yMm: 15 },
      toleranceMm: 1,
      mode: "replace",
    });
    const editA: EditorCommand = {
      type: "objects.move",
      objectIds: [RECT_ONE],
      deltaXmm: 5,
      deltaYmm: 0,
    };
    session.executeEditorCommand(editA);
    const afterEditA = projectJson(session);
    session.undo();
    const beforeTransaction = projectJson(session);
    expect(session.state.editor.history.redoDepth).toBe(1);
    expect(session.state.editor.selectionIds).toEqual([RECT_ONE]);

    session.beginTransaction("Canceled edit");
    session.executeEditorCommand({
      type: "objects.delete",
      objectIds: [RECT_ONE],
    });
    expect(session.state.editor.selectionIds).toEqual([]);
    session.cancelTransaction();

    expect(projectJson(session)).toBe(beforeTransaction);
    expect(session.state.editor.selectionIds).toEqual([RECT_ONE]);
    expect(session.state.editor.history).toMatchObject({
      undoDepth: 0,
      redoDepth: 1,
      transactionActive: false,
    });
    expect(session.lastEditorCommand).toEqual(editA);

    session.redo();
    expect(projectJson(session)).toBe(afterEditA);
    expect(session.state.editor.selectionIds).toEqual([RECT_ONE]);
    expect(session.state.editor.history.redoDepth).toBe(0);
  });

  it("copy, paste, and duplicate create fresh deterministic IDs", () => {
    const session = sessionWithFixture();
    session.performEditorAction({
      type: "selection.point",
      point: { xMm: 15, yMm: 15 },
      toleranceMm: 1,
      mode: "replace",
    });
    session.performEditorAction({ type: "clipboard.copy" });
    session.performEditorAction({ type: "clipboard.paste" });
    const firstPaste = session.state.editor.selectionIds[0];
    session.performEditorAction({ type: "clipboard.paste" });
    const secondPaste = session.state.editor.selectionIds[0];
    session.performEditorAction({ type: "objects.duplicate-selection" });
    const duplicate = session.state.editor.selectionIds[0];

    expect(firstPaste).toBeDefined();
    expect(secondPaste).toBeDefined();
    expect(duplicate).toBeDefined();
    expect(new Set([RECT_ONE, firstPaste, secondPaste, duplicate]).size).toBe(
      4,
    );
    expect(session.state.editor.clipboardHasContent).toBe(true);
  });

  it("replays a representative 100-step history deterministically", () => {
    const first = sessionWithFixture();
    const second = sessionWithFixture();
    const initial = projectJson(first);
    for (let index = 0; index < 100; index += 1) {
      const command: EditorCommand = {
        type: "objects.move",
        objectIds: [RECT_ONE],
        deltaXmm: index % 2 === 0 ? 0.25 : -0.125,
        deltaYmm: index % 3 === 0 ? 0.5 : -0.25,
      };
      first.executeEditorCommand(command);
      second.executeEditorCommand(command);
    }
    expect(projectJson(first)).toBe(projectJson(second));
    const final = projectJson(first);
    expect(first.state.editor.history.undoDepth).toBe(100);
    for (let index = 0; index < 100; index += 1) {
      first.undo();
    }
    expect(projectJson(first)).toBe(initial);
    for (let index = 0; index < 100; index += 1) {
      first.redo();
    }
    expect(projectJson(first)).toBe(final);
  });

  it("enforces the configured history bound", () => {
    const session = sessionWithFixture(10);
    for (let index = 0; index < 25; index += 1) {
      session.executeEditorCommand({
        type: "objects.move",
        objectIds: [RECT_ONE],
        deltaXmm: 1,
        deltaYmm: 0,
      });
    }
    expect(session.state.editor.history).toMatchObject({
      undoDepth: 10,
      limit: 10,
    });
  });

  it("restores normalized path geometry byte-for-byte after topology undo", () => {
    const pathId = "b0000000-0000-4000-8000-000000000000";
    const session = sessionWithFixture();
    session.executeEditorCommand({
      type: "objects.insert",
      objects: [
        {
          id: pathId,
          type: "path",
          layerId: LAYER_ID,
          transform: identityTransform(),
          closed: false,
          points: [
            { xMm: 0, yMm: 0 },
            { xMm: 5, yMm: 0.02 },
            { xMm: 10, yMm: 0 },
          ],
        },
      ],
    });
    const before = projectJson(session);
    session.executeEditorCommand({
      type: "path.simplify",
      objectId: pathId,
      toleranceMm: 0.1,
    });
    expect(session.state.editor.topologySummary).toMatchObject({
      operation: "Simplify path",
      beforeNodeCount: 3,
      afterNodeCount: 2,
      replacedObjectIds: [pathId],
    });
    session.undo();
    expect(projectJson(session)).toBe(before);
    session.redo();
    expect(
      session.state.project.document.objects.find(
        (object) => object.id === pathId,
      ),
    ).toMatchObject({
      id: pathId,
      type: "path",
      points: [
        { xMm: 0, yMm: 0 },
        { xMm: 10, yMm: 0 },
      ],
    });
  });

  it("surfaces cleanup removals and self-intersections in the topology summary", () => {
    const pathId = "c0000000-0000-4000-8000-000000000000";
    const session = sessionWithFixture();
    session.executeEditorCommand({
      type: "objects.insert",
      objects: [
        {
          id: pathId,
          type: "path",
          layerId: LAYER_ID,
          transform: identityTransform(),
          closed: true,
          points: [
            { xMm: 0, yMm: 0 },
            { xMm: 5, yMm: 5 },
            { xMm: 5, yMm: 5 },
            { xMm: 0, yMm: 5 },
            { xMm: 5, yMm: 0 },
          ],
        },
      ],
    });
    session.executeEditorCommand({
      type: "path.cleanup",
      objectId: pathId,
      toleranceMm: 0.001,
    });
    expect(session.state.editor.topologySummary).toMatchObject({
      operation: "Clean contour",
      beforeNodeCount: 5,
      afterNodeCount: 4,
    });
    expect(session.state.editor.topologySummary?.warnings.join(" ")).toMatch(
      /Removed 1.*self-intersection/,
    );
  });
});
