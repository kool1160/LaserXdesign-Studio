import { expect, test, type Page } from "@playwright/test";

import { killAndRemove, launchPackaged, type TestLaunch } from "./helpers.js";

async function setContentSize(
  launched: TestLaunch,
  width: number,
  height: number,
): Promise<void> {
  await launched.electronApp.evaluate(
    ({ BrowserWindow }, size) => {
      BrowserWindow.getAllWindows()[0]?.setContentSize(size.width, size.height);
    },
    { width, height },
  );
  const page = await launched.electronApp.firstWindow();
  await expect
    .poll(() => page.evaluate(() => [window.innerWidth, window.innerHeight]))
    .toEqual([width, height]);
}

async function expectShellFits(page: Page): Promise<void> {
  const measurements = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>(".app-shell");
    const commandbar = document.querySelector<HTMLElement>(".commandbar");
    const viewport = document.querySelector<HTMLElement>("[data-testid='viewport']");
    if (shell === null || commandbar === null || viewport === null) {
      throw new Error("Expected shell regions were not rendered.");
    }
    return {
      commandbarClientWidth: commandbar.clientWidth,
      commandbarScrollWidth: commandbar.scrollWidth,
      shellClientWidth: shell.clientWidth,
      shellScrollWidth: shell.scrollWidth,
      viewportHeight: viewport.clientHeight,
      viewportWidth: viewport.clientWidth,
    };
  });

  expect(measurements.shellScrollWidth).toBeLessThanOrEqual(
    measurements.shellClientWidth,
  );
  expect(measurements.commandbarScrollWidth).toBeLessThanOrEqual(
    measurements.commandbarClientWidth,
  );
  expect(measurements.viewportWidth).toBeGreaterThan(500);
  expect(measurements.viewportHeight).toBeGreaterThan(440);
}

test("packaged M11 shell is discoverable and stable at common display sizes", async () => {
  const launched = await launchPackaged();
  try {
    const page = await launched.electronApp.firstWindow();
    await expect(page.getByTestId("viewport")).toBeVisible();
    await expect(page.locator(".brand-mark")).toBeVisible();
    await expect(page.getByTestId("workflow-navigation")).toBeVisible();
    await expect(page.getByTestId("workspace-welcome")).toBeVisible();
    await expect(page.getByRole("button", { name: "Open Project .laserx" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Import Artwork SVG / DXF" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Trace Image PNG / JPEG" })).toBeVisible();
    await expect(page.getByRole("button", { name: "New Design" })).toBeVisible();
    await expect(page.getByTestId("export-svg")).toBeVisible();

    const skipLink = page.getByRole("link", { name: "Skip to design workspace" });
    await skipLink.focus();
    await expect(skipLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#design-workspace")).toBeFocused();
    await page.locator(".topbar").click({ position: { x: 400, y: 20 } });
    await expect(page.locator("#design-workspace")).not.toBeFocused();

    await setContentSize(launched, 1366, 768);
    await expectShellFits(page);
    const compactViewport = await page.getByTestId("viewport").boundingBox();
    if (compactViewport === null) throw new Error("Viewport has no bounds.");
    await page.mouse.move(compactViewport.x + 40, compactViewport.y + 40);
    await expect(page).toHaveScreenshot("m11-empty-1366x768.png", {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.01,
    });

    await setContentSize(launched, 1920, 1080);
    await expectShellFits(page);
    const largeViewport = await page.getByTestId("viewport").boundingBox();
    if (largeViewport === null) throw new Error("Viewport has no bounds.");
    await page.mouse.move(largeViewport.x + 40, largeViewport.y + 40);
    await expect(page).toHaveScreenshot("m11-empty-1920x1080.png", {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.01,
    });

    await setContentSize(launched, 1366, 768);
    await page
      .getByTestId("workflow-navigation")
      .getByRole("button", { name: "Create", exact: true })
      .click();
    await expect(page.getByTestId("add-rectangle")).toBeVisible();
    await page.getByTestId("add-rectangle").click();
    await expect(page.getByTestId("workspace-welcome")).toBeHidden();
    await expect(page.getByTestId("selection-count")).toHaveText(
      "1 object selected",
    );
    const editingViewport = await page.getByTestId("viewport").boundingBox();
    if (editingViewport === null) throw new Error("Viewport has no bounds.");
    await page.mouse.move(editingViewport.x + 40, editingViewport.y + 40);
    await expect(page).toHaveScreenshot("m11-editing-1366x768.png", {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.01,
    });
  } finally {
    await killAndRemove(launched);
  }
});

test("packaged M11 shell remains usable at 150 percent scaling", async () => {
  const launched = await launchPackaged(undefined, "cancel", {
    deviceScaleFactor: "1.5",
  });
  try {
    const page = await launched.electronApp.firstWindow();
    await expect(page.getByTestId("viewport")).toBeVisible();
    await setContentSize(launched, 1366, 768);
    await expectShellFits(page);
    await expect(page.getByTestId("dpi-readout")).toContainText("DPR 1.50");
    await expect(page.getByRole("button", { name: "Import Artwork SVG / DXF" })).toBeVisible();
    await expect(page.getByTestId("workflow-navigation").getByRole("button", { name: "Analyze", exact: true })).toBeVisible();
    await expect(page.locator(".editing-index").getByRole("button", { name: "Layers", exact: true })).toBeVisible();
  } finally {
    await killAndRemove(launched);
  }
});
