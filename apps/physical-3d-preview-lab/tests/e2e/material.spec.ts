import { expect, test, type Page } from "@playwright/test";

declare global {
  var __materialLoseContext: WEBGL_lose_context | undefined;
  /** Live WebGL object counts installed by {@link instrumentGlObjects}. */
  var __glLive: { framebuffers: number; renderbuffers: number } | undefined;
}

/** Layer IDs from the generated material fixtures. */
const SWATCH_WOOD_LAYER = "c1000001-0000-4000-8000-000000000000";
const SWATCH_ACRYLIC_LAYER = "c2000001-0000-4000-8000-000000000000";
const MIXED_FACE_LAYER = "c3000004-0000-4000-8000-000000000000";
const MIXED_SPACER_LAYER = "c3000003-0000-4000-8000-000000000000";
const MIXED_DIFFUSER_LAYER = "c3000002-0000-4000-8000-000000000000";
const MIXED_BACKING_LAYER = "c3000001-0000-4000-8000-000000000000";

/**
 * The three mixed-assembly layers whose materials need an environment map
 * (mirrored, clear, translucent). The MDF backing does not, so hiding these
 * three unmounts `PreviewEnvironment` without touching the renderer.
 */
const ENVIRONMENT_LAYERS = [MIXED_FACE_LAYER, MIXED_SPACER_LAYER, MIXED_DIFFUSER_LAYER];

/** Layer IDs from the pre-existing, pre-catalog two-layer fixture. */
const TWO_LAYER_FACE = "10000000-0000-4000-8000-000000000011";
const TWO_LAYER_BACKING = "10000000-0000-4000-8000-000000000012";

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

/**
 * Counts live WebGL framebuffers and renderbuffers by wrapping the context's
 * create/delete methods before any context exists.
 *
 * `renderer.info.memory.textures` is deliberately *not* used as the leak
 * signal here: disposing only a render target's texture decrements that
 * counter while leaving the target's framebuffer and renderbuffer allocated,
 * so the counter cannot distinguish a correct `target.dispose()` from the
 * texture-only disposal this test exists to catch. Framebuffer identity can.
 */
async function instrumentGlObjects(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const live = { framebuffers: 0, renderbuffers: 0 };
    window.__glLive = live;
    const kinds = [
      ["framebuffers", "createFramebuffer", "deleteFramebuffer"],
      ["renderbuffers", "createRenderbuffer", "deleteRenderbuffer"],
    ] as const;
    for (const Ctx of [WebGLRenderingContext, WebGL2RenderingContext]) {
      for (const [kind, create, remove] of kinds) {
        const proto = Ctx.prototype as unknown as Record<string, unknown>;
        const origCreate = proto[create] as (this: unknown) => unknown;
        const origDelete = proto[remove] as (this: unknown, target: unknown) => unknown;
        proto[create] = function (this: unknown) {
          const created: unknown = origCreate.call(this);
          if (created !== null) live[kind] += 1;
          return created;
        };
        proto[remove] = function (this: unknown, target: unknown) {
          if (target !== null && target !== undefined) live[kind] -= 1;
          return origDelete.call(this, target);
        };
      }
    }
  });
}

async function liveGlObjects(page: Page) {
  return page.evaluate(() => (window.__glLive ? { ...window.__glLive } : null));
}

/** Stamps and reads a stable id on the live renderer to prove it is the same one. */
async function rendererIdentity(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const renderer = window.__laserxPreviewLab?.renderer ?? null;
    if (renderer === null) return null;
    const stamped = renderer as unknown as { __identity?: string };
    stamped.__identity ??= Math.random().toString(36).slice(2);
    return stamped.__identity;
  });
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
    // Measured at ~43s against the 45s default budget on the reviewed head,
    // before this repair — it drives seven transmissive re-renders. The margin
    // is too thin to be reliable, so give it headroom rather than let it flake.
    test.slow();
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

  test("keeps a non-catalog fixture on its own material with no fallback marker", async ({
    page,
  }) => {
    // `two-layer` predates the catalog and is assigned no catalog material ID.
    // Claiming no catalog material is not a resolution *failure*, so nothing
    // here may be marked as a fallback or reported as a finding.
    await openPreview(page, "/?fixture=two-layer");

    await expect(page.getByTestId(`layer-material-${TWO_LAYER_FACE}`)).toHaveText("mild-steel");
    await expect(page.getByTestId(`layer-material-${TWO_LAYER_BACKING}`)).toHaveText("acrylic");

    await expect(page.getByTestId(`layer-${TWO_LAYER_FACE}`)).not.toContainText("(fallback)");
    await expect(page.getByTestId(`layer-${TWO_LAYER_BACKING}`)).not.toContainText("(fallback)");
    await expect(page.getByTestId("layer-list").locator(".lab-material-fallback")).toHaveCount(0);
    await expect(page.getByTestId("material-findings-banner")).toHaveCount(0);

    // Thickness and depth are untouched by material presentation.
    await expect(page.getByTestId("dimensions")).toHaveText(/9\.0 mm total assembled depth/);
  });

  test("releases every environment render target across mount/unmount in one renderer", async ({
    page,
  }) => {
    // Regression for the PMREM lifecycle defect: `PMREMGenerator.fromScene`
    // returns a WebGLRenderTarget that owns a framebuffer and renderbuffer in
    // addition to its texture. Disposing only the texture leaked the rest —
    // invisible on a fresh page load, and only observable by mounting and
    // unmounting the environment inside ONE long-lived renderer. This test
    // therefore never navigates: `page.goto` would rebuild the renderer and
    // hide exactly the defect it is meant to catch.
    //
    // Repeated mount/unmount cycles are the whole point, so this test is
    // legitimately long-running rather than slow by accident.
    test.slow();
    await instrumentGlObjects(page);
    await openPreview(page, "/?fixture=material-mixed-assembly");

    const rendererAtStart = await rendererIdentity(page);
    expect(rendererAtStart).not.toBeNull();

    const baseline = await liveGlObjects(page);
    expect(baseline).not.toBeNull();

    for (let cycle = 0; cycle < 5; cycle += 1) {
      // Hiding every environment-requiring material unmounts PreviewEnvironment.
      for (const layerId of ENVIRONMENT_LAYERS) {
        await page.getByTestId(`layer-visibility-${layerId}`).uncheck();
      }
      await page.waitForTimeout(250);

      const unmounted = await liveGlObjects(page);
      // The environment's own framebuffer/renderbuffer must actually be freed.
      expect(unmounted?.framebuffers).toBeLessThan(baseline?.framebuffers ?? 0);

      for (const layerId of ENVIRONMENT_LAYERS) {
        await page.getByTestId(`layer-visibility-${layerId}`).check();
      }
      await page.waitForTimeout(250);

      // Exact return to baseline, every cycle — not merely "bounded growth".
      const remounted = await liveGlObjects(page);
      expect(remounted).toEqual(baseline);
    }

    // Renderer-reported resources are bounded too, and it really was one renderer.
    const info = await rendererInfo(page);
    expect(info?.geometries).toBe(4);
    expect(info?.textures).toBe(3);
    expect(await rendererIdentity(page)).toBe(rendererAtStart);
  });

  test("does not leak GPU resources across repeated full page reloads", async ({ page }) => {
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
    // Each navigation rebuilds the page and the renderer, so this proves
    // fresh-page steady state only — component mount/unmount lifecycle is
    // covered by the same-renderer environment test above.
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
