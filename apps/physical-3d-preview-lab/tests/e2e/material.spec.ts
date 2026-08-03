import { expect, test, type Page } from "@playwright/test";

declare global {
  var __materialLoseContext: WEBGL_lose_context | undefined;
}

/** Layer IDs from the generated material fixtures. */
const SWATCH_WOOD_LAYER = "c1000001-0000-4000-8000-000000000000";
const SWATCH_ACRYLIC_LAYER = "c2000001-0000-4000-8000-000000000000";
const MIXED_FACE_LAYER = "c3000004-0000-4000-8000-000000000000";
const MIXED_BACKING_LAYER = "c3000001-0000-4000-8000-000000000000";

async function openPreview(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.locator('[data-testid="preview-canvas"] canvas').waitFor({ state: "visible" });
  // Give React Three Fiber time to create its renderer and paint a frame.
  await page.waitForTimeout(400);
}

/** Reads renderer-reported GPU resource counts via the research bench hook. */
async function rendererInfo(page: Page) {
  return page.evaluate(() => window.__laserxPreviewLab?.rendererInfo() ?? null);
}

test.describe("material-aware presentation", () => {
  test("presents each wood catalog material with its own label", async ({ page }) => {
    for (const [id, label] of [
      ["wood-mdf", "MDF"],
      ["wood-baltic-birch-plywood", "Baltic birch plywood"],
      ["wood-hardwood-plywood", "Hardwood plywood"],
      ["wood-hardboard", "Hardboard / Masonite"],
    ] as const) {
      await openPreview(page, `/?fixture=material-swatch-wood&material=${id}`);
      await expect(page.getByTestId(`layer-material-${SWATCH_WOOD_LAYER}`)).toHaveText(label);
      // A resolved catalog material must never be flagged as a fallback.
      await expect(page.getByTestId("material-findings-banner")).toHaveCount(0);
    }
  });

  test("presents each acrylic catalog material with its own label", async ({ page }) => {
    for (const [id, label] of [
      ["acrylic-cast-clear", "Cast clear acrylic"],
      ["acrylic-cast-opaque", "Cast opaque acrylic"],
      ["acrylic-cast-translucent", "Cast translucent acrylic"],
      ["acrylic-extruded-clear", "Extruded clear acrylic"],
      ["acrylic-mirrored", "Mirrored acrylic"],
      ["acrylic-frosted", "Frosted acrylic"],
    ] as const) {
      await openPreview(page, `/?fixture=material-swatch-acrylic&material=${id}`);
      await expect(page.getByTestId(`layer-material-${SWATCH_ACRYLIC_LAYER}`)).toHaveText(label);
      await expect(page.getByTestId("material-findings-banner")).toHaveCount(0);
    }
  });

  test("renders a mixed-material stack with per-layer materials and exact thicknesses", async ({
    page,
  }) => {
    await openPreview(page, "/?fixture=material-mixed-assembly");

    const layerList = page.getByTestId("layer-list");
    await expect(layerList).toContainText("Mirrored acrylic");
    await expect(layerList).toContainText("Cast clear acrylic");
    await expect(layerList).toContainText("Cast translucent acrylic");
    await expect(layerList).toContainText("MDF");

    // Exact per-layer thickness and total assembled depth are unchanged by
    // material presentation.
    await expect(layerList).toContainText("3.0 mm");
    await expect(layerList).toContainText("6.0 mm");
    await expect(layerList).toContainText("4.0 mm");
    await expect(layerList).toContainText("12.0 mm");
    await expect(page.getByTestId("dimensions")).toHaveText(
      /25\.0 mm total assembled depth/,
    );
    await expect(page.getByTestId("material-findings-banner")).toHaveCount(0);
  });

  test("falls back visibly and reports a finding for an unknown material ID", async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error);
    });

    await openPreview(
      page,
      "/?fixture=material-swatch-wood&material=definitely-not-a-material",
    );

    const banner = page.getByTestId("material-findings-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("definitely-not-a-material");
    await expect(banner).toContainText("neutral placeholder");

    // The layer stays listed and identifiable, and is marked as a fallback.
    const material = page.getByTestId(`layer-material-${SWATCH_WOOD_LAYER}`);
    await expect(material).toContainText("Unknown material");
    await expect(page.getByTestId(`layer-${SWATCH_WOOD_LAYER}`)).toContainText("(fallback)");

    // Thickness and geometry are unaffected by the unresolved material.
    await expect(page.getByTestId("dimensions")).toHaveText(/6\.0 mm total assembled depth/);
    // Unknown material must degrade, never crash.
    expect(pageErrors).toHaveLength(0);
  });

  test("keeps assembled/exploded, visibility, and views working with materials applied", async ({
    page,
  }) => {
    await openPreview(page, "/?fixture=material-mixed-assembly");

    // Assembled/exploded still toggles and does not alter reported depth.
    await page.getByTestId("mode-exploded").click();
    await expect(page.getByTestId("mode-exploded")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("dimensions")).toHaveText(/25\.0 mm total assembled depth/);
    await page.getByTestId("mode-assembled").click();

    // Per-layer visibility still works and keeps the hidden layer listed.
    const faceCheckbox = page.getByTestId(`layer-visibility-${MIXED_FACE_LAYER}`);
    await faceCheckbox.uncheck();
    await expect(faceCheckbox).not.toBeChecked();
    await expect(page.getByTestId("layer-list")).toContainText("Mirrored acrylic");
    await faceCheckbox.check();

    // All four view presets remain operable.
    for (const name of ["Front", "Back", "Edge", "Perspective"] as const) {
      await page.getByRole("button", { name, exact: true }).click();
      await expect(page.getByRole("button", { name, exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    }
  });

  test("material controls remain keyboard operable", async ({ page }) => {
    await openPreview(page, "/?fixture=material-mixed-assembly");
    const checkbox = page.getByTestId(`layer-visibility-${MIXED_BACKING_LAYER}`);
    await checkbox.focus();
    await expect(checkbox).toBeFocused();
    await page.keyboard.press("Space");
    await expect(checkbox).not.toBeChecked();
    await page.keyboard.press("Space");
    await expect(checkbox).toBeChecked();
  });

  test("captures a PNG of a transmissive mixed-material stack", async ({ page }) => {
    await openPreview(page, "/?fixture=material-mixed-assembly");
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("capture-png").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain("material-mixed-assembly");
    await download.delete();
  });

  test("does not leak GPU resources across repeated material switches", async ({ page }) => {
    await openPreview(page, "/?fixture=material-swatch-acrylic&material=acrylic-cast-clear");
    const before = await rendererInfo(page);
    expect(before).not.toBeNull();

    // Cycle through every catalog material, including the transmissive and
    // mirrored ones that allocate the most renderer state.
    for (const id of [
      "acrylic-cast-clear",
      "acrylic-cast-translucent",
      "acrylic-frosted",
      "acrylic-mirrored",
      "acrylic-cast-opaque",
      "acrylic-extruded-clear",
    ]) {
      await openPreview(page, `/?fixture=material-swatch-acrylic&material=${id}`);
    }

    const after = await rendererInfo(page);
    expect(after).not.toBeNull();
    // Each navigation rebuilds the page, so counts must return to the same
    // steady state rather than climbing.
    expect(after?.geometries).toBe(before?.geometries);
    expect(after?.textures).toBe(before?.textures);
  });

  test("survives real WebGL context loss while showing a transmissive material", async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error);
    });

    await openPreview(page, "/?fixture=material-mixed-assembly");

    const supported = await page.evaluate(() => {
      const renderer = window.__laserxPreviewLab?.renderer ?? null;
      if (renderer === null) return false;
      const extension = renderer.getContext().getExtension("WEBGL_lose_context");
      if (extension === null) return false;
      globalThis.__materialLoseContext = extension;
      extension.loseContext();
      return true;
    });

    if (supported) {
      await expect(page.getByTestId("context-lost")).toBeVisible();
      // Material readouts must survive a lost context.
      await expect(page.getByTestId("layer-list")).toContainText("Mirrored acrylic");
      await page.evaluate(() => {
        globalThis.__materialLoseContext?.restoreContext();
      });
      await expect(page.getByTestId("context-lost")).toHaveCount(0);
    }

    expect(pageErrors).toHaveLength(0);
  });
});
