import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { expect, test } from "@playwright/test";

import {
  killAndRemove,
  launchPackaged,
  type TestLaunch,
} from "./helpers.js";

let testLaunch: TestLaunch | null = null;

test.afterEach(async () => {
  if (testLaunch !== null) {
    await killAndRemove(testLaunch);
    testLaunch = null;
  }
});

test("previews, commits, undoes, and exports physical-scale vector geometry", async () => {
  const directory = await mkdtemp(join(tmpdir(), "laserx-vector-e2e-"));
  const importPath = join(directory, "600-mm.svg");
  const exportPath = join(directory, "round-trip.dxf");
  await writeFile(
    importPath,
    `<svg width="600mm" height="300mm" viewBox="0 0 600 300"><g data-layer="Cut"><polygon points="0,0 600,0 600,300 0,300"/></g></svg>`,
    "utf8",
  );
  testLaunch = await launchPackaged(directory, "discard", {
    importPath,
    exportPath,
  });
  const page = await testLaunch.electronApp.firstWindow();

  await page.getByTestId("preview-vector-import").click();
  await expect(page.getByTestId("import-preview-summary")).toContainText("600-mm.svg: 1 path(s)");
  await expect(page.getByTestId("import-preview-summary")).toContainText("600.000 × 300.000 mm");
  await expect(page.getByTestId("import-preview-overlay")).toBeVisible();
  await expect(page.locator('[data-import-object="incoming"]')).toHaveCount(1);
  const viewportBounds = await page.getByTestId("viewport").boundingBox();
  const stockBounds = await page.getByTestId("stock-region").boundingBox();
  expect(viewportBounds).not.toBeNull();
  expect(stockBounds).not.toBeNull();
  if (viewportBounds !== null && stockBounds !== null) {
    expect(stockBounds.x).toBeGreaterThanOrEqual(viewportBounds.x);
    expect(stockBounds.y).toBeGreaterThanOrEqual(viewportBounds.y);
    expect(stockBounds.x + stockBounds.width).toBeLessThanOrEqual(viewportBounds.x + viewportBounds.width);
    expect(stockBounds.y + stockBounds.height).toBeLessThanOrEqual(viewportBounds.y + viewportBounds.height);
  }
  await expect(page.getByTestId("dirty-indicator")).toHaveCount(0);
  if (process.env.LASERX_CAPTURE_SCREENSHOT === "1") {
    await page.locator(".app-shell").screenshot({
      path: resolve(process.cwd(), "../../docs/screenshots/m06-svg-dxf.png"),
    });
  }

  await page.getByTestId("commit-vector-import").click();
  await expect(page.getByTestId("import-preview-summary")).toHaveCount(0);
  await expect(page.getByTestId("selection-count")).toContainText("1 object selected");
  await expect(page.getByTestId("dirty-indicator")).toBeVisible();

  await page.getByTestId("export-dxf").click();
  await expect(page.getByTestId("export-summary")).toContainText("Exported 1 path(s) as DXF in millimeters");
  await expect.poll(async () => readFile(exportPath, "utf8")).toContain("$INSUNITS\n70\n4\n");

  await page.getByTestId("preview-vector-import").click();
  await expect(page.locator('[data-import-object="existing"]')).toHaveCount(1);
  await expect(page.locator('[data-import-object="incoming"]')).toHaveCount(1);
  await page.getByTestId("cancel-vector-import").click();

  await page.getByTestId("undo").click();
  await expect(page.getByTestId("selection-count")).toContainText("No objects selected");
});

test("packaged DXF preview converts splines, locates repairs, and applies an explicit stock fit", async () => {
  const directory = await mkdtemp(join(tmpdir(), "laserx-m13-vector-e2e-"));
  const importPath = join(directory, "repair-spline.dxf");
  await writeFile(importPath,
    "0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n" +
    "0\nSECTION\n2\nENTITIES\n" +
    "0\nSPLINE\n8\nSpline\n70\n4\n71\n2\n72\n6\n73\n3\n" +
    "40\n0\n40\n0\n40\n0\n40\n1\n40\n1\n40\n1\n" +
    "41\n1\n41\n1\n41\n1\n10\n0\n20\n0\n10\n200\n20\n300\n10\n400\n20\n0\n" +
    "0\nLWPOLYLINE\n8\nRepair\n90\n4\n70\n0\n" +
    "10\n0\n20\n0\n10\n400\n20\n0\n10\n400\n20\n200\n10\n0.05\n20\n0.04\n" +
    "0\nHATCH\n8\nUnsupported\n" +
    "0\nSPLINE\n8\nNonplanar\n70\n0\n71\n2\n72\n6\n73\n3\n" +
    "40\n0\n40\n0\n40\n0\n40\n1\n40\n1\n40\n1\n" +
    "10\n0\n20\n0\n30\n0\n10\n20\n20\n30\n30\n5\n10\n40\n20\n0\n30\n0\n" +
    "0\nENDSEC\n0\nEOF\n",
    "utf8",
  );
  testLaunch = await launchPackaged(directory, "discard", { importPath });
  const page = await testLaunch.electronApp.firstWindow();

  await page.getByTestId("preview-vector-import").click();
  await expect(page.getByTestId("import-findings")).toContainText("SPLINE");
  await expect(page.getByTestId("import-findings")).toContainText("Closed an endpoint gap");
  await expect(page.getByTestId("import-warnings")).toHaveCount(0);
  await expect(page.getByText(/HATCH \d+ is not supported and was skipped/u)).toHaveCount(1);
  await expect(page.getByTestId("import-findings")).toContainText("Z=0 in CAD, then reimport");
  await expect(page.getByTestId("import-partial-warning")).toContainText("2 source entities were skipped");
  await expect(page.getByTestId("commit-vector-import")).toHaveText("Accept partial import");
  await expect(page.getByTestId("cancel-vector-import")).toHaveText("Cancel import");
  await page.getByRole("button", { name: "Locate path" }).first().click();
  await expect.poll(async () =>
    (await page.evaluate(() => window.laserx.getState())).editor.importPreview?.focusedObjectId,
  ).not.toBeNull();

  await page.getByLabel("Import stock fitting choice").selectOption("scale-artwork");
  await expect(page.getByTestId("import-fit-result")).toContainText("artwork scale");
  await page.getByTestId("zoom-in").click();
  const userZoom = await page.getByTestId("zoom-readout").textContent();
  await page.waitForTimeout(150);
  await expect(page.getByTestId("zoom-readout")).toHaveText(userZoom ?? "");
  await page.getByTestId("commit-vector-import").click();
  await expect(page.getByTestId("selection-count")).toContainText("2 objects selected");
  await page.getByTestId("undo").click();
  await expect(page.getByTestId("selection-count")).toContainText("No objects selected");
});
