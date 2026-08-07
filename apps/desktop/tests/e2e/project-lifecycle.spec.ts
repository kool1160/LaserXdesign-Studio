import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { expect, test } from "@playwright/test";

import {
  clickAndWaitForCommand,
  kill,
  killAndRemove,
  launchPackaged,
  waitForProjectSchema,
} from "./helpers.js";

test("committed DXF project survives a packaged restart and direct reopen", async () => {
  const directory = await mkdtemp(join(tmpdir(), "laserx-m13-reopen-e2e-"));
  const importPath = join(directory, "representative.dxf");
  const exportPath = join(directory, "reopened.dxf");
  await writeFile(
    importPath,
    "0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n1\n0\nENDSEC\n" +
      "0\nSECTION\n2\nENTITIES\n" +
      "0\nLWPOLYLINE\n8\nCut\n90\n4\n70\n1\n" +
      "10\n0\n20\n0\n10\n24\n20\n0\n10\n24\n20\n12\n10\n0\n20\n12\n" +
      "0\nLWPOLYLINE\n8\nEngrave\n90\n2\n70\n0\n" +
      "10\n1\n20\n1\n10\n23\n20\n11\n" +
      "0\nENDSEC\n0\nEOF\n",
    "utf8",
  );

  const launched = await launchPackaged(directory, "discard", {
    importPath,
    exportPath,
  });
  try {
    const page = await launched.electronApp.firstWindow();
    await page.getByTestId("preview-vector-import").click();
    await expect(page.getByTestId("import-preview-summary")).toContainText(
      "representative.dxf: 2 path(s)",
    );
    await clickAndWaitForCommand(page, "Save as");
    await expect(page.getByTestId("error-message")).toContainText(
      "still a preview and is not part of the project yet",
    );
    await expect(readFile(launched.projectPath, "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
    await page.getByTestId("commit-vector-import").click();

    const expectedBeforeSave = await page.evaluate(async () => {
      let state = await window.laserx.getState();
      const objectIds = state.project.document.objects.map(({ id }) => id);
      await window.laserx.editorAction({
        type: "objects.move",
        objectIds,
        deltaXmm: 25.4,
        deltaYmm: 12.7,
      });
      state = await window.laserx.getState();
      await window.laserx.setManufacturingSettings({
        settings: {
          ...state.project.document.settings.manufacturing,
          kerfWidthMm: 0.35,
          minimumBridgeWidthMm: 2.5,
          customizedFields: ["kerfWidthMm", "minimumBridgeWidthMm"],
        },
      });
      state = await window.laserx.getState();
      const cutLayer = state.project.document.layers.find(
        ({ name }) => name === "Cut",
      );
      if (cutLayer === undefined) {
        throw new Error("Expected the imported Cut layer.");
      }
      await window.laserx.editorAction({
        type: "layer.set-manufacturing",
        layerId: cutLayer.id,
        manufacturing: {
          role: "face",
          material: "mild-steel",
          thicknessMm: 3,
          process: "laser",
          notes: "M13 persistence regression",
          registrationGroup: null,
          registrationHoleIds: [],
        },
      });
      return (await window.laserx.getState()).project;
    });
    expect(expectedBeforeSave.document.objects).toHaveLength(2);
    expect(expectedBeforeSave.document.layers.map(({ name }) => name)).toEqual(
      expect.arrayContaining(["Cut", "Engrave"]),
    );
    expect(
      expectedBeforeSave.document.objects.some(
        ({ transform }) => transform.eMm !== 0 || transform.fMm !== 0,
      ),
    ).toBe(true);

    await clickAndWaitForCommand(page, "Save as");
    await waitForProjectSchema(launched.projectPath, 9);
    await expect(page.getByTestId("dirty-indicator")).toBeHidden();
    await expect(page.getByTestId("project-title")).toHaveText("lifecycle");
    expect(
      await launched.electronApp.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0]?.getTitle(),
      ),
    ).toBe("lifecycle — LaserX Design Studio");
  } finally {
    await kill(launched);
  }

  const reopened = await launchPackaged(directory, "discard", { exportPath });
  try {
    const page = await reopened.electronApp.firstWindow();
    await page.getByRole("button", { name: "Open Project", exact: true }).click();
    await expect(page.getByTestId("workspace-welcome")).toBeHidden();
    await expect(page.getByTestId("error-message")).toHaveCount(0);

    const saved = JSON.parse(
      await readFile(reopened.projectPath, "utf8"),
    ) as { project: { id: string; name: string }; document: unknown };
    const reopenedState = await page.evaluate(async () => window.laserx.getState());
    expect(reopenedState.project.id).toBe(saved.project.id);
    expect(reopenedState.project.document).toEqual(saved.document);
    expect(reopenedState.project.document.objects).toHaveLength(2);
    expect(reopenedState.project.document.layers.map(({ name }) => name)).toEqual(
      expect.arrayContaining(["Cut", "Engrave"]),
    );
    expect(reopenedState.project.document.settings.manufacturing).toMatchObject({
      kerfWidthMm: 0.35,
      minimumBridgeWidthMm: 2.5,
    });
    expect(
      reopenedState.project.document.layers.find(({ name }) => name === "Cut")
        ?.manufacturing,
    ).toMatchObject({
      role: "face",
      material: "mild-steel",
      thicknessMm: 3,
    });
    expect(reopenedState.filePath).toBe(reopened.projectPath);
    expect(reopenedState.dirty).toBe(false);
    expect(reopenedState.project.name).toBe("lifecycle");
    await expect(page.getByTestId("project-title")).toHaveText("lifecycle");
    expect(
      await reopened.electronApp.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0]?.getTitle(),
      ),
    ).toBe("lifecycle — LaserX Design Studio");

    await page.getByTestId("export-dxf").click();
    await expect(page.getByTestId("export-summary")).toContainText(
      "Exported 2 path(s) as DXF in millimeters",
    );
    await expect.poll(async () => readFile(exportPath, "utf8")).toContain(
      "$INSUNITS\n70\n4\n",
    );
  } finally {
    await killAndRemove(reopened);
  }
});

test("malformed project open reports failure without presenting empty success", async () => {
  const directory = await mkdtemp(join(tmpdir(), "laserx-m13-malformed-e2e-"));
  const projectPath = join(directory, "lifecycle.laserx");
  await writeFile(projectPath, "{", "utf8");
  const launched = await launchPackaged(directory, "discard");
  try {
    const page = await launched.electronApp.firstWindow();
    await page.getByTestId("start-create-first-sign").click();
    await page.getByTestId("guidance-exit").click();
    const before = await page.evaluate(async () => window.laserx.getState());
    await page.getByRole("button", { name: "Open Project", exact: true }).click();
    await expect(page.getByTestId("error-message")).toContainText(
      "not valid JSON",
    );
    await expect(page.getByTestId("workspace-welcome")).toBeVisible();
    const after = await page.evaluate(async () => window.laserx.getState());
    expect(after.project.id).toBe(before.project.id);
    expect(after.project.document.objects).toEqual([]);
    expect(after.filePath).toBeNull();
    expect(after.recentProjects).toEqual([]);
  } finally {
    await killAndRemove(launched);
  }
});

test("blank project saves, reopens, and protects dirty close", async () => {
  const launched = await launchPackaged();
  try {
    const page = await launched.electronApp.firstWindow();
    const originalId = await page.evaluate(
      async () => (await window.laserx.getState()).project.id,
    );

    await page.getByRole("button", { name: "Create document" }).click();
    await expect(page.getByTestId("document-dimensions")).toHaveText(
      "24 × 12 in",
    );
    await expect(page.getByTestId("dirty-indicator")).toBeVisible();
    await clickAndWaitForCommand(page, "Save as");
    await waitForProjectSchema(launched.projectPath, 9);
    await expect(page.getByTestId("dirty-indicator")).toBeHidden();

    const saved = JSON.parse(
      await readFile(launched.projectPath, "utf8"),
    ) as {
      schemaVersion: number;
      project: { id: string };
      document: {
        id: string;
        dimensions: { widthMm: number; heightMm: number };
        settings: { displayUnit: string };
      };
    };
    expect(saved.schemaVersion).toBe(9);
    expect(saved.project.id).toBe(originalId);
    expect(saved.document.id).not.toBe(originalId);
    expect(saved.document.dimensions).toEqual({
      widthMm: 609.6,
      heightMm: 304.8,
    });
    expect(saved.document.settings.displayUnit).toBe("inches");

    await page.getByRole("button", { name: "mm", exact: true }).click();
    await launched.electronApp.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.close();
    });
    await page.waitForTimeout(200);
    expect(launched.electronApp.windows()).toHaveLength(1);
    await expect(page.getByTestId("dirty-indicator")).toBeVisible();
  } finally {
    await kill(launched);
  }

  const reopened = await launchPackaged(launched.directory);
  try {
    const page = await reopened.electronApp.firstWindow();
    await page.locator(".recent-section button").first().click();
    await expect(
      page.getByRole("button", { name: "in", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    const reopenedId = await page.evaluate(
      async () => (await window.laserx.getState()).project.id,
    );
    const saved = JSON.parse(
      await readFile(reopened.projectPath, "utf8"),
    ) as { project: { id: string } };
    expect(reopenedId).toBe(saved.project.id);
  } finally {
    await killAndRemove(reopened);
  }
});

test("interrupted session offers recovery without changing the original", async () => {
  const launched = await launchPackaged();
  const directory = launched.directory;
  try {
    const page = await launched.electronApp.firstWindow();
    await page.getByRole("button", { name: "Save as" }).click();
    await page.getByRole("button", { name: "in", exact: true }).click();

    const recoveryPath = join(
      launched.userDataPath,
      "recovery",
      "active.laserx.autosave",
    );
    await expect
      .poll(async () => {
        try {
          return (await readFile(recoveryPath, "utf8")).length;
        } catch {
          return 0;
        }
      })
      .toBeGreaterThan(0);
    await kill(launched);
  } catch (error) {
    await kill(launched);
    throw error;
  }

  const recovered = await launchPackaged(directory);
  try {
    const page = await recovered.electronApp.firstWindow();
    await expect(page.getByTestId("recovery-banner")).toBeVisible();
    if (process.env.LASERX_CAPTURE_SCREENSHOT === "1") {
      await page.locator(".app-shell").screenshot({
        path: resolve(
          process.cwd(),
          "../../docs/screenshots/m01-recovery-offer.png",
        ),
      });
    }
    await page.getByRole("button", { name: "Recover", exact: true }).click();
    await expect(page.getByTestId("recovery-banner")).toBeHidden();
    await expect(page.getByTestId("dirty-indicator")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "in", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");

    const original = JSON.parse(
      await readFile(recovered.projectPath, "utf8"),
    ) as { document: { settings: { displayUnit: string } } };
    expect(original.document.settings.displayUnit).toBe("millimeters");
  } finally {
    await killAndRemove(recovered);
  }
});
