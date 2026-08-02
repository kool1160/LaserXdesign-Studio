import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

import { killAndRemove, launchPackaged } from "./helpers.js";

test("mocked AI concepts stay previews until wording verification and one-command acceptance", async () => {
  const launched = await launchPackaged(undefined, "discard", {
    aiMock: true,
    rasterPath: resolve(
      process.cwd(),
      "../../fixtures/images/m07/clean-logo.png",
    ),
  });
  try {
    const page = await launched.electronApp.firstWindow();
    await expect(page.getByTestId("ai-generation-panel")).toBeVisible();
    await expect(page.getByTestId("ai-connection-message")).toContainText(
      "protected OpenAI API key",
    );
    const before = await page.evaluate(async () =>
      JSON.stringify((await window.laserx.getState()).project.document),
    );

    await page.getByLabel("AI design prompt").fill(
      "A restrained industrial sign for packaged M10 verification",
    );
    await page.getByLabel("AI exact wording").fill("M10 LASERX");
    await page.getByLabel("Consent to send AI reference").check();
    await page.getByTestId("attach-ai-reference").click();
    await expect(page.getByTestId("ai-reference-summary")).toContainText("192 x 128 px");
    await page.getByTestId("generate-ai-concepts").click();
    await expect(page.getByTestId("ai-concept-list")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("ai-concept-list").getByRole("button")).toHaveCount(3);
    await expect(page.getByTestId("import-preview-overlay")).toBeVisible();
    await expect(page.getByTestId("ai-wording-status")).toContainText("mismatch");
    await expect(page.getByTestId("accept-ai-concept")).toBeDisabled();
    expect(await page.evaluate(async () =>
      JSON.stringify((await window.laserx.getState()).project.document),
    )).toBe(before);

    await page.getByLabel("Correct AI primary wording").fill("M10 LASERX");
    await page.getByTestId("correct-ai-wording").click();
    await expect(page.getByTestId("ai-wording-status")).toContainText("verified");
    await expect(page.getByTestId("ai-preacceptance-analysis")).toContainText(
      "cut ready: no",
    );

    await page.getByTestId("accept-ai-concept").click();
    await expect.poll(async () =>
      (await page.evaluate(() => window.laserx.getState())).analysis.cutability?.status,
    ).toMatch(/complete|ambiguous/u);
    const accepted = await page.evaluate(async () => window.laserx.getState());
    expect(accepted.editor.history.undoDepth).toBe(1);
    expect(accepted.project.document.objects.length).toBeGreaterThan(0);
    expect(accepted.project.document.objects.every((object) =>
      ["line", "rectangle", "ellipse", "path", "text", "group"].includes(object.type),
    )).toBe(true);
    const acceptedProject = JSON.stringify(accepted.project);
    expect(acceptedProject).not.toContain("packaged M10 verification");
    expect(acceptedProject).not.toContain("mock-response-m10");
    expect(JSON.stringify(accepted)).not.toContain("laserx-e2e-credential-placeholder");

    await page.getByTestId("undo").click();
    await expect.poll(async () =>
      JSON.stringify((await page.evaluate(() => window.laserx.getState())).project.document),
    ).toBe(before);

    await page.getByTestId("disconnect-ai").click();
    await expect(page.getByTestId("ai-connection-message")).toContainText("Connect");
    await page.getByTestId("add-rectangle").click();
    await expect.poll(async () =>
      (await page.evaluate(() => window.laserx.getState())).project.document.objects.length,
    ).toBe(1);
  } finally {
    await killAndRemove(launched);
  }
});

test("packaged credential connection cancels, times out, and restores global controls", async () => {
  const launched = await launchPackaged(undefined, "discard", {
    aiMock: true,
    aiCredentialMode: "wait",
    aiCredentialTimeoutMs: "800",
  });
  try {
    const page = await launched.electronApp.firstWindow();
    await expect(page.getByTestId("ai-connection-message")).toContainText("Connect");

    await page.getByTestId("connect-ai").click();
    await expect(page.getByTestId("cancel-ai-connection")).toBeVisible();
    await expect(page.getByTestId("ai-credential-timeout")).toContainText("1 seconds");
    await expect(page.locator(".app-shell")).toHaveAttribute("aria-busy", "true");
    await page.getByTestId("cancel-ai-connection").click();
    await expect(page.getByTestId("error-message")).toContainText("canceled");
    await expect(page.getByTestId("cancel-ai-connection")).toBeHidden();
    await expect(page.locator(".app-shell")).toHaveAttribute("aria-busy", "false");
    await expect(page.getByTestId("connect-ai")).toBeEnabled();

    await page.getByTestId("connect-ai").click();
    await expect(page.getByTestId("error-message")).toContainText("timed out", {
      timeout: 5_000,
    });
    await expect(page.locator(".app-shell")).toHaveAttribute("aria-busy", "false");
    await expect(page.getByTestId("connect-ai")).toBeEnabled();
  } finally {
    await killAndRemove(launched);
  }
});
