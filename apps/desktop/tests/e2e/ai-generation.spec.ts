import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

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

test("packaged application credential window focuses, cancels, times out, stores securely, and restores a working key after failure", async () => {
  const launched = await launchPackaged(undefined, "discard", {
    aiMock: true,
    aiCredentialMode: "application",
    aiCredentialTimeoutMs: "5000",
  });
  try {
    const page = await launched.electronApp.firstWindow();
    await expect(page.getByTestId("ai-connection-message")).toContainText("Connect");

    const canceledWindowPromise = launched.electronApp.waitForEvent("window");
    await page.getByTestId("connect-ai").click();
    const canceledWindow = await canceledWindowPromise;
    await expect(canceledWindow.getByTestId("credential-dialog")).toBeVisible();
    await expect(canceledWindow.getByTestId("credential-input")).toBeFocused();
    await expect.poll(() => canceledWindow.evaluate(() => document.hasFocus())).toBe(true);
    await expect(page.getByTestId("cancel-ai-connection")).toBeVisible();
    await expect(page.getByTestId("ai-credential-timeout")).toContainText("5 seconds");
    await expect(page.locator(".app-shell")).toHaveAttribute("aria-busy", "true");
    await canceledWindow.getByTestId("credential-cancel").click();
    await expect(page.getByTestId("error-message")).toContainText("canceled");
    await expect(page.getByTestId("cancel-ai-connection")).toBeHidden();
    await expect(page.locator(".app-shell")).toHaveAttribute("aria-busy", "false");
    await expect(page.getByTestId("connect-ai")).toBeEnabled();

    const timedOutWindowPromise = launched.electronApp.waitForEvent("window");
    await page.getByTestId("connect-ai").click();
    const timedOutWindow = await timedOutWindowPromise;
    await expect(timedOutWindow.getByTestId("credential-dialog")).toBeVisible();
    await expect(page.getByTestId("error-message")).toContainText("timed out", {
      timeout: 10_000,
    });
    await expect.poll(() => timedOutWindow.isClosed()).toBe(true);
    await expect(page.locator(".app-shell")).toHaveAttribute("aria-busy", "false");
    await expect(page.getByTestId("connect-ai")).toBeEnabled();

    const acceptedCredential = "laserx-e2e-credential-valid-1234567890";
    const acceptedWindowPromise = launched.electronApp.waitForEvent("window");
    await page.getByTestId("connect-ai").click();
    const acceptedWindow = await acceptedWindowPromise;
    await acceptedWindow.getByTestId("credential-input").fill(acceptedCredential);
    await acceptedWindow.getByTestId("credential-submit").click();
    await expect(page.getByTestId("ai-connection-message")).toContainText("stored");
    await expect(page.getByTestId("replace-ai")).toBeEnabled();
    const encryptedEnvelope = await readFile(
      join(launched.userDataPath, "credentials", "ai-provider.json"),
      "utf8",
    );
    expect(encryptedEnvelope).not.toContain(acceptedCredential);
    expect(JSON.stringify(await page.evaluate(() => window.laserx.getState())))
      .not.toContain(acceptedCredential);

    const rejectedWindowPromise = launched.electronApp.waitForEvent("window");
    await page.getByTestId("replace-ai").click();
    const rejectedWindow = await rejectedWindowPromise;
    await rejectedWindow.getByTestId("credential-input")
      .fill("laserx-e2e-credential-rejected");
    await rejectedWindow.getByTestId("credential-submit").click();
    await expect(page.getByTestId("error-message")).toContainText(
      "deterministic test provider rejected",
    );
    await expect(page.getByTestId("replace-ai")).toBeEnabled();
    expect(await readFile(
      join(launched.userDataPath, "credentials", "ai-provider.json"),
      "utf8",
    )).toBe(encryptedEnvelope);
    await expect(page.getByTestId("ai-connection-message")).toContainText("stored");
    await expect(page.locator(".app-shell")).toHaveAttribute("aria-busy", "false");
  } finally {
    await killAndRemove(launched);
  }
});
