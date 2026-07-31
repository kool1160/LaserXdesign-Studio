import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { createBlankProject, identityTransform } from "@laserx/domain";
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

async function seedOverlappingPaths(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "laserx-geometry-e2e-"));
  const project = createBlankProject({
    id: "44444444-4444-4444-8444-444444444444",
    documentId: "55555555-5555-4555-8555-555555555555",
    name: "Geometry E2E",
    now: "2026-07-31T12:00:00.000Z",
    layers: [{ id: LAYER_ID, name: "Artwork", visible: true, locked: false }],
    activeLayerId: LAYER_ID,
    objects: [
      {
        id: FIRST_PATH_ID,
        type: "path",
        layerId: LAYER_ID,
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

async function openOverlappingPaths(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Open", exact: true }).click();
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
    const beforeNodeMove = await page.evaluate(async () => {
      const state = await window.laserx.getState();
      const path = state.project.document.objects[0];
      return path?.type === "path" ? path.points[0] : null;
    });
    await page.keyboard.press("ArrowRight");
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
    await waitForProjectSchema(launched.projectPath, 5);
    const disk = JSON.parse(await readFile(launched.projectPath, "utf8")) as {
      schemaVersion: number;
      document: unknown;
    };
    expect(disk.schemaVersion).toBe(5);
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
