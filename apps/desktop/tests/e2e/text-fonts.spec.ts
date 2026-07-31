import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import {
  clickAndWaitForCommand,
  kill,
  killAndRemove,
  launchPackaged,
  waitForProjectSchema,
} from "./helpers.js";

test("packaged text stays editable, arcs, converts, undoes, and reopens", async () => {
  const launched = await launchPackaged();
  let savedContours: string;
  try {
    const page = await launched.electronApp.firstWindow();
    await expect(page.getByTestId("text-panel")).toBeVisible();
    await expect
      .poll(
        () => page.getByTestId("font-family").locator("option").count(),
        { timeout: 20_000 },
      )
      .toBeGreaterThanOrEqual(6);

    await page.getByTestId("text-content").fill("B LaserX");
    await page.getByTestId("create-text").click();
    await expect
      .poll(async () =>
        page.evaluate(
          async () =>
            (await window.laserx.getState()).project.document.objects.at(-1)
              ?.type,
        ),
      )
      .toBe("text");

    await page.getByLabel("Arc text").check();
    await page.getByTestId("arc-radius").fill("90");
    await page.getByTestId("text-content").fill("B Arc LaserX");
    await page.getByTestId("update-text").click();
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const object = (await window.laserx.getState()).project.document.objects.at(-1);
          return object?.type === "text"
            ? `${object.content}:${String(object.arc?.radiusMm)}`
            : object?.type;
        }),
      )
      .toBe("B Arc LaserX:90");

    savedContours = await page.evaluate(async () => {
      const object = (await window.laserx.getState()).project.document.objects.at(-1);
      return object?.type === "text" ? JSON.stringify(object.contours) : "";
    });
    expect(savedContours.length).toBeGreaterThan(100);

    await page.getByTestId("convert-text-outlines").click();
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const object = (await window.laserx.getState()).project.document.objects.at(-1);
          return object?.type === "group" && object.sourceText?.content;
        }),
      )
      .toBe("B Arc LaserX");
    await page.getByTestId("undo").click();
    await expect
      .poll(async () =>
        page.evaluate(
          async () =>
            (await window.laserx.getState()).project.document.objects.at(-1)
              ?.type,
        ),
      )
      .toBe("text");

    await clickAndWaitForCommand(page, "Save as");
    await waitForProjectSchema(launched.projectPath, 4);
    const disk = JSON.parse(await readFile(launched.projectPath, "utf8")) as {
      document: { objects: Array<{ type: string; content?: string }> };
    };
    expect(disk.document.objects.at(-1)).toMatchObject({
      type: "text",
      content: "B Arc LaserX",
    });
  } finally {
    await kill(launched);
  }

  const reopened = await launchPackaged(launched.directory);
  try {
    const page = await reopened.electronApp.firstWindow();
    await page.locator(".recent-section button").first().click();
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const object = (await window.laserx.getState()).project.document.objects.at(-1);
          return object?.type === "text" ? JSON.stringify(object.contours) : "";
        }),
      )
      .toBe(savedContours);
  } finally {
    await killAndRemove(reopened);
  }
});
