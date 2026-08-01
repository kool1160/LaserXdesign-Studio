import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

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

async function configureExactFixtureTrace(
  page: Page,
  fixtureSettings: {
    outputWidthMm: string;
    threshold: string;
    speckleAreaPx: string;
  },
): Promise<void> {
  await page
    .getByLabel("Trace output width millimeters")
    .fill(fixtureSettings.outputWidthMm);
  await page.getByLabel("Threshold").fill(fixtureSettings.threshold);
  await page.getByLabel("Blur px").fill("0");
  await page.getByLabel("Denoise px").fill("0");
  await page.getByLabel("Speckle area px").fill(fixtureSettings.speckleAreaPx);
  await page.getByLabel("Smoothing").fill("0");
  await page.getByLabel("Simplify mm").fill("0.1");
}

test("preprocesses a PNG, previews overlays, accepts editable paths, analyzes, saves, and undoes", async () => {
  const rasterPath = resolve(
    process.cwd(),
    "../../fixtures/images/m07/noisy-photo.png",
  );
  testLaunch = await launchPackaged(undefined, "discard", { rasterPath });
  const page = await testLaunch.electronApp.firstWindow();

  await configureExactFixtureTrace(page, {
    outputWidthMm: "160",
    threshold: "142",
    speckleAreaPx: "12",
  });
  await page.getByTestId("trace-raster").click();
  await expect(page.getByTestId("raster-trace-summary")).toContainText("noisy-photo.png");
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
    "Analysis complete",
  );
  await expect(page.getByTestId("cutability-analysis")).toContainText(
    "cut-ready claim: no",
  );
  await page.getByTestId("edit-path-nodes").click();
  await expect(page.getByTestId("path-edit-overlay")).toBeVisible();

  await clickAndWaitForCommand(page, "Save");
  await waitForProjectSchema(testLaunch.projectPath, 7);
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

test("decodes a real JPEG through Electron and traces the reviewed exact geometry", async () => {
  const rasterPath = resolve(
    process.cwd(),
    "../../fixtures/images/m07/clean-logo.jpg",
  );
  testLaunch = await launchPackaged(undefined, "discard", { rasterPath });
  const page = await testLaunch.electronApp.firstWindow();

  await configureExactFixtureTrace(page, {
    outputWidthMm: "192",
    threshold: "128",
    speckleAreaPx: "4",
  });
  await page.getByTestId("trace-raster").click();
  await expect(page.getByTestId("raster-trace-summary")).toContainText(
    "clean-logo.jpg",
  );
  const previewState = await page.evaluate(() => window.laserx.getState());
  expect(previewState.editor.rasterTracePreview?.summary).toMatchObject({
    sourceWidthPx: 192,
    sourceHeightPx: 128,
    traceWidthPx: 192,
    traceHeightPx: 128,
    pathCount: 2,
    nodeCount: 14,
  });

  await page.getByTestId("accept-raster-trace").click();
  await expect(page.getByTestId("cutability-analysis")).toContainText(
    "Analysis complete",
  );
  const acceptedState = await page.evaluate(() => window.laserx.getState());
  expect(
    acceptedState.project.document.objects.map((object) =>
      object.type === "path"
        ? object.points.map((point) => [point.xMm, point.yMm])
        : [],
    ),
  ).toEqual([
    [[34, 106], [58, 106], [58, 46], [146, 46], [146, 22], [34, 22]],
    [[112, 106], [136, 106], [136, 82], [160, 82], [160, 58], [88, 58], [88, 82], [112, 82]],
  ]);
  expect(acceptedState.editor.history.undoDepth).toBe(1);
  expect(acceptedState.analysis.cutability).toMatchObject({
    status: "complete",
    cutReady: false,
  });
});
