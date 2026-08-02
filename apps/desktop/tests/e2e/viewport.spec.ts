import { copyFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

import {
  clickAndWaitForCommand,
  killAndRemove,
  launchPackaged,
  waitForProjectSchema,
} from "./helpers.js";

test("pan, zoom, fit, rulers, grid, and exact readout work at high DPI", async () => {
  const launched = await launchPackaged(
    undefined,
    "cancel",
    { deviceScaleFactor: "2" },
  );
  try {
    const page = await launched.electronApp.firstWindow();
    await page.getByRole("button", { name: "Create document" }).click();
    await expect(page.getByTestId("document-dimensions")).toHaveText(
      "24 × 12 in",
    );
    await expect(page.getByTestId("viewport-rulers")).toBeVisible();
    await expect(page.getByTestId("viewport-grid")).toBeVisible();
    await expect(page.getByTestId("dpi-readout")).toHaveText("DPR 2.00");

    const viewport = page.getByTestId("viewport");
    const bounds = await viewport.boundingBox();
    if (bounds === null) {
      throw new Error("Viewport bounds are unavailable.");
    }
    await page.mouse.move(
      bounds.x + bounds.width * 0.6,
      bounds.y + bounds.height * 0.55,
    );
    await expect(page.getByTestId("cursor-coordinate")).toContainText("in");

    const initialZoom = await page.getByTestId("zoom-readout").textContent();
    await page.mouse.wheel(0, -300);
    await expect
      .poll(() => page.getByTestId("zoom-readout").textContent())
      .not.toBe(initialZoom);

    await page.mouse.move(bounds.x + 300, bounds.y + 220);
    await page.keyboard.down("Alt");
    await page.mouse.down();
    await page.mouse.move(bounds.x + 360, bounds.y + 270);
    await page.mouse.up();
    await page.keyboard.up("Alt");

    await page.getByTestId("reset-view").click();
    await expect(page.getByTestId("zoom-readout")).toHaveText("100%");
    await page.getByTestId("fit-view").click();
    await expect(page.getByTestId("stock-region")).toBeVisible();
    await page.mouse.move(
      bounds.x + bounds.width * 0.65,
      bounds.y + bounds.height * 0.6,
    );
    await expect(page.getByTestId("cursor-coordinate")).not.toContainText("—");

    const canonical = await page.evaluate(async () => {
      const state = await window.laserx.getState();
      return state.project.document.dimensions;
    });
    expect(canonical).toEqual({ widthMm: 609.6, heightMm: 304.8 });

    if (process.env.LASERX_CAPTURE_SCREENSHOT === "1") {
      await page.locator(".app-shell").screenshot({
        path: resolve(
          process.cwd(),
          "../../docs/screenshots/m02-viewport-inches.png",
        ),
      });
    }
  } finally {
    await killAndRemove(launched);
  }
});

test("schema-v1 project opens through the packaged migration path", async () => {
  const launched = await launchPackaged();
  try {
    await copyFile(
      resolve(process.cwd(), "../../fixtures/projects/blank-v1.laserx"),
      launched.projectPath,
    );
    const page = await launched.electronApp.firstWindow();
    await page.getByRole("button", { name: "Open Project", exact: true }).click();
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const current = await window.laserx.getState();
          return current.project.document.id;
        }),
      )
      .toBe("123e4567-e89b-42d3-a456-426614174000");
    await expect(page.getByTestId("document-dimensions")).toHaveText(
      "304.8 × 304.8 mm",
    );
    const migratedState = await page.evaluate(async () => {
      const current = await window.laserx.getState();
      return {
        documentId: current.project.document.id,
        dimensions: current.project.document.dimensions,
      };
    });
    expect(migratedState).toEqual({
      documentId: "123e4567-e89b-42d3-a456-426614174000",
      dimensions: { widthMm: 304.8, heightMm: 304.8 },
    });
    await clickAndWaitForCommand(page, "Save");
    await waitForProjectSchema(launched.projectPath, 9);
    const saved = JSON.parse(await readFile(launched.projectPath, "utf8")) as {
      schemaVersion: number;
    };
    expect(saved.schemaVersion).toBe(9);
  } finally {
    await killAndRemove(launched);
  }
});
