import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { expect, test } from "@playwright/test";

import {
  clickAndWaitForCommand,
  kill,
  killAndRemove,
  launchPackaged,
  waitForProjectSchema,
} from "./helpers.js";

test("blank project saves, reopens, and protects dirty close", async () => {
  const launched = await launchPackaged();
  try {
    const page = await launched.electronApp.firstWindow();
    const originalId = await page.evaluate(
      async () => (await window.laserx.getState()).project.id,
    );

    await page.getByRole("button", { name: "Create document" }).click();
    await expect(page.getByTestId("document-dimensions")).toHaveText(
      "24 × 12 in",
    );
    await expect(page.getByTestId("dirty-indicator")).toBeVisible();
    await clickAndWaitForCommand(page, "Save as");
    await waitForProjectSchema(launched.projectPath, 6);
    await expect(page.getByTestId("dirty-indicator")).toBeHidden();

    const saved = JSON.parse(
      await readFile(launched.projectPath, "utf8"),
    ) as {
      schemaVersion: number;
      project: { id: string };
      document: {
        id: string;
        dimensions: { widthMm: number; heightMm: number };
        settings: { displayUnit: string };
      };
    };
    expect(saved.schemaVersion).toBe(6);
    expect(saved.project.id).toBe(originalId);
    expect(saved.document.id).not.toBe(originalId);
    expect(saved.document.dimensions).toEqual({
      widthMm: 609.6,
      heightMm: 304.8,
    });
    expect(saved.document.settings.displayUnit).toBe("inches");

    await page.getByRole("button", { name: "mm", exact: true }).click();
    await launched.electronApp.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.close();
    });
    await page.waitForTimeout(200);
    expect(launched.electronApp.windows()).toHaveLength(1);
    await expect(page.getByTestId("dirty-indicator")).toBeVisible();
  } finally {
    await kill(launched);
  }

  const reopened = await launchPackaged(launched.directory);
  try {
    const page = await reopened.electronApp.firstWindow();
    await page.locator(".recent-section button").first().click();
    await expect(
      page.getByRole("button", { name: "in", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    const reopenedId = await page.evaluate(
      async () => (await window.laserx.getState()).project.id,
    );
    const saved = JSON.parse(
      await readFile(reopened.projectPath, "utf8"),
    ) as { project: { id: string } };
    expect(reopenedId).toBe(saved.project.id);
  } finally {
    await killAndRemove(reopened);
  }
});

test("interrupted session offers recovery without changing the original", async () => {
  const launched = await launchPackaged();
  const directory = launched.directory;
  try {
    const page = await launched.electronApp.firstWindow();
    await page.getByRole("button", { name: "Save as" }).click();
    await page.getByRole("button", { name: "in", exact: true }).click();

    const recoveryPath = join(
      launched.userDataPath,
      "recovery",
      "active.laserx.autosave",
    );
    await expect
      .poll(async () => {
        try {
          return (await readFile(recoveryPath, "utf8")).length;
        } catch {
          return 0;
        }
      })
      .toBeGreaterThan(0);
    await kill(launched);
  } catch (error) {
    await kill(launched);
    throw error;
  }

  const recovered = await launchPackaged(directory);
  try {
    const page = await recovered.electronApp.firstWindow();
    await expect(page.getByTestId("recovery-banner")).toBeVisible();
    if (process.env.LASERX_CAPTURE_SCREENSHOT === "1") {
      await page.locator(".app-shell").screenshot({
        path: resolve(
          process.cwd(),
          "../../docs/screenshots/m01-recovery-offer.png",
        ),
      });
    }
    await page.getByRole("button", { name: "Recover", exact: true }).click();
    await expect(page.getByTestId("recovery-banner")).toBeHidden();
    await expect(page.getByTestId("dirty-indicator")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "in", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");

    const original = JSON.parse(
      await readFile(recovered.projectPath, "utf8"),
    ) as { document: { settings: { displayUnit: string } } };
    expect(original.document.settings.displayUnit).toBe("millimeters");
  } finally {
    await killAndRemove(recovered);
  }
});
