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

  await page.getByTestId("undo").click();
  await expect(page.getByTestId("selection-count")).toContainText("No objects selected");
});
