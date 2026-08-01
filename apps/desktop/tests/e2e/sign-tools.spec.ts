import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { expect, test } from "@playwright/test";

import {
  clickAndWaitForCommand,
  killAndRemove,
  launchPackaged,
  waitForProjectSchema,
} from "./helpers.js";

const cases = [
  {
    name: "24-inch badge",
    model: "badge",
    style: "western-badge",
    primary: "RANCH",
    secondary: "EST 2026",
    saveTemplate: false,
  },
  {
    name: "24-inch address",
    model: "address",
    style: "industrial-stencil",
    primary: "1042",
    secondary: "OAK STREET",
    saveTemplate: true,
  },
  {
    name: "24-inch layered family name",
    model: "family-name",
    style: "classic-slab",
    primary: "MARTINEZ",
    secondary: "FAMILY",
    saveTemplate: false,
  },
] as const;

for (const fixture of cases) {
  test(`${fixture.name} previews, accepts, validates, exports, and undoes`, async () => {
    const directory = await mkdtemp(join(tmpdir(), "laserx-sign-tools-e2e-"));
    const exportPath = join(directory, `${fixture.model}.svg`);
    const launched = await launchPackaged(directory, "discard", { exportPath });
    try {
      const page = await launched.electronApp.firstWindow();
      const before = await page.evaluate(async () =>
        JSON.stringify((await window.laserx.getState()).project.document.objects),
      );
      await page.getByLabel("Sign template model").selectOption(fixture.model);
      await page.getByLabel("Sign style preset").selectOption(fixture.style);
      await page.getByLabel("Sign primary text").fill(fixture.primary);
      await page.getByLabel("Sign secondary text").fill(fixture.secondary);
      await page.getByTestId("preview-sign-template").click();
      await expect(page.getByTestId("sign-tool-preview-summary")).toContainText(
        "template",
      );
      await expect(page.getByTestId("import-preview-overlay")).toBeVisible();
      expect(await page.evaluate(async () =>
        JSON.stringify((await window.laserx.getState()).project.document.objects),
      )).toBe(before);

      if (fixture.saveTemplate) {
        await page.getByLabel("Saved template name").fill("Reviewed address plate");
        await page.getByTestId("save-sign-template").click();
        await expect(page.getByTestId("saved-sign-templates")).toContainText(
          "Reviewed address plate",
        );
      }

      await page.getByTestId("accept-sign-tool").click();
      await expect.poll(async () =>
        (await page.evaluate(() => window.laserx.getState())).analysis.cutability?.status,
      ).toBe("complete");
      const accepted = await page.evaluate(async () => window.laserx.getState());
      expect(accepted.project.document.objects.length).toBeGreaterThanOrEqual(5);
      expect(accepted.project.document.layers.map((layer) => layer.name)).toEqual(
        expect.arrayContaining(["Sign Backing", "Sign Detail", "Mounting Holes"]),
      );
      expect(accepted.project.document.objects.every((object) =>
        ["line", "rectangle", "ellipse", "path", "text", "group"].includes(object.type),
      )).toBe(true);

      await page.getByTestId("export-svg").click();
      await expect(page.getByTestId("export-summary")).toContainText(
        "as SVG in millimeters",
      );
      await expect.poll(async () => {
        try {
          const exported = await readFile(exportPath, "utf8");
          return exported.startsWith('<?xml version="1.0"') && exported.includes("<svg ");
        } catch {
          return false;
        }
      }).toBe(true);

      await clickAndWaitForCommand(page, "Save");
      await waitForProjectSchema(launched.projectPath, 7);
      const saved = JSON.parse(await readFile(launched.projectPath, "utf8")) as {
        document: { templates: unknown[] };
      };
      expect(saved.document.templates).toHaveLength(fixture.saveTemplate ? 1 : 0);

      await page.getByTestId("undo").click();
      await expect.poll(async () =>
        JSON.stringify((await page.evaluate(() => window.laserx.getState())).project.document.objects),
      ).toBe(before);

      if (fixture.saveTemplate) {
        await page.getByRole("button", { name: "Open", exact: true }).click();
        await expect(page.getByTestId("saved-sign-templates")).toContainText(
          "Reviewed address plate",
        );
        expect((await page.evaluate(async () => window.laserx.getState()))
          .project.document.objects.length).toBeGreaterThanOrEqual(5);
      }
    } finally {
      await killAndRemove(launched);
    }
  });
}
