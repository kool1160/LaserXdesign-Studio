import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

import { killAndRemove, launchPackaged } from "./helpers.js";

test("packaged app launches with an isolated renderer", async () => {
  const launched = await launchPackaged();
  try {
    const page = await launched.electronApp.firstWindow();
    await expect(page.getByTestId("blank-workspace")).toBeVisible();
    await expect(page.getByText("All changes saved")).toBeVisible();
    await expect(page).toHaveTitle(/LaserX Design Studio/);
    if (process.env.LASERX_CAPTURE_SCREENSHOT === "1") {
      await page.locator(".app-shell").screenshot({
        path: resolve(
          process.cwd(),
          "../../docs/screenshots/m01-desktop-shell.png",
        ),
      });
    }

    const rendererBoundary = await page.evaluate(() => ({
      hasNodeProcess: Reflect.has(globalThis, "process"),
      hasRequire: Reflect.has(globalThis, "require"),
      apiMethods: Object.keys(window.laserx).sort(),
    }));
    expect(rendererBoundary.hasNodeProcess).toBe(false);
    expect(rendererBoundary.hasRequire).toBe(false);
    expect(rendererBoundary.apiMethods).toEqual([
      "getState",
      "newProject",
      "onStateChanged",
      "openProject",
      "openRecent",
      "resolveRecovery",
      "saveProject",
      "saveProjectAs",
      "security",
      "setDisplayUnit",
    ]);
    expect(await page.evaluate(() => window.laserx.security)).toEqual({
      contextIsolated: true,
      sandboxed: true,
    });
  } finally {
    await killAndRemove(launched);
  }
});
