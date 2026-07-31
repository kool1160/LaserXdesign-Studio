import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  createBlankProject,
  identityTransform,
  type LaserxDocument,
  type PathObject,
} from "@laserx/domain";
import { serializeProject } from "@laserx/project-format";
import { expect, test, type Page } from "@playwright/test";

import {
  clickAndWaitForCommand,
  killAndRemove,
  launchPackaged,
  waitForProjectSchema,
} from "./helpers.js";

const FIRST_PATH_ID = "11111111-1111-4111-8111-111111111111";
const SECOND_PATH_ID = "22222222-2222-4222-8222-222222222222";
const LAYER_ID = "33333333-3333-4333-8333-333333333333";
const SECOND_LAYER_ID = "33333333-3333-4333-8333-333333333334";

async function seedOverlappingPaths(crossLayer = false): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "laserx-geometry-e2e-"));
  const project = createBlankProject({
    id: "44444444-4444-4444-8444-444444444444",
    documentId: "55555555-5555-4555-8555-555555555555",
    name: "Geometry E2E",
    now: "2026-07-31T12:00:00.000Z",
    layers: [
      { id: LAYER_ID, name: "Artwork", visible: true, locked: false },
      ...(crossLayer
        ? [
            {
              id: SECOND_LAYER_ID,
              name: "Other artwork",
              visible: true,
              locked: false,
            },
          ]
        : []),
    ],
    activeLayerId: LAYER_ID,
    objects: [
      {
        id: FIRST_PATH_ID,
        type: "path",
        layerId: crossLayer ? SECOND_LAYER_ID : LAYER_ID,
        transform: identityTransform(),
        closed: true,
        points: [
          { xMm: 30, yMm: 30 },
          { xMm: 70, yMm: 30 },
          { xMm: 70, yMm: 70 },
          { xMm: 30, yMm: 70 },
        ],
      },
      {
        id: SECOND_PATH_ID,
        type: "path",
        layerId: LAYER_ID,
        transform: identityTransform(),
        closed: true,
        points: [
          { xMm: 55, yMm: 45 },
          { xMm: 95, yMm: 45 },
          { xMm: 95, yMm: 85 },
          { xMm: 55, yMm: 85 },
        ],
      },
    ],
  });
  await writeFile(
    join(directory, "lifecycle.laserx"),
    serializeProject(project),
    "utf8",
  );
  return directory;
}

function pathBounds(path: PathObject) {
  return {
    minXmm: Math.min(...path.points.map((point) => point.xMm)),
    minYmm: Math.min(...path.points.map((point) => point.yMm)),
    maxXmm: Math.max(...path.points.map((point) => point.xMm)),
    maxYmm: Math.max(...path.points.map((point) => point.yMm)),
  };
}

function pathArea(path: PathObject): number {
  return Math.abs(
    path.points.reduce((area, point, index) => {
      const next = path.points[(index + 1) % path.points.length] as {
        xMm: number;
        yMm: number;
      };
      return area + point.xMm * next.yMm - next.xMm * point.yMm;
    }, 0) / 2,
  );
}

async function currentDocument(page: Page): Promise<LaserxDocument> {
  return page.evaluate(
    async () => (await window.laserx.getState()).project.document,
  );
}

async function selectPathsInOrder(
  page: Page,
  order: readonly (typeof FIRST_PATH_ID | typeof SECOND_PATH_ID)[],
): Promise<void> {
  const points = order.map((id) =>
    id === FIRST_PATH_ID
      ? { xMm: 35, yMm: 35 }
      : { xMm: 90, yMm: 80 },
  );
  await page.evaluate(async (selectionPoints) => {
    await window.laserx.editorAction({ type: "selection.clear" });
    for (const [index, point] of selectionPoints.entries()) {
      await window.laserx.editorAction({
        type: "selection.point",
        point,
        toleranceMm: 0.01,
        mode: index === 0 ? "replace" : "add",
      });
    }
  }, points);
  await expect
    .poll(async () =>
      page.evaluate(
        async () => (await window.laserx.getState()).editor.selectionIds,
      ),
    )
    .toEqual(order);
}

async function runBoolean(
  page: Page,
  operation: "subtract" | "intersect" | "xor",
): Promise<LaserxDocument> {
  const before = JSON.stringify(await currentDocument(page));
  await page.getByTestId(`boolean-${operation}`).click();
  await expect
    .poll(async () => JSON.stringify(await currentDocument(page)))
    .not.toBe(before);
  return currentDocument(page);
}

async function openOverlappingPaths(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect
    .poll(async () => (await currentDocument(page)).objects.length)
    .toBe(2);
  await page.evaluate(async () => {
    await window.laserx.editorAction({ type: "selection.all" });
  });
  await expect(page.getByTestId("selection-count")).toHaveText(
    "2 objects selected",
  );
}

test("packaged geometry workflow unions, edits, undoes, and persists paths", async () => {
  const launched = await launchPackaged(await seedOverlappingPaths());
  try {
    const page = await launched.electronApp.firstWindow();
    await openOverlappingPaths(page);
    const beforeUnion = await page.evaluate(
      async () => (await window.laserx.getState()).project.document,
    );

    await page.getByTestId("boolean-union").click();
    await expect(page.getByTestId("topology-summary")).toContainText("Union");
    const unionDocument = await page.evaluate(async () => {
      const state = await window.laserx.getState();
      return state.project.document;
    });
    expect(unionDocument.objects).toHaveLength(1);
    expect(unionDocument.objects[0]).toMatchObject({
      id: FIRST_PATH_ID,
      type: "path",
      closed: true,
    });
    await expect(page.getByTestId("topology-summary")).toContainText(
      "1 source object ID was replaced and reported",
    );

    await page.getByTestId("undo").click();
    await expect
      .poll(async () =>
        page.evaluate(
          async () => (await window.laserx.getState()).project.document,
        ),
      )
      .toEqual(beforeUnion);
    await page.getByTestId("redo").click();
    await expect
      .poll(async () =>
        page.evaluate(
          async () => (await window.laserx.getState()).project.document,
        ),
      )
      .toEqual(unionDocument);

    await page.getByTestId("edit-path-nodes").click();
    await expect(page.getByTestId("path-edit-overlay")).toBeVisible();
    await page.getByTestId("path-node").first().click();
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const selection = (await window.laserx.getState()).editor.pathSelection;
          return selection === null
            ? null
            : {
                objectId: selection.objectId,
                nodeIndices: selection.nodeIndices,
              };
        }),
      )
      .toEqual({ objectId: FIRST_PATH_ID, nodeIndices: [0] });
    const beforeNodeMove = await page.evaluate(async () => {
      const state = await window.laserx.getState();
      const path = state.project.document.objects[0];
      return path?.type === "path" ? path.points[0] : null;
    });
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const path = (await window.laserx.getState()).project.document.objects[0];
          return path?.type === "path" ? path.points[0] : null;
        }),
      )
      .not.toEqual(beforeNodeMove);
    await page.getByRole("button", { name: "+ Out handle" }).click();
    const editedDocument = await page.evaluate(async () => {
      const state = await window.laserx.getState();
      return state.project.document;
    });
    const editedPath = editedDocument.objects[0];
    expect(editedPath).toMatchObject({
      id: FIRST_PATH_ID,
      type: "path",
      closed: true,
    });
    if (editedPath?.type !== "path") {
      throw new Error("Expected the edited result to remain a path.");
    }
    expect(editedPath.points[0]).not.toEqual(beforeNodeMove);
    expect(editedPath.handles?.[0]?.outgoing).not.toBeNull();

    if (process.env.LASERX_CAPTURE_SCREENSHOT === "1") {
      await page.getByTestId("topology-summary").scrollIntoViewIfNeeded();
      await page.locator(".app-shell").screenshot({
        path: resolve(
          process.cwd(),
          "../../docs/screenshots/m05-geometry-editing.png",
        ),
      });
    }

    await clickAndWaitForCommand(page, "Save as");
    await waitForProjectSchema(launched.projectPath, 6);
    const disk = JSON.parse(await readFile(launched.projectPath, "utf8")) as {
      schemaVersion: number;
      document: unknown;
    };
    expect(disk.schemaVersion).toBe(6);
    expect(disk.document).toEqual(editedDocument);

    await page.getByRole("button", { name: "New", exact: true }).click();
    await page.getByRole("button", { name: "Open", exact: true }).click();
    await expect
      .poll(async () =>
        page.evaluate(
          async () => (await window.laserx.getState()).project.document,
        ),
      )
      .toEqual(editedDocument);
  } finally {
    await killAndRemove(launched);
  }
});

test("packaged booleans preserve subject order and expose subtract, intersect, and XOR results", async () => {
  const launched = await launchPackaged(await seedOverlappingPaths());
  try {
    const page = await launched.electronApp.firstWindow();
    await openOverlappingPaths(page);
    await expect(page.getByTestId("boolean-order")).toContainText(
      "first selected path as its subject",
    );

    await selectPathsInOrder(page, [SECOND_PATH_ID, FIRST_PATH_ID]);
    const secondMinusFirst = await runBoolean(page, "subtract");
    const secondResult = secondMinusFirst.objects[0];
    expect(secondMinusFirst.objects).toHaveLength(1);
    expect(secondResult).toMatchObject({ id: SECOND_PATH_ID, type: "path" });
    if (secondResult?.type !== "path") {
      throw new Error("Expected subtraction to produce a path.");
    }
    expect(pathBounds(secondResult)).toEqual({
      minXmm: 55,
      minYmm: 45,
      maxXmm: 95,
      maxYmm: 85,
    });

    await page.getByTestId("undo").click();
    await expect.poll(async () => (await currentDocument(page)).objects).toHaveLength(2);
    await selectPathsInOrder(page, [FIRST_PATH_ID, SECOND_PATH_ID]);
    const firstMinusSecond = await runBoolean(page, "subtract");
    const firstResult = firstMinusSecond.objects[0];
    expect(firstMinusSecond.objects).toHaveLength(1);
    expect(firstResult).toMatchObject({ id: FIRST_PATH_ID, type: "path" });
    if (firstResult?.type !== "path") {
      throw new Error("Expected reversed subtraction to produce a path.");
    }
    expect(pathBounds(firstResult)).toEqual({
      minXmm: 30,
      minYmm: 30,
      maxXmm: 70,
      maxYmm: 70,
    });

    await page.getByTestId("undo").click();
    await expect.poll(async () => (await currentDocument(page)).objects).toHaveLength(2);
    await selectPathsInOrder(page, [FIRST_PATH_ID, SECOND_PATH_ID]);
    const intersection = await runBoolean(page, "intersect");
    const intersectionResult = intersection.objects[0];
    expect(intersection.objects).toHaveLength(1);
    expect(intersectionResult).toMatchObject({ id: FIRST_PATH_ID, type: "path" });
    if (intersectionResult?.type !== "path") {
      throw new Error("Expected intersection to produce a path.");
    }
    expect(pathBounds(intersectionResult)).toEqual({
      minXmm: 55,
      minYmm: 45,
      maxXmm: 70,
      maxYmm: 70,
    });

    await page.getByTestId("undo").click();
    await expect.poll(async () => (await currentDocument(page)).objects).toHaveLength(2);
    await selectPathsInOrder(page, [FIRST_PATH_ID, SECOND_PATH_ID]);
    const xor = await runBoolean(page, "xor");
    const xorPaths = xor.objects.filter(
      (object): object is PathObject => object.type === "path",
    );
    expect(xorPaths).toHaveLength(2);
    expect(xorPaths.reduce((area, path) => area + pathArea(path), 0)).toBe(2450);
  } finally {
    await killAndRemove(launched);
  }
});

test("packaged cross-layer topology requests leave every source unchanged", async () => {
  const launched = await launchPackaged(await seedOverlappingPaths(true));
  try {
    const page = await launched.electronApp.firstWindow();
    await openOverlappingPaths(page);
    const before = await page.evaluate(async () => {
      const state = await window.laserx.getState();
      return {
        document: state.project.document,
        undoDepth: state.editor.history.undoDepth,
      };
    });

    await page.getByTestId("boolean-union").click();
    await expect(page.getByTestId("error-message")).toContainText(
      "share one editable layer",
    );
    const offsetResult = await page.evaluate(async () =>
      window.laserx.geometryOperation({
        operationId: "66666666-6666-4666-8666-666666666666",
        kind: "offset",
        distanceMm: 1,
        join: "round",
      }),
    );
    expect(offsetResult).toMatchObject({
      ok: false,
      error: expect.stringMatching(/share one editable layer/),
    });
    const after = await page.evaluate(async () => {
      const state = await window.laserx.getState();
      return {
        document: state.project.document,
        undoDepth: state.editor.history.undoDepth,
      };
    });
    expect(after).toEqual(before);
  } finally {
    await killAndRemove(launched);
  }
});

test("packaged geometry cancellation leaves the document unchanged", async () => {
  const launched = await launchPackaged(await seedOverlappingPaths(), "cancel", {
    geometryDelayMs: "500",
  });
  try {
    const page = await launched.electronApp.firstWindow();
    await openOverlappingPaths(page);
    const before = await page.evaluate(async () => {
      const state = await window.laserx.getState();
      return {
        document: state.project.document,
        undoDepth: state.editor.history.undoDepth,
      };
    });

    await page.getByTestId("boolean-union").click();
    await expect(page.getByTestId("cancel-geometry")).toBeVisible();
    await page.getByTestId("cancel-geometry").click();
    await expect(page.getByTestId("error-message")).toContainText(
      "original document was left unchanged",
    );
    const after = await page.evaluate(async () => {
      const state = await window.laserx.getState();
      return {
        document: state.project.document,
        undoDepth: state.editor.history.undoDepth,
      };
    });
    expect(after).toEqual(before);
  } finally {
    await killAndRemove(launched);
  }
});
