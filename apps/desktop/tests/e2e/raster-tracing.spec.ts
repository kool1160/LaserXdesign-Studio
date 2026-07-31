import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { expect, test } from "@playwright/test";

import { encodeRgbaPng } from "../../electron/raster-codec.js";
import {
  clickAndWaitForCommand,
  killAndRemove,
  launchPackaged,
  waitForProjectSchema,
  type TestLaunch,
} from "./helpers.js";

let testLaunch: TestLaunch | null = null;

test.afterEach(async () => {
  if (testLaunch !== null) {
    await killAndRemove(testLaunch);
    testLaunch = null;
  }
});

test("preprocesses a PNG, previews overlays, accepts editable paths, analyzes, saves, and undoes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "laserx-raster-e2e-"));
  const rasterPath = join(directory, "clean-logo.png");
  const widthPx = 64;
  const heightPx = 48;
  const rgba = new Uint8Array(widthPx * heightPx * 4).fill(255);
  for (let index = 0; index < widthPx * heightPx; index += 1) {
    rgba[index * 4 + 3] = 255;
  }
  for (let y = 10; y < 38; y += 1) {
    for (let x = 14; x < 50; x += 1) {
      if (x < 21 || x >= 43 || (y >= 21 && y < 27)) {
        const offset = (y * widthPx + x) * 4;
        rgba[offset] = 20;
        rgba[offset + 1] = 20;
        rgba[offset + 2] = 20;
      }
    }
  }
  await writeFile(rasterPath, encodeRgbaPng(widthPx, heightPx, rgba));
  testLaunch = await launchPackaged(directory, "discard", { rasterPath });
  const page = await testLaunch.electronApp.firstWindow();

  await page.getByTestId("trace-raster").click();
  await expect(page.getByTestId("raster-trace-summary")).toContainText("clean-logo.png");
  await expect(page.getByTestId("raster-trace-summary")).toContainText("paths");
  await expect(page.getByTestId("raster-preview-image")).toBeVisible();
  await expect(page.getByTestId("import-preview-overlay")).toBeVisible();
  await expect(page.getByTestId("dirty-indicator")).toHaveCount(0);

  await page.getByLabel("Raster preview mode").selectOption("blackWhite");
  await expect(page.getByTestId("raster-preview-image")).toBeVisible();
  await page.getByLabel("Raster preview mode").selectOption("edges");
  await expect(page.getByTestId("raster-preview-image")).toBeVisible();
  await page.getByLabel("Raster preview mode").selectOption("overlay");
  if (process.env.LASERX_CAPTURE_SCREENSHOT === "1") {
    await page.locator(".app-shell").screenshot({
      path: resolve(process.cwd(), "../../docs/screenshots/m07-raster-tracing.png"),
    });
  }

  await page.getByTestId("accept-raster-trace").click();
  await expect(page.getByTestId("raster-trace-summary")).toHaveCount(0);
  await expect(page.getByTestId("selection-count")).toContainText("selected");
  await expect(page.getByTestId("cutability-analysis")).toContainText(
    "Cutability review required",
  );
  await expect(page.getByTestId("cutability-analysis")).toContainText(
    "cut-ready: no",
  );
  await page.getByTestId("edit-path-nodes").click();
  await expect(page.getByTestId("path-edit-overlay")).toBeVisible();

  await clickAndWaitForCommand(page, "Save");
  await waitForProjectSchema(testLaunch.projectPath, 5);
  const saved = JSON.parse(await readFile(testLaunch.projectPath, "utf8")) as {
    document: { objects: Array<{ type: string; closed?: boolean; points?: unknown[] }> };
  };
  expect(saved.document.objects.length).toBeGreaterThan(0);
  expect(saved.document.objects.every((object) => object.type === "path")).toBe(true);
  expect(saved.document.objects.every((object) => object.closed === true)).toBe(true);
  expect(saved.document.objects.every((object) => (object.points?.length ?? 0) >= 3)).toBe(true);
  expect(JSON.stringify(saved)).not.toContain("data:image");

  await page.getByTestId("undo").click();
  await expect(page.getByTestId("selection-count")).toContainText("No objects selected");
  await expect(page.getByTestId("cutability-analysis")).toHaveCount(0);
});
