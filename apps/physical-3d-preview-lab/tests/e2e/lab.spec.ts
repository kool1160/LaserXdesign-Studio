import { expect, test } from "@playwright/test";

test.describe("physical 3D preview lab", () => {
  test("launches, loads the fixture, and shows exact dimension readouts", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByTestId("preview-canvas")).toBeVisible();
    const dimensions = page.getByTestId("dimensions");
    await expect(dimensions).toHaveText(/160\.0 mm/);
    await expect(dimensions).toHaveText(/80\.0 mm/);
    await expect(dimensions).toHaveText(/3\.0 mm/);
    await expect(page.getByTestId("findings-banner")).toHaveCount(0);
  });

  test("front, perspective, and reset controls toggle the active view", async ({ page }) => {
    await page.goto("/");

    const frontButton = page.getByRole("button", { name: "Front" });
    const perspectiveButton = page.getByRole("button", { name: "Perspective" });
    const resetButton = page.getByRole("button", { name: "Reset view" });

    await expect(perspectiveButton).toHaveAttribute("aria-pressed", "true");
    await expect(frontButton).toHaveAttribute("aria-pressed", "false");

    await frontButton.click();
    await expect(frontButton).toHaveAttribute("aria-pressed", "true");
    await expect(perspectiveButton).toHaveAttribute("aria-pressed", "false");

    await resetButton.click();
    await expect(perspectiveButton).toHaveAttribute("aria-pressed", "true");
    await expect(frontButton).toHaveAttribute("aria-pressed", "false");
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
    await expect(page.getByTestId("dimensions")).toHaveText(/160\.0 mm/);
    expect(pageErrors).toHaveLength(0);
  });
});
