import { expect, test } from "@playwright/test";

import { killAndRemove, launchPackaged } from "./helpers.js";

test("physical preview opens, supports mouse and keyboard interaction and layer visibility, and cleans up across repeated open/close without leaking a WebGL context", async () => {
  const launched = await launchPackaged();
  try {
    const page = await launched.electronApp.firstWindow();
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    const beforeDocument = await page.evaluate(async () => {
      const state = await window.laserx.getState();
      const faceId = state.project.document.activeLayerId;
      await window.laserx.editorAction({ type: "object.create", objectType: "rectangle" });
      await window.laserx.editorAction({
        type: "layer.set-manufacturing",
        layerId: faceId,
        manufacturing: {
          role: "face",
          material: "mild-steel",
          thicknessMm: 3,
          process: "laser",
          notes: "",
          registrationGroup: null,
          registrationHoleIds: [],
        },
      });
      return JSON.stringify((await window.laserx.getState()).project.document);
    });

    await page.getByTestId("open-physical-preview").click();
    // Deliberately does not assert the transient progress indicator: it is
    // only present while a build is in flight, so a fast build legitimately
    // never shows it. Asserting it made a *faster* success fail, which is
    // why this spec was intermittent on CI. The meaningful guarantee is the
    // end state -- the canvas renders -- so that is what is asserted.
    await expect(page.getByTestId("physical-preview-canvas")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("physical-preview-view-perspective")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Mouse interaction: view presets and assembled/exploded mode.
    await page.getByTestId("physical-preview-view-front").click();
    await expect(page.getByTestId("physical-preview-view-front")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByTestId("physical-preview-mode-exploded").click();
    await expect(page.getByTestId("physical-preview-mode-exploded")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Real mouse drag over the canvas exercises OrbitControls' pointer
    // handling end to end -- not just that the control exists.
    const canvasBox = await page.getByTestId("physical-preview-canvas").boundingBox();
    if (canvasBox === null) throw new Error("Expected the preview canvas to have a layout box.");
    await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + canvasBox.width / 2 + 40, canvasBox.y + canvasBox.height / 2 - 20);
    await page.mouse.up();

    // Keyboard interaction: reset, a different view, and mode toggle.
    await page.getByTestId("physical-preview-screen").focus();
    await page.keyboard.press("2");
    await expect(page.getByTestId("physical-preview-view-back")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.keyboard.press("0");
    await expect(page.getByTestId("physical-preview-view-perspective")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.keyboard.press("m");
    await expect(page.getByTestId("physical-preview-mode-assembled")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Per-layer visibility: presentation-only, never touches the document.
    const layerCheckbox = page.getByTestId("physical-preview-layer-list").locator('input[type="checkbox"]').first();
    await expect(layerCheckbox).toBeChecked();
    await layerCheckbox.click();
    await expect(layerCheckbox).not.toBeChecked();
    await layerCheckbox.click();
    await expect(layerCheckbox).toBeChecked();

    await page.getByTestId("physical-preview-close").click();
    await expect(page.getByTestId("physical-preview-screen")).toHaveCount(0);

    // Repeated open/close: each real Canvas mount/unmount creates and
    // disposes a real WebGL context, OrbitControls, geometry, and material.
    // A leak here would eventually throw "too many active WebGL contexts"
    // in a real browser -- unlike jsdom, which has no WebGL implementation
    // at all and cannot exercise this.
    for (let cycle = 0; cycle < 6; cycle += 1) {
      await page.getByTestId("open-physical-preview").click();
      await expect(page.getByTestId("physical-preview-canvas")).toBeVisible({ timeout: 15_000 });
      await page.getByTestId("physical-preview-close").click();
      await expect(page.getByTestId("physical-preview-screen")).toHaveCount(0);
    }

    const afterDocument = await page.evaluate(async () =>
      JSON.stringify((await window.laserx.getState()).project.document),
    );
    expect(afterDocument).toBe(beforeDocument);

    const relevantErrors = consoleErrors.filter((text) =>
      /webgl|three\.js|context|geometry|material/iu.test(text),
    );
    expect(relevantErrors).toEqual([]);
  } finally {
    await killAndRemove(launched);
  }
});
