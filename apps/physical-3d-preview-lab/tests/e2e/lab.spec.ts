import { expect, test } from "@playwright/test";

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
});
