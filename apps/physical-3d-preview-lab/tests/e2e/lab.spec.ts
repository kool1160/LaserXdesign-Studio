import { expect, test } from "@playwright/test";
import { statSync } from "node:fs";

const FACE_LAYER_ID = "10000000-0000-4000-8000-000000000011";
const BACKING_LAYER_ID = "10000000-0000-4000-8000-000000000012";

test.describe("physical 3D preview lab", () => {
  test("launches, loads the fixture, and shows exact dimension and per-layer readouts", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByTestId("preview-canvas")).toBeVisible();
    const dimensions = page.getByTestId("dimensions");
    await expect(dimensions).toHaveText(/180\.0 mm/);
    await expect(dimensions).toHaveText(/100\.0 mm/);
    await expect(dimensions).toHaveText(/9\.0 mm total assembled depth/);

    const layerList = page.getByTestId("layer-list");
    await expect(layerList).toContainText("Face");
    await expect(layerList).toContainText("mild-steel");
    await expect(layerList).toContainText("3.0 mm");
    await expect(layerList).toContainText("Backing");
    await expect(layerList).toContainText("acrylic");
    await expect(layerList).toContainText("6.0 mm");

    await expect(page.getByTestId("findings-banner")).toHaveCount(0);
  });

  test("front, back, edge, perspective, and reset controls toggle the active view", async ({
    page,
  }) => {
    await page.goto("/");

    const front = page.getByRole("button", { name: "Front" });
    const back = page.getByRole("button", { name: "Back" });
    const edge = page.getByRole("button", { name: "Edge" });
    const perspective = page.getByRole("button", { name: "Perspective" });
    const reset = page.getByRole("button", { name: "Reset view" });

    await expect(perspective).toHaveAttribute("aria-pressed", "true");

    for (const button of [front, back, edge]) {
      await button.click();
      await expect(button).toHaveAttribute("aria-pressed", "true");
      for (const other of [front, back, edge, perspective]) {
        if (other !== button) {
          await expect(other).toHaveAttribute("aria-pressed", "false");
        }
      }
    }

    await reset.click();
    await expect(perspective).toHaveAttribute("aria-pressed", "true");
    await expect(edge).toHaveAttribute("aria-pressed", "false");
  });

  test("assembled and exploded mode toggle updates the mode indicator", async ({ page }) => {
    await page.goto("/");

    const assembled = page.getByTestId("mode-assembled");
    const exploded = page.getByTestId("mode-exploded");

    await expect(assembled).toHaveAttribute("aria-pressed", "true");
    await expect(exploded).toHaveAttribute("aria-pressed", "false");

    await exploded.click();
    await expect(exploded).toHaveAttribute("aria-pressed", "true");
    await expect(assembled).toHaveAttribute("aria-pressed", "false");

    // Mode changes only Z placement/presentation, never the reported
    // manufacturing dimensions or assembled depth.
    await expect(page.getByTestId("dimensions")).toHaveText(/9\.0 mm total assembled depth/);

    await assembled.click();
    await expect(assembled).toHaveAttribute("aria-pressed", "true");
  });

  test("shows an unmistakable warning and still lists an empty physical layer's identity in a partial assembly", async ({
    page,
  }) => {
    await page.goto("/?fixture=partial-assembly");

    await expect(page.getByTestId("preview-canvas")).toBeVisible();

    const banner = page.getByTestId("findings-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("1");

    // The empty layer's declared identity/material/thickness stay visible
    // for inspection even though it contributed no geometry.
    const layerList = page.getByTestId("layer-list");
    await expect(layerList).toContainText("Backing");
    await expect(layerList).toContainText("acrylic");
    await expect(layerList).toContainText("6.0 mm");
    await expect(layerList).toContainText("Face");

    // A partial assembly's stack number must read as declared/incomplete —
    // never as an exact, real, verified, or total assembled measurement.
    const dimensions = page.getByTestId("dimensions");
    const dimensionsText = (await dimensions.textContent()) ?? "";
    expect(dimensionsText).toMatch(/declared/i);
    expect(dimensionsText).toMatch(/incomplete/i);
    expect(dimensionsText).not.toMatch(/total assembled depth/i);
    expect(dimensionsText).not.toMatch(/exact/i);
    expect(dimensionsText).not.toMatch(/\breal\b/i);
    expect(dimensionsText).not.toMatch(/verified/i);
  });

  test("shows a clear, non-throwing fallback when WebGL is unavailable", async ({ page }) => {
    await page.addInitScript(() => {
      HTMLCanvasElement.prototype.getContext = () => null;
    });

    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error);
    });

    await page.goto("/");

    await expect(page.getByTestId("webgl-unavailable")).toBeVisible();
    await expect(page.getByTestId("dimensions")).toHaveText(/180\.0 mm/);
    await expect(page.getByTestId("layer-list")).toContainText("Backing");
    expect(pageErrors).toHaveLength(0);
  });

  test("per-layer visibility toggles hide/show a layer without mutating readouts of other layers", async ({
    page,
  }) => {
    await page.goto("/");

    const backingCheckbox = page.getByTestId(`layer-visibility-${BACKING_LAYER_ID}`);
    await expect(backingCheckbox).toBeChecked();

    await backingCheckbox.uncheck();
    await expect(backingCheckbox).not.toBeChecked();
    // Presentation-only: the layer list still names/labels the hidden
    // layer, and total assembled depth (declared from the full assembly,
    // not the visible subset) is unaffected by visibility.
    await expect(page.getByTestId("layer-list")).toContainText("Backing");
    await expect(page.getByTestId("dimensions")).toHaveText(/9\.0 mm total assembled depth/);
    // Only the visible layer's footprint drives the width/height readout.
    await expect(page.getByTestId("dimensions")).toHaveText(/160\.0 mm/);

    await backingCheckbox.check();
    await expect(page.getByTestId("dimensions")).toHaveText(/180\.0 mm/);
  });

  test("view, mode, and reset controls are keyboard-operable", async ({ page }) => {
    await page.goto("/");

    const front = page.getByRole("button", { name: "Front" });
    await front.focus();
    await expect(front).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(front).toHaveAttribute("aria-pressed", "true");

    const exploded = page.getByTestId("mode-exploded");
    await exploded.focus();
    await expect(exploded).toBeFocused();
    await page.keyboard.press("Space");
    await expect(exploded).toHaveAttribute("aria-pressed", "true");

    const reset = page.getByRole("button", { name: "Reset view" });
    await reset.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Perspective" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("layer visibility checkboxes are reachable and operable by keyboard", async ({ page }) => {
    await page.goto("/");

    const checkbox = page.getByTestId(`layer-visibility-${FACE_LAYER_ID}`);
    await checkbox.focus();
    await expect(checkbox).toBeFocused();
    await expect(checkbox).toBeChecked();
    await page.keyboard.press("Space");
    await expect(checkbox).not.toBeChecked();
    await page.keyboard.press("Space");
    await expect(checkbox).toBeChecked();
  });

  test("captures a PNG with a deterministic filename and reports success", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("preview-canvas")).toBeVisible();
    // The canvas DOM element exists as soon as R3F mounts, before its first
    // WebGL frame has actually rendered on the next animation frame(s) —
    // wait for that first frame so toDataURL() reads real pixels instead
    // of capturing (or erroring on) an unrendered buffer.
    await page.waitForTimeout(300);

    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error);
    });

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("capture-png").click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe(
      "laserx-preview-two-layer-face-and-backing-perspective-assembled.png",
    );
    const downloadedPath = await download.path();
    expect(statSync(downloadedPath).size).toBeGreaterThan(0);

    await expect(page.getByTestId("capture-status")).toContainText(
      "laserx-preview-two-layer-face-and-backing-perspective-assembled.png",
    );
    expect(pageErrors).toHaveLength(0);
  });

  test("recovers from a lost WebGL context without an uncaught error and keeps readouts visible", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByTestId("preview-canvas")).toBeVisible();
    // The context-loss listener attaches in an effect that runs after
    // Canvas's onCreated callback fires, one render behind mount/paint —
    // wait for it so the synthetic event below isn't dispatched into a
    // gap before the listener exists.
    await page.waitForTimeout(300);

    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error);
    });

    await page.locator('[data-testid="preview-canvas"] canvas').evaluate((canvasElement) => {
      canvasElement.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    });

    await expect(page.getByTestId("context-lost")).toBeVisible();
    // Readouts remain accurate and visible while the context is lost.
    await expect(page.getByTestId("dimensions")).toHaveText(/9\.0 mm total assembled depth/);
    await expect(page.getByTestId("layer-list")).toContainText("Backing");

    await page.locator('[data-testid="preview-canvas"] canvas').evaluate((canvasElement) => {
      canvasElement.dispatchEvent(new Event("webglcontextrestored"));
    });
    await expect(page.getByTestId("context-lost")).toHaveCount(0);

    expect(pageErrors).toHaveLength(0);
  });
});

test.describe("bounded device pixel ratio behavior", () => {
  test.describe("at device pixel ratio 1", () => {
    test.use({ deviceScaleFactor: 1 });

    test("renders the canvas backing store at 1x CSS size", async ({ page }) => {
      await page.goto("/");
      expect(await page.evaluate(() => window.devicePixelRatio)).toBe(1);

      const canvas = page.locator('[data-testid="preview-canvas"] canvas');
      await expect(canvas).toBeVisible();
      // R3F/Three resize the canvas backing store to its container over
      // the first render tick or two after mount; wait for it to settle
      // before reading pixel dimensions.
      await page.waitForTimeout(300);
      const box = await canvas.boundingBox();
      const backing = await canvas.evaluate((element) => {
        const canvasEl = element as HTMLCanvasElement;
        return { width: canvasEl.width, height: canvasEl.height };
      });
      if (box === null) throw new Error("Expected a canvas bounding box.");
      expect(Math.abs(backing.width - box.width * 1)).toBeLessThan(3);
    });
  });

  test.describe("at device pixel ratio 2", () => {
    test.use({ deviceScaleFactor: 2 });

    test("renders the canvas backing store at 2x CSS size", async ({ page }) => {
      await page.goto("/");
      expect(await page.evaluate(() => window.devicePixelRatio)).toBe(2);

      const canvas = page.locator('[data-testid="preview-canvas"] canvas');
      await expect(canvas).toBeVisible();
      // R3F/Three resize the canvas backing store to its container over
      // the first render tick or two after mount; wait for it to settle
      // before reading pixel dimensions.
      await page.waitForTimeout(300);
      const box = await canvas.boundingBox();
      const backing = await canvas.evaluate((element) => {
        const canvasEl = element as HTMLCanvasElement;
        return { width: canvasEl.width, height: canvasEl.height };
      });
      if (box === null) throw new Error("Expected a canvas bounding box.");
      expect(Math.abs(backing.width - box.width * 2)).toBeLessThan(3);
    });
  });

  test.describe("at device pixel ratio 3 (above the bound)", () => {
    test.use({ deviceScaleFactor: 3 });

    test("clamps the canvas backing store to 2x CSS size, not 3x", async ({ page }) => {
      await page.goto("/");
      expect(await page.evaluate(() => window.devicePixelRatio)).toBe(3);

      const canvas = page.locator('[data-testid="preview-canvas"] canvas');
      await expect(canvas).toBeVisible();
      // R3F/Three resize the canvas backing store to its container over
      // the first render tick or two after mount; wait for it to settle
      // before reading pixel dimensions.
      await page.waitForTimeout(300);
      const box = await canvas.boundingBox();
      const backing = await canvas.evaluate((element) => {
        const canvasEl = element as HTMLCanvasElement;
        return { width: canvasEl.width, height: canvasEl.height };
      });
      if (box === null) throw new Error("Expected a canvas bounding box.");
      // Bounded at 2x, not the device's actual 3x ratio.
      expect(Math.abs(backing.width - box.width * 2)).toBeLessThan(3);
      expect(backing.width).toBeLessThan(box.width * 2.5);
    });
  });
});
