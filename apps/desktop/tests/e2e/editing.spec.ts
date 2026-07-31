import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { DocumentObject } from "@laserx/domain";
import { expect, test } from "@playwright/test";

import {
  clickAndWaitForCommand,
  killAndRemove,
  launchPackaged,
  waitForProjectSchema,
} from "./helpers.js";

function canonicalLineGeometry(object: DocumentObject | undefined) {
  if (object?.type !== "line") {
    return null;
  }
  const worldPoint = (point: { xMm: number; yMm: number }) => {
    const xMm =
      object.transform.a * point.xMm +
      object.transform.c * point.yMm +
      object.transform.eMm;
    const yMm =
      object.transform.b * point.xMm +
      object.transform.d * point.yMm +
      object.transform.fMm;
    return {
      xMm: Number(xMm.toFixed(9)),
      yMm: Number(yMm.toFixed(9)),
    };
  };
  return {
    id: object.id,
    start: { ...object.start },
    end: { ...object.end },
    transform: { ...object.transform },
    worldStart: worldPoint(object.start),
    worldEnd: worldPoint(object.end),
  };
}

test("packaged editing workflow persists deterministic M03 state", async () => {
  const launched = await launchPackaged();
  try {
    const page = await launched.electronApp.firstWindow();

    await page.getByTestId("add-rectangle").click();
    await expect(page.getByTestId("selection-count")).toHaveText(
      "1 object selected",
    );
    await expect(page.getByTestId("selection-overlay")).toBeVisible();

    const initialRectangleId = await page.evaluate(
      async () => (await window.laserx.getState()).editor.selectionIds[0],
    );
    expect(initialRectangleId).toBeDefined();
    const initialWidth = await page.evaluate(async () => {
      const bounds = (await window.laserx.getState()).editor.selectionBounds;
      return bounds === null ? 0 : bounds.maxXmm - bounds.minXmm;
    });
    const eastHandle = await page.getByTestId("handle-east").boundingBox();
    if (eastHandle === null) {
      throw new Error("The east transform handle has no screen bounds.");
    }
    await page.mouse.move(
      eastHandle.x + eastHandle.width / 2,
      eastHandle.y + eastHandle.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      eastHandle.x + eastHandle.width / 2 + 30,
      eastHandle.y + eastHandle.height / 2,
    );
    await page.mouse.up();
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const bounds = (await window.laserx.getState()).editor
            .selectionBounds;
          return bounds === null ? 0 : bounds.maxXmm - bounds.minXmm;
        }),
      )
      .toBeGreaterThan(initialWidth);
    await page.getByTestId("undo").click();
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const bounds = (await window.laserx.getState()).editor
            .selectionBounds;
          return bounds === null
            ? 0
            : Number((bounds.maxXmm - bounds.minXmm).toFixed(9));
        }),
      )
      .toBe(initialWidth);

    await page.keyboard.press("ArrowRight");
    await expect
      .poll(async () =>
        page.evaluate(
          async () =>
            (await window.laserx.getState()).project.document.objects[0]
              ?.transform.eMm,
        ),
      )
      .toBe(1);

    await expect(page.getByLabel("Selection X")).toHaveValue("113.4");
    await page.getByLabel("Selection X").fill("20");
    await page.getByLabel("Selection Y").fill("15");
    await page.getByLabel("Selection width").fill("90");
    await page.getByLabel("Selection height").fill("40");
    await page.getByText("Lock aspect ratio").click();
    await page.getByRole("button", { name: "Apply exact bounds" }).click();
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const bounds = (await window.laserx.getState()).editor
            .selectionBounds;
          return bounds === null
            ? null
            : [
                bounds.minXmm,
                bounds.minYmm,
                bounds.maxXmm,
                bounds.maxYmm,
              ].map((value) => Number(value.toFixed(9)));
        }),
      )
      .toEqual([20, 15, 110, 55]);

    await page.getByRole("button", { name: "Duplicate" }).click();
    const duplicateId = await page.evaluate(
      async () => (await window.laserx.getState()).editor.selectionIds[0],
    );
    expect(duplicateId).not.toBe(initialRectangleId);
    await page.keyboard.press("Control+c");
    await page.keyboard.press("Control+v");
    const pastedId = await page.evaluate(
      async () => (await window.laserx.getState()).editor.selectionIds[0],
    );
    expect(new Set([initialRectangleId, duplicateId, pastedId]).size).toBe(3);

    await page.keyboard.press("Control+a");
    await expect(page.getByTestId("selection-count")).toHaveText(
      "3 objects selected",
    );
    await page.getByRole("button", { name: "Group", exact: true }).click();
    await expect(page.getByTestId("selection-count")).toHaveText(
      "1 object selected",
    );
    await page.getByLabel("Rotation degrees").fill("30");
    await page.getByRole("button", { name: "Rotate", exact: true }).click();
    const rotatedTransform = await page.evaluate(async () => {
      const object = (await window.laserx.getState()).project.document
        .objects[0];
      return object?.transform;
    });
    await page.getByTestId("undo").click();
    await expect
      .poll(async () =>
        page.evaluate(
          async () =>
            (await window.laserx.getState()).project.document.objects[0]
              ?.transform,
        ),
      )
      .not.toEqual(rotatedTransform);
    await page.getByTestId("redo").click();
    await expect
      .poll(async () =>
        page.evaluate(
          async () =>
            (await window.laserx.getState()).project.document.objects[0]
              ?.transform,
        ),
      )
      .toEqual(rotatedTransform);
    await page.getByRole("button", { name: "Ungroup", exact: true }).click();
    await expect(page.getByTestId("selection-count")).toHaveText(
      "3 objects selected",
    );

    await page.getByTestId("add-layer").click();
    await expect(page.locator(".layer-list li")).toHaveCount(2);
    const secondLayerName = page.getByLabel("Rename Layer 2");
    await secondLayerName.fill("Details");
    await secondLayerName.press("Tab");
    await page.getByTestId("add-ellipse").click();
    const detailId = await page.evaluate(
      async () => (await window.laserx.getState()).editor.selectionIds[0],
    );
    await page.getByRole("button", { name: "Lock Details" }).click();
    await expect(page.getByTestId("selection-count")).toHaveText(
      "No objects selected",
    );
    const lockedState = await page.evaluate(async () => {
      const state = await window.laserx.getState();
      return {
        detailExists: state.project.document.objects.some(
          (object) => object.id === state.project.document.objects.at(-1)?.id,
        ),
        selection: state.editor.selectionIds,
      };
    });
    expect(lockedState).toEqual({ detailExists: true, selection: [] });
    expect(detailId).toBeDefined();
    await page.getByRole("button", { name: "Unlock Details" }).click();
    await page.getByRole("button", { name: "Hide Details" }).click();
    await page.getByRole("button", { name: "Show Details" }).click();
    await page.getByRole("button", { name: "Move Details up" }).click();
    await page.getByRole("button", { name: "Vertical center" }).click();

    const beforeSave = await page.evaluate(
      async () => (await window.laserx.getState()).project.document,
    );
    await clickAndWaitForCommand(page, "Save as");
    await waitForProjectSchema(launched.projectPath, 4);
    const diskProject = JSON.parse(
      await readFile(launched.projectPath, "utf8"),
    ) as { schemaVersion: number; document: unknown };
    expect(diskProject.schemaVersion).toBe(4);
    expect(diskProject.document).toEqual(beforeSave);

    await page.getByRole("button", { name: "New", exact: true }).click();
    await page.getByRole("button", { name: "Open", exact: true }).click();
    await expect
      .poll(async () =>
        page.evaluate(
          async () => (await window.laserx.getState()).project.document,
        ),
      )
      .toEqual(beforeSave);

    if (process.env.LASERX_CAPTURE_SCREENSHOT === "1") {
      await page.keyboard.press("Control+a");
      await expect(page.getByTestId("selection-overlay")).toBeVisible();
      await page.locator(".app-shell").screenshot({
        path: resolve(
          process.cwd(),
          "../../docs/screenshots/m03-editing-core.png",
        ),
      });
    }
  } finally {
    await killAndRemove(launched);
  }
});

test("packaged exact inspector preserves signed horizontal-line geometry", async () => {
  const launched = await launchPackaged();
  try {
    const page = await launched.electronApp.firstWindow();

    await page.getByTestId("add-line").click();
    await expect(page.getByTestId("selection-count")).toHaveText(
      "1 object selected",
    );
    const lineId = await page.evaluate(
      async () => (await window.laserx.getState()).editor.selectionIds[0],
    );
    expect(lineId).toBeDefined();
    if (lineId === undefined) {
      throw new Error("Expected the default horizontal line to be selected.");
    }
    const originalLine = await page.evaluate(async (selectedId) => {
      const state = await window.laserx.getState();
      return state.project.document.objects.find(
        (object) => object.id === selectedId,
      );
    }, lineId);
    expect(canonicalLineGeometry(originalLine)).toMatchObject({
      worldStart: { xMm: 112.4, yMm: 152.4 },
      worldEnd: { xMm: 192.4, yMm: 152.4 },
    });

    await page.getByLabel("Selection X").fill("0");
    await page.getByLabel("Selection Y").fill("-25");
    await page.getByLabel("Selection width").fill("120");
    await page.getByLabel("Selection height").fill("0");
    await page.getByRole("button", { name: "Apply exact bounds" }).click();
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const bounds = (await window.laserx.getState()).editor
            .selectionBounds;
          return bounds === null
            ? null
            : [
                bounds.minXmm,
                bounds.minYmm,
                bounds.maxXmm,
                bounds.maxYmm,
              ];
        }),
      )
      .toEqual([0, -25, 120, -25]);

    const editedLine = await page.evaluate(async (selectedId) => {
      const state = await window.laserx.getState();
      return state.project.document.objects.find(
        (object) => object.id === selectedId,
      );
    }, lineId);
    expect(canonicalLineGeometry(editedLine)).toMatchObject({
      id: lineId,
      start: { xMm: 112.4, yMm: 152.4 },
      end: { xMm: 192.4, yMm: 152.4 },
      worldStart: { xMm: 0, yMm: -25 },
      worldEnd: { xMm: 120, yMm: -25 },
    });
    expect(
      Object.values(editedLine?.transform ?? {}).every(Number.isFinite),
    ).toBe(true);

    await page.getByTestId("undo").click();
    await expect
      .poll(async () =>
        page.evaluate(
          async () => (await window.laserx.getState()).editor.selectionBounds,
        ),
      )
      .toEqual({
        minXmm: 112.4,
        minYmm: 152.4,
        maxXmm: 192.4,
        maxYmm: 152.4,
      });
    await page.getByTestId("redo").click();
    await expect
      .poll(async () =>
        page.evaluate(
          async () => (await window.laserx.getState()).editor.selectionBounds,
        ),
      )
      .toEqual({
        minXmm: 0,
        minYmm: -25,
        maxXmm: 120,
        maxYmm: -25,
      });

    await clickAndWaitForCommand(page, "Save as");
    await waitForProjectSchema(launched.projectPath, 4);
    const diskProject = JSON.parse(
      await readFile(launched.projectPath, "utf8"),
    ) as { document: { objects: DocumentObject[] } };
    expect(
      canonicalLineGeometry(
        diskProject.document.objects.find((object) => object.id === lineId),
      ),
    ).toMatchObject({
      id: lineId,
      worldStart: { xMm: 0, yMm: -25 },
      worldEnd: { xMm: 120, yMm: -25 },
    });

    await page.getByRole("button", { name: "New", exact: true }).click();
    await page.getByRole("button", { name: "Open", exact: true }).click();
    await expect
      .poll(async () =>
        page.evaluate(async (selectedId) => {
          const state = await window.laserx.getState();
          return state.project.document.objects.find(
            (object) => object.id === selectedId,
          );
        }, lineId),
      )
      .toEqual(editedLine);
  } finally {
    await killAndRemove(launched);
  }
});

test("packaged aspect lock honors height input and edge handles", async () => {
  const launched = await launchPackaged();
  try {
    const page = await launched.electronApp.firstWindow();

    await page.getByTestId("add-rectangle").click();
    await expect(page.getByTestId("selection-count")).toHaveText(
      "1 object selected",
    );
    await page.getByLabel("Selection height").fill("100");
    await page.getByRole("button", { name: "Apply exact bounds" }).click();
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const bounds = (await window.laserx.getState()).editor
            .selectionBounds;
          return bounds === null
            ? null
            : [
                Number((bounds.maxXmm - bounds.minXmm).toFixed(9)),
                Number((bounds.maxYmm - bounds.minYmm).toFixed(9)),
              ];
        }),
      )
      .toEqual([160, 100]);

    const eastHandle = await page.getByTestId("handle-east").boundingBox();
    if (eastHandle === null) {
      throw new Error("The east transform handle has no screen bounds.");
    }
    const startX = eastHandle.x + eastHandle.width / 2;
    const startY = eastHandle.y + eastHandle.height / 2;
    await page.keyboard.down("Shift");
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 40, startY);
    await page.mouse.up();
    await page.keyboard.up("Shift");

    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const bounds = (await window.laserx.getState()).editor
            .selectionBounds;
          if (bounds === null) {
            return null;
          }
          const width = bounds.maxXmm - bounds.minXmm;
          const height = bounds.maxYmm - bounds.minYmm;
          return {
            width: Number(width.toFixed(9)),
            height: Number(height.toFixed(9)),
            aspect: Number((width / height).toFixed(9)),
          };
        }),
      )
      .toMatchObject({ aspect: 1.6 });
    const lockedBounds = await page.evaluate(async () => {
      const bounds = (await window.laserx.getState()).editor.selectionBounds;
      if (bounds === null) {
        throw new Error("Expected locked transform bounds.");
      }
      return {
        width: bounds.maxXmm - bounds.minXmm,
        height: bounds.maxYmm - bounds.minYmm,
      };
    });
    expect(lockedBounds.width).toBeGreaterThan(160);
    expect(lockedBounds.height).toBeGreaterThan(100);

    await page.getByTestId("undo").click();
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const bounds = (await window.laserx.getState()).editor
            .selectionBounds;
          return bounds === null
            ? null
            : [
                Number((bounds.maxXmm - bounds.minXmm).toFixed(9)),
                Number((bounds.maxYmm - bounds.minYmm).toFixed(9)),
              ];
        }),
      )
      .toEqual([160, 100]);
    await page.getByTestId("redo").click();
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const bounds = (await window.laserx.getState()).editor
            .selectionBounds;
          if (bounds === null) {
            return null;
          }
          const width = bounds.maxXmm - bounds.minXmm;
          const height = bounds.maxYmm - bounds.minYmm;
          return Number((width / height).toFixed(9));
        }),
      )
      .toBe(1.6);
  } finally {
    await killAndRemove(launched);
  }
});

test("packaged pan gestures over artwork and handles preserve edits", async () => {
  const launched = await launchPackaged();
  try {
    const page = await launched.electronApp.firstWindow();

    await page.getByTestId("add-rectangle").click();
    await expect(page.getByTestId("selection-count")).toHaveText(
      "1 object selected",
    );
    const rectangleId = await page.evaluate(
      async () => (await window.laserx.getState()).editor.selectionIds[0],
    );
    if (rectangleId === undefined) {
      throw new Error("Expected the added rectangle to be selected.");
    }
    await page.getByTestId("fit-view").click();
    await expect(page.getByTestId("selection-overlay")).toBeVisible();
    const artwork = page
      .locator(`[data-object-id="${rectangleId}"]`)
      .first();
    const beforeAltPan = await artwork.boundingBox();
    if (beforeAltPan === null) {
      throw new Error("The selected artwork has no screen bounds.");
    }
    const editorBeforePan = await page.evaluate(async () => {
      const state = await window.laserx.getState();
      return {
        document: state.project.document,
        history: state.editor.history,
        selectionIds: state.editor.selectionIds,
      };
    });
    const viewport = page.getByTestId("viewport");
    const stockRegion = page.getByTestId("stock-region");
    const cameraBeforeAltPan = await stockRegion.boundingBox();
    if (cameraBeforeAltPan === null) {
      throw new Error("The stock region has no screen bounds.");
    }

    await page.mouse.move(
      beforeAltPan.x + beforeAltPan.width / 2,
      beforeAltPan.y + beforeAltPan.height / 2,
    );
    await page.keyboard.down("Alt");
    await page.mouse.down();
    await expect(page.getByTestId("viewport")).toHaveClass(/dragging/);
    await page.mouse.move(
      beforeAltPan.x + beforeAltPan.width / 2 + 48,
      beforeAltPan.y + beforeAltPan.height / 2 + 30,
      { steps: 5 },
    );
    await expect(viewport).toHaveClass(/dragging/);
    await expect
      .poll(async () => (await stockRegion.boundingBox())?.x)
      .toBeCloseTo(cameraBeforeAltPan.x + 48, 1);
    await expect
      .poll(async () => (await stockRegion.boundingBox())?.y)
      .toBeCloseTo(cameraBeforeAltPan.y + 30, 1);
    await page.mouse.up();
    await page.keyboard.up("Alt");
    expect(
      await page.evaluate(async () => {
        const state = await window.laserx.getState();
        return {
          document: state.project.document,
          history: state.editor.history,
          selectionIds: state.editor.selectionIds,
        };
      }),
    ).toEqual(editorBeforePan);

    const eastHandle = await page.getByTestId("handle-east").boundingBox();
    if (eastHandle === null) {
      throw new Error("The east handle has no screen bounds.");
    }
    const cameraBeforeMiddlePan = await stockRegion.boundingBox();
    if (cameraBeforeMiddlePan === null) {
      throw new Error("The stock region has no screen bounds.");
    }
    await page.mouse.move(
      eastHandle.x + eastHandle.width / 2,
      eastHandle.y + eastHandle.height / 2,
    );
    await page.mouse.down({ button: "middle" });
    await page.mouse.move(
      eastHandle.x + eastHandle.width / 2 - 36,
      eastHandle.y + eastHandle.height / 2 + 24,
    );
    await page.mouse.up({ button: "middle" });
    await expect
      .poll(async () => (await stockRegion.boundingBox())?.x)
      .toBeCloseTo(cameraBeforeMiddlePan.x - 36, 1);
    await expect
      .poll(async () => (await stockRegion.boundingBox())?.y)
      .toBeCloseTo(cameraBeforeMiddlePan.y + 24, 1);
    expect(
      await page.evaluate(async () => {
        const state = await window.laserx.getState();
        return {
          document: state.project.document,
          history: state.editor.history,
          selectionIds: state.editor.selectionIds,
        };
      }),
    ).toEqual(editorBeforePan);
  } finally {
    await killAndRemove(launched);
  }
});
