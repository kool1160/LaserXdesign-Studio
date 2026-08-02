import { performance } from "node:perf_hooks";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import {
  clickAndWaitForCommand,
  killAndRemove,
  launchInstalledBeta,
  waitForProjectSchema,
} from "./helpers.js";

const installedExecutablePath = process.env.LASERX_INSTALLED_EXECUTABLE_PATH;

test("installed beta launches, remains accessible at high DPI, and completes the primary vector workflow", async () => {
  test.skip(
    installedExecutablePath === undefined,
    "Runs only against the clean-installed M13 executable.",
  );
  if (installedExecutablePath === undefined) return;

  const directory = await mkdtemp(join(tmpdir(), "laserx-installed-beta-"));
  const importPath = join(directory, "representative-sign.svg");
  const exportPath = join(directory, "representative-sign.dxf");
  await writeFile(
    importPath,
    '<svg width="600mm" height="300mm" viewBox="0 0 600 300"><g data-layer="Face"><polygon points="20,20 580,20 580,280 20,280"/></g></svg>',
    "utf8",
  );

  const startedAt = performance.now();
  const launched = await launchInstalledBeta(installedExecutablePath, directory, {
    deviceScaleFactor: "1.5",
    importPath,
    exportPath,
  });
  try {
    const page = await launched.electronApp.firstWindow();
    await expect(page.getByTestId("viewport")).toBeVisible();
    const startupMs = performance.now() - startedAt;
    expect(startupMs).toBeLessThan(15_000);
    expect(await page.evaluate(() => window.devicePixelRatio)).toBe(1.5);

    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to design workspace" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#design-workspace")).toBeFocused();

    await page.getByTestId("preview-vector-import").click();
    await expect(page.getByTestId("import-preview-summary")).toContainText(
      "600.000 × 300.000 mm",
    );
    await page.getByTestId("commit-vector-import").click();
    await page.getByTestId("run-cutability-analysis").click();
    await expect
      .poll(async () =>
        (await page.evaluate(() => window.laserx.getState())).analysis.cutability?.status,
      )
      .toBe("complete");

    await clickAndWaitForCommand(page, "Save as");
    await waitForProjectSchema(launched.projectPath, 9);
    await page.getByTestId("export-dxf").click();
    await expect(page.getByTestId("export-summary")).toContainText(
      "Exported 1 path(s) as DXF in millimeters",
    );
    expect(await readFile(exportPath, "utf8")).toContain("$INSUNITS\n70\n4\n");
  } finally {
    await killAndRemove(launched);
  }
});
