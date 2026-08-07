import { expect, test } from "@playwright/test";

import {
  clickAndWaitForCommand,
  kill,
  killAndRemove,
  launchPackaged,
} from "./helpers.js";

test("clean first launch offers exactly three goals and a global exit", async () => {
  const launched = await launchPackaged();
  try {
    const page = await launched.electronApp.firstWindow();
    const chooser = page.getByTestId("goal-chooser");
    await expect(chooser).toBeVisible();
    await expect(chooser.locator(".goal-options > button")).toHaveCount(3);
    await expect(page.getByText("Create My First Sign", { exact: true })).toBeVisible();
    await expect(page.getByText("Import My Own Design", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Describe What I Want With AI — Optional", { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("start-describe-with-ai")).toBeDisabled();

    await page.getByTestId("start-create-first-sign").click();
    await expect(page.getByTestId("guidance-shell")).toBeVisible();
    await expect(page.getByText("Choose size and material", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "New Design", exact: true })).toBeHidden();
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible();
    await expect(page.getByTestId("preview-vector-import")).toBeHidden();
    await expect(page.getByTestId("trace-raster")).toBeHidden();
    await expect(page.getByTestId("export-svg")).toBeHidden();
    await expect(page.getByTestId("export-dxf")).toBeHidden();
    await expect(page.getByTestId("open-physical-preview")).toBeHidden();
    const activeProjectId = await page.evaluate(
      async () => (await window.laserx.getState()).project.id,
    );
    await expect.poll(() => launched.electronApp.evaluate(({ Menu }) => {
      const fileMenu = Menu.getApplicationMenu()?.items.find(
        (item) => item.label === "File",
      );
      return fileMenu?.submenu?.items
        .filter((item) => item.type !== "separator")
        .map((item) => ({ label: item.label, enabled: item.enabled, visible: item.visible }));
    })).toEqual([
      { label: "New Project", enabled: false, visible: false },
      { label: "Open…", enabled: false, visible: false },
      { label: "Import SVG/DXF...", enabled: false, visible: false },
      { label: "Trace PNG/JPEG...", enabled: false, visible: false },
      { label: "Save", enabled: true, visible: true },
      { label: "Save As…", enabled: true, visible: true },
      { label: "Export SVG...", enabled: false, visible: false },
      { label: "Export DXF...", enabled: false, visible: false },
      { label: "Exit", enabled: true, visible: true },
    ]);
    await page.keyboard.press("Control+N");
    await expect.poll(
      () => page.evaluate(async () => (await window.laserx.getState()).project.id),
    ).toBe(activeProjectId);

    await page.getByTestId("guidance-exit").click();
    await expect(page.getByTestId("guidance-shell")).toBeHidden();
    await expect(page.getByTestId("workspace-welcome")).toBeVisible();
    await expect(page.getByTestId("preview-vector-import")).toBeVisible();
    await expect(page.getByTestId("trace-raster")).toBeVisible();
    await expect(page.getByTestId("export-svg")).toBeVisible();
    await expect(page.getByTestId("export-dxf")).toBeVisible();
    await expect(page.getByTestId("open-physical-preview")).toBeVisible();
    await expect.poll(() => launched.electronApp.evaluate(({ Menu }) => {
      const fileMenu = Menu.getApplicationMenu()?.items.find(
        (item) => item.label === "File",
      );
      return fileMenu?.submenu?.items
        .filter((item) => item.type !== "separator")
        .map((item) => ({ label: item.label, enabled: item.enabled, visible: item.visible }));
    })).toEqual([
      { label: "New Project", enabled: true, visible: true },
      { label: "Open…", enabled: true, visible: true },
      { label: "Import SVG/DXF...", enabled: true, visible: true },
      { label: "Trace PNG/JPEG...", enabled: true, visible: true },
      { label: "Save", enabled: true, visible: true },
      { label: "Save As…", enabled: true, visible: true },
      { label: "Export SVG...", enabled: true, visible: true },
      { label: "Export DXF...", enabled: true, visible: true },
      { label: "Exit", enabled: true, visible: true },
    ]);
  } finally {
    await killAndRemove(launched);
  }
});

test("packaged guidance persists and resumes the exact stable step", async () => {
  const first = await launchPackaged();
  try {
    const page = await first.electronApp.firstWindow();
    await clickAndWaitForCommand(page, "Save as");
    await page.getByTestId("start-create-first-sign").click();
    await page.getByTestId("guidance-continue").click();
    await expect(page.getByText("Add your sign content", { exact: true })).toBeVisible();
    await page.getByTestId("add-rectangle").click();
    await clickAndWaitForCommand(page, "Save");
    await expect.poll(
      () => page.evaluate(async () => (await window.laserx.getState()).project.document.objects.length),
    ).toBe(1);
    const firstToken = await page.evaluate(
      async () => (await window.laserx.getState()).onboarding.workflow.runToken,
    );
    await kill(first);

    const second = await launchPackaged(first.directory);
    try {
      const resumedPage = await second.electronApp.firstWindow();
      await expect(resumedPage.getByTestId("resume-guidance")).toBeHidden();
      await expect.poll(() => resumedPage.evaluate(async () => {
        const onboarding = (await window.laserx.getState()).onboarding;
        return {
          eligibility: onboarding.resumeEligibility,
          hasSnapshot: onboarding.preferences.activeWorkflow !== null,
        };
      })).toEqual({ eligibility: "different-project", hasSnapshot: true });
      await resumedPage.evaluate(async () => {
        await window.laserx.openProject();
      });
      await expect.poll(() => resumedPage.evaluate(
        async () => (await window.laserx.getState()).onboarding.resumeEligibility,
      )).toBe("available");
      await expect(resumedPage.getByTestId("resume-guidance-card")).toBeVisible();
      await resumedPage.getByTestId("resume-guidance").click();
      await expect(
        resumedPage.getByText("Add your sign content", { exact: true }),
      ).toBeVisible();
      const secondToken = await resumedPage.evaluate(
        async () => (await window.laserx.getState()).onboarding.workflow.runToken,
      );
      expect(secondToken).not.toBe(firstToken);
      await resumedPage.getByTestId("guidance-exit").click();
      await expect(resumedPage.getByTestId("guidance-shell")).toBeHidden();
    } finally {
      await killAndRemove(second);
    }
  } catch (error) {
    await killAndRemove(first);
    throw error;
  }
});

test("project replacement ends packaged guidance without trapping the editor", async () => {
  const launched = await launchPackaged();
  try {
    const page = await launched.electronApp.firstWindow();
    await page.getByTestId("start-import-own-design").click();
    await expect(page.getByTestId("guidance-shell")).toBeVisible();
    await page.evaluate(async () => {
      await window.laserx.newProject();
    });

    await expect(page.getByTestId("guidance-shell")).toBeHidden();
    await expect(page.getByTestId("guidance-recovery-notice")).toContainText(
      "project was replaced",
    );
    await expect(page.getByTestId("viewport")).toBeVisible();
  } finally {
    await killAndRemove(launched);
  }
});

test("packaged transient recovery returns to a stable checkpoint with an exit", async () => {
  const first = await launchPackaged();
  try {
    const page = await first.electronApp.firstWindow();
    await clickAndWaitForCommand(page, "Save as");
    await page.getByTestId("start-create-first-sign").click();
    for (let index = 0; index < 3; index += 1) {
      await page.getByTestId("guidance-continue").click();
    }
    await expect(page.getByText("Review findings", { exact: true })).toBeVisible();
    await kill(first);

    const second = await launchPackaged(first.directory);
    try {
      const resumedPage = await second.electronApp.firstWindow();
      await resumedPage.evaluate(async () => {
        await window.laserx.openProject();
      });
      await resumedPage.getByTestId("resume-guidance").click();
      await expect(
        resumedPage.getByText("Check the design", { exact: true }),
      ).toBeVisible();
      await expect(resumedPage.getByTestId("guidance-recovery-notice")).toContainText(
        "nearest saved checkpoint",
      );
      await expect(resumedPage.getByTestId("guidance-exit")).toBeEnabled();
      await resumedPage.getByTestId("guidance-exit").click();
      await expect(resumedPage.getByTestId("viewport")).toBeVisible();
    } finally {
      await killAndRemove(second);
    }
  } catch (error) {
    await killAndRemove(first);
    throw error;
  }
});
