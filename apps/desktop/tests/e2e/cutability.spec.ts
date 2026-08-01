import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { createBlankProject, identityTransform } from "@laserx/domain";
import { serializeProject } from "@laserx/project-format";
import { expect, test, type Page } from "@playwright/test";

import {
  clickAndWaitForCommand,
  killAndRemove,
  launchPackaged,
  waitForProjectSchema,
  type TestLaunch,
} from "./helpers.js";

const LAYER_ID = "10000000-0000-4000-8000-000000000001";
const OUTER_ID = "20000000-0000-4000-8000-000000000001";
const ISLAND_ID = "30000000-0000-4000-8000-000000000001";

async function seedNestedProject(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "laserx-cutability-e2e-"));
  const project = createBlankProject({
    id: "40000000-0000-4000-8000-000000000001",
    documentId: "50000000-0000-4000-8000-000000000001",
    name: "M08 bridge fixture",
    now: "2026-07-31T12:00:00.000Z",
    width: 360,
    height: 240,
    layers: [{ id: LAYER_ID, name: "Stencil", visible: true, locked: false }],
    activeLayerId: LAYER_ID,
    objects: [
      {
        id: OUTER_ID,
        type: "path",
        layerId: LAYER_ID,
        transform: identityTransform(),
        closed: true,
        points: [
          { xMm: 30, yMm: 30 },
          { xMm: 300, yMm: 30 },
          { xMm: 300, yMm: 210 },
          { xMm: 30, yMm: 210 },
        ],
      },
      {
        id: ISLAND_ID,
        type: "path",
        layerId: LAYER_ID,
        transform: identityTransform(),
        closed: true,
        points: [
          { xMm: 120, yMm: 80 },
          { xMm: 210, yMm: 80 },
          { xMm: 210, yMm: 160 },
          { xMm: 120, yMm: 160 },
        ],
      },
    ],
  });
  await writeFile(
    join(directory, "lifecycle.laserx"),
    serializeProject(project),
    "utf8",
  );
  return directory;
}

async function launchAnalyzedFixture(): Promise<{
  launched: TestLaunch;
  page: Page;
}> {
  const directory = await seedNestedProject();
  const launched = await launchPackaged(directory, "discard");
  const page = await launched.electronApp.firstWindow();
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect.poll(
    async () => (await page.evaluate(() => window.laserx.getState())).project.name,
  ).toBe("M08 bridge fixture");
  await page.getByTestId("run-cutability-analysis").click();
  await expect(page.getByTestId("cutability-analysis")).toContainText(
    "Analysis complete",
  );
  const islandIssue = page.locator('[data-issue-code="DISCONNECTED_ISLAND"]');
  await expect(islandIssue).toContainText("measured / 2.000 mm limit");
  await islandIssue.click();
  await expect(page.getByTestId("manufacturing-issue-marker")).toBeVisible();
  return { launched, page };
}

test("manual bridge previews without mutation, accepts once, and undoes exactly", async () => {
  const { launched, page } = await launchAnalyzedFixture();
  try {
    const before = await page.evaluate(async () =>
      JSON.stringify((await window.laserx.getState()).project.document),
    );
    await page.getByLabel("Manual bridge direction").selectOption("right");
    await page.getByTestId("preview-manual-bridge").click();
    await expect(page.getByTestId("bridge-preview-summary")).toContainText(
      "Manual right bridge",
    );
    await expect(page.getByTestId("bridge-proposal-overlay")).toBeVisible();
    expect(await page.evaluate(async () =>
      JSON.stringify((await window.laserx.getState()).project.document),
    )).toBe(before);
    if (process.env.LASERX_CAPTURE_SCREENSHOT === "1") {
      await page.locator(".app-shell").screenshot({
        path: resolve(
          process.cwd(),
          "../../docs/screenshots/m08-cutability-bridge-preview.png",
        ),
      });
    }

    await page.getByTestId("accept-bridge").click();
    await expect.poll(async () =>
      (await page.evaluate(() => window.laserx.getState())).editor.history.undoDepth,
    ).toBe(1);
    expect(await page.evaluate(async () =>
      JSON.stringify((await window.laserx.getState()).project.document),
    )).not.toBe(before);
    await page.getByTestId("undo").click();
    await expect.poll(async () =>
      JSON.stringify((await page.evaluate(() => window.laserx.getState())).project.document),
    ).toBe(before);
  } finally {
    await killAndRemove(launched);
  }
});

test("automatic bridge chooses a minimum-width candidate and persists editable paths", async () => {
  const { launched, page } = await launchAnalyzedFixture();
  try {
    await page.getByTestId("preview-auto-bridge").click();
    await expect(page.getByTestId("bridge-preview-summary")).toContainText(
      "Automatic",
    );
    const proposal = await page.evaluate(async () =>
      (await window.laserx.getState()).analysis.bridgeProposal,
    );
    expect(proposal).toMatchObject({ mode: "automatic", widthMm: 2 });
    await page.getByTestId("accept-bridge").click();
    await expect.poll(async () =>
      (await page.evaluate(() => window.laserx.getState())).editor.history.undoDepth,
    ).toBe(1);

    await clickAndWaitForCommand(page, "Save");
    await waitForProjectSchema(launched.projectPath, 6);
    const saved = JSON.parse(await readFile(launched.projectPath, "utf8")) as {
      document: {
        objects: Array<{ type: string; closed?: boolean }>;
        settings: { manufacturing: { minimumBridgeWidthMm: number } };
      };
    };
    expect(saved.document.objects.length).toBeGreaterThan(0);
    expect(saved.document.objects.every(
      (object) => object.type === "path" && object.closed === true,
    )).toBe(true);
    expect(saved.document.settings.manufacturing.minimumBridgeWidthMm).toBe(2);
  } finally {
    await killAndRemove(launched);
  }
});
