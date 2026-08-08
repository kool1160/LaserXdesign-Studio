import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

test("packaged Create My First Sign follows real outcomes through whole-design analysis, rendered 3D, save, and SVG export", async () => {
  const directory = await mkdtemp(join(tmpdir(), "laserx-first-sign-e2e-"));
  const exportPath = join(directory, "my-first-sign.svg");
  const launched = await launchPackaged(directory, "discard", { exportPath });
  try {
    const page = await launched.electronApp.firstWindow();
    await page.getByTestId("start-create-first-sign").click();

    const rejectedCheckpoint = await page.evaluate(async () => {
      const before = await window.laserx.getState();
      const workflow = before.onboarding.workflow;
      if (workflow.currentStepId === null || workflow.runToken === null) {
        throw new Error("Expected active first-sign guidance.");
      }
      const result = await window.laserx.onboardingAction({
        type: "advance",
        expectedStepId: workflow.currentStepId,
        runToken: workflow.runToken,
        completion: { kind: "step" },
      });
      return {
        ok: result.ok,
        error: result.ok ? null : result.error,
        step: result.state.onboarding.workflow.currentStepId,
        objectCount: result.state.project.document.objects.length,
      };
    });
    expect(rejectedCheckpoint).toEqual({
      ok: false,
      error: expect.stringContaining("physical layer"),
      step: "choose-size-material",
      objectCount: 0,
    });

    await page.getByLabel("Document width").fill("240");
    await page.getByLabel("Document height").fill("120");
    await page.getByLabel("Document input units").selectOption("millimeters");
    await page.getByTestId("create-document").click();
    await expect(page.getByLabel("Manufacturing layer role")).toBeVisible();
    await page.getByLabel("Manufacturing layer role").selectOption("face");
    await expect(
      page.getByText("Add your sign content", { exact: true }),
    ).toBeVisible();

    await page.getByTestId("add-rectangle").click();
    await expect(page.getByText("Check the design", { exact: true })).toBeVisible();
    await expect(page.getByTestId("run-selection-cutability-analysis")).toBeHidden();
    await expect(page.getByTestId("run-cutability-analysis")).toBeEnabled();
    await page.getByTestId("run-cutability-analysis").click();
    await expect(page.getByText("Review the 3D result", { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByTestId("open-physical-preview").click();
    await expect(page.getByTestId("physical-preview-canvas")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("guided-physical-preview-continue")).toBeEnabled({
      timeout: 15_000,
    });
    await page.getByTestId("guided-physical-preview-continue").click();
    await expect(page.getByTestId("physical-preview-overlay")).toHaveCount(0);
    await expect(page.getByText("Save and export", { exact: true })).toBeVisible();

    await clickAndWaitForCommand(page, "Save as");
    const rejectedExportShortcut = await page.evaluate(async () => {
      const workflow = (await window.laserx.getState()).onboarding.workflow;
      if (workflow.currentStepId === null || workflow.runToken === null) {
        throw new Error("Expected the export checkpoint to remain active.");
      }
      const result = await window.laserx.onboardingAction({
        type: "advance",
        expectedStepId: workflow.currentStepId,
        runToken: workflow.runToken,
        completion: { kind: "step" },
      });
      return {
        ok: result.ok,
        error: result.ok ? null : result.error,
        step: result.state.onboarding.workflow.currentStepId,
      };
    });
    expect(rejectedExportShortcut).toEqual({
      ok: false,
      error: expect.stringContaining("Export SVG or DXF"),
      step: "save-export",
    });

    await page.getByTestId("export-svg").click();
    await expect.poll(async () => {
      try {
        return (await readFile(exportPath, "utf8")).includes("<svg");
      } catch {
        return false;
      }
    }).toBe(true);
    await expect.poll(() => page.evaluate(async () => {
      const onboarding = (await window.laserx.getState()).onboarding;
      return {
        status: onboarding.workflow.status,
        completed: onboarding.preferences.completedGoals,
        activeWorkflow: onboarding.preferences.activeWorkflow,
      };
    })).toEqual({
      status: "completed",
      completed: ["create-first-sign"],
      activeWorkflow: null,
    });
    await expect(page.getByTestId("guidance-shell")).toHaveCount(0);

    const exported = await readFile(exportPath, "utf8");
    expect(exported).toContain('width="240mm"');
    expect(exported).toContain('height="120mm"');
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
    await page.evaluate(async () => {
      await window.laserx.createDocument({
        width: 200,
        height: 100,
        inputUnit: "millimeters",
      });
      const layerId = (await window.laserx.getState()).project.document.activeLayerId;
      await window.laserx.editorAction({
        type: "layer.set-manufacturing",
        layerId,
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
    });
    await expect(page.getByText("Add your sign content", { exact: true })).toBeVisible();
    await clickAndWaitForCommand(page, "Save");
    await expect.poll(
      () => page.evaluate(async () => (await window.laserx.getState()).project.document.objects.length),
    ).toBe(0);
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
    await kill(first).catch(() => undefined);
    await rm(first.directory, { recursive: true, force: true });
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
    await page.evaluate(async () => {
      await window.laserx.createDocument({
        width: 200,
        height: 100,
        inputUnit: "millimeters",
      });
      const layerId = (await window.laserx.getState()).project.document.activeLayerId;
      await window.laserx.editorAction({
        type: "layer.set-manufacturing",
        layerId,
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
    });
    await page.getByTestId("add-line").click();
    await expect(page.getByText("Check the design", { exact: true })).toBeVisible();
    await page.getByTestId("run-cutability-analysis").click();
    await expect(page.getByText("Review findings", { exact: true })).toBeVisible();
    await clickAndWaitForCommand(page, "Save");
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
