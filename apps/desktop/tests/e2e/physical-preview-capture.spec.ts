import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { killAndRemove, launchPackaged } from "./helpers.js";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function createPhysicalLayerProject(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof launchPackaged>>["electronApp"]["firstWindow"]>>,
): Promise<string> {
  return page.evaluate(async () => {
    const state = await window.laserx.getState();
    const faceId = state.project.document.activeLayerId;
    await window.laserx.editorAction({ type: "object.create", objectType: "rectangle" });
    await window.laserx.editorAction({
      type: "layer.set-manufacturing",
      layerId: faceId,
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
    return JSON.stringify((await window.laserx.getState()).project.document);
  });
}

test("capture writes a real non-empty PNG through the privileged boundary without touching the project", async () => {
  const directory = await mkdtemp(join(tmpdir(), "laserx-capture-e2e-"));
  const capturePath = join(directory, "reviewed-capture.png");
  const launched = await launchPackaged(undefined, "discard", { capturePath });
  try {
    const page = await launched.electronApp.firstWindow();
    const beforeDocument = await createPhysicalLayerProject(page);
    const before = await page.evaluate(async () => await window.laserx.getState());
    const beforeUndoDepth = before.editor.history.undoDepth;
    const beforeDirty = before.dirty;

    await page.getByTestId("open-physical-preview").click();
    await expect(page.getByTestId("physical-preview-canvas")).toBeVisible({ timeout: 15_000 });

    // The capture control is enabled only once React Three Fiber has mounted
    // the scene tree and the capture rig has published its handle -- the
    // canvas element becoming visible happens earlier than that.
    await expect(page.getByTestId("physical-preview-capture")).toBeEnabled({
      timeout: 15_000,
    });
    await page.getByTestId("physical-preview-capture").click();
    await expect(page.getByTestId("physical-preview-capture-status")).toContainText(
      "Saved",
      { timeout: 15_000 },
    );

    // Real bytes on disk, produced by a real WebGL readback and a real
    // privileged main-process write -- the layer no unit or jsdom test can
    // reach.
    const written = await readFile(capturePath);
    expect(written.subarray(0, 8)).toEqual(PNG_SIGNATURE);
    expect(written.byteLength).toBeGreaterThan(1_000);
    // The atomic write must leave no staging file behind.
    expect(await readdir(directory)).toEqual(["reviewed-capture.png"]);

    const afterDocument = await page.evaluate(async () =>
      JSON.stringify((await window.laserx.getState()).project.document),
    );
    expect(afterDocument).toBe(beforeDocument);

    const after = await page.evaluate(async () => await window.laserx.getState());
    expect(after.editor.history.undoDepth).toBe(beforeUndoDepth);
    expect(after.dirty).toBe(beforeDirty);
  } finally {
    await killAndRemove(launched);
  }
});

test("a rejected capture destination reports failure and writes nothing", async () => {
  const directory = await mkdtemp(join(tmpdir(), "laserx-capture-fail-e2e-"));
  // Not a .png: the privileged writer must refuse it outright.
  const capturePath = join(directory, "reviewed-capture.exe");
  const launched = await launchPackaged(undefined, "discard", { capturePath });
  try {
    const page = await launched.electronApp.firstWindow();
    const beforeDocument = await createPhysicalLayerProject(page);

    await page.getByTestId("open-physical-preview").click();
    await expect(page.getByTestId("physical-preview-canvas")).toBeVisible({ timeout: 15_000 });

    // The capture control is enabled only once React Three Fiber has mounted
    // the scene tree and the capture rig has published its handle -- the
    // canvas element becoming visible happens earlier than that.
    await expect(page.getByTestId("physical-preview-capture")).toBeEnabled({
      timeout: 15_000,
    });
    await page.getByTestId("physical-preview-capture").click();
    await expect(page.getByTestId("physical-preview-capture-status")).toContainText(
      /\.png/u,
      { timeout: 15_000 },
    );

    expect(await readdir(directory)).toEqual([]);

    const afterDocument = await page.evaluate(async () =>
      JSON.stringify((await window.laserx.getState()).project.document),
    );
    expect(afterDocument).toBe(beforeDocument);
  } finally {
    await killAndRemove(launched);
  }
});
