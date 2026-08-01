import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { expect, test } from "@playwright/test";

import {
  clickAndWaitForCommand,
  killAndRemove,
  launchPackaged,
  waitForProjectSchema,
} from "./helpers.js";

test("layered sign analysis, registration, persistence, and production package", async () => {
  const directory = await mkdtemp(join(tmpdir(), "laserx-production-e2e-"));
  const productionPath = join(directory, "reviewed-production");
  const launched = await launchPackaged(directory, "discard", { productionPath });
  try {
    const page = await launched.electronApp.firstWindow();
    const layerIds = await page.evaluate(async () => {
      let state = await window.laserx.getState();
      const faceId = state.project.document.activeLayerId;
      await window.laserx.editorAction({ type: "object.create", objectType: "rectangle" });
      await window.laserx.editorAction({ type: "object.create", objectType: "ellipse" });
      await window.laserx.editorAction({
        type: "layer.set-manufacturing",
        layerId: faceId,
        manufacturing: {
          role: "face",
          material: "mild-steel",
          thicknessMm: 3,
          process: "laser",
          notes: "Black powder coat",
          registrationGroup: "main",
        },
      });
      await window.laserx.editorAction({ type: "layer.create", name: "Backing" });
      state = await window.laserx.getState();
      const backingId = state.project.document.activeLayerId;
      await window.laserx.editorAction({ type: "object.create", objectType: "rectangle" });
      await window.laserx.editorAction({ type: "object.create", objectType: "ellipse" });
      await window.laserx.editorAction({
        type: "layer.set-manufacturing",
        layerId: backingId,
        manufacturing: {
          role: "backing",
          material: "acrylic",
          thicknessMm: 6,
          process: "router",
          notes: "White diffuser",
          registrationGroup: "main",
        },
      });
      await window.laserx.editorAction({
        type: "layers.coordinate-registration",
        sourceLayerId: faceId,
        targetLayerId: backingId,
      });
      await window.laserx.editorAction({ type: "layer.create", name: "Lighting preview" });
      state = await window.laserx.getState();
      const previewId = state.project.document.activeLayerId;
      await window.laserx.editorAction({ type: "object.create", objectType: "ellipse" });
      await window.laserx.editorAction({
        type: "layer.set-manufacturing",
        layerId: previewId,
        manufacturing: {
          role: "non-cut-preview",
          material: "other",
          thicknessMm: 1,
          process: "non-cut",
          notes: "LED glow only",
          registrationGroup: null,
        },
      });
      return { faceId, backingId, previewId };
    });

    await expect(page.getByTestId("production-package")).toBeVisible();
    await expect(page.getByLabel("Exploded two-dimensional assembly preview").locator(".assembly-layer")).toHaveCount(2);

    const scoped = await page.evaluate(async (layerId) =>
      window.laserx.runManufacturingLayerAnalysis({
        operationId: window.crypto.randomUUID(),
        layerId,
      }), layerIds.backingId);
    expect(scoped.ok).toBe(true);
    expect(scoped.state.analysis.scope).toMatchObject({
      kind: "manufacturing-layer",
      layerId: layerIds.backingId,
    });
    await expect(page.getByTestId("cutability-scope")).toContainText("Physical layer: Backing");

    await page.getByTestId("export-production-package").click();
    await expect(page.getByTestId("production-export-summary")).toContainText("Exported 2 layer(s) and 5 file(s).");
    const names = (await readdir(productionPath)).sort();
    expect(names).toEqual([
      "01-face-layer-1.dxf",
      "01-face-layer-1.svg",
      "02-backing-backing.dxf",
      "02-backing-backing.svg",
      "manifest.json",
    ]);
    const manifest = JSON.parse(await readFile(join(productionPath, "manifest.json"), "utf8")) as {
      sourceProjectVersion: number;
      originMm: { xMm: number; yMm: number };
      layers: { id: string; role: string; registrationHoles: unknown[]; files: { name: string }[] }[];
    };
    expect(manifest.sourceProjectVersion).toBe(8);
    expect(manifest.originMm).toEqual({ xMm: 0, yMm: 0 });
    expect(manifest.layers.map((layer) => layer.id)).toEqual([
      layerIds.faceId,
      layerIds.backingId,
    ]);
    expect(manifest.layers.some((layer) => layer.id === layerIds.previewId)).toBe(false);
    expect(manifest.layers[0]?.registrationHoles).toEqual(
      manifest.layers[1]?.registrationHoles,
    );
    const faceSvg = await readFile(join(productionPath, "01-face-layer-1.svg"), "utf8");
    const backingSvg = await readFile(join(productionPath, "02-backing-backing.svg"), "utf8");
    expect(faceSvg.match(/viewBox="[^"]+"/u)?.[0]).toBe(
      backingSvg.match(/viewBox="[^"]+"/u)?.[0],
    );

    await page.getByTestId("export-production-package").click();
    await expect(page.getByTestId("production-export-summary")).toContainText("already exists");
    await page.getByLabel("Replace an existing package folder").check();
    await page.getByTestId("export-production-package").click();
    await expect(page.getByTestId("production-export-summary")).toContainText("Exported 2 layer(s)");

    await clickAndWaitForCommand(page, "Save as");
    await waitForProjectSchema(launched.projectPath, 8);
    const saved = JSON.parse(await readFile(launched.projectPath, "utf8")) as {
      document: { layers: { manufacturing?: { role: string } }[] };
    };
    expect(saved.document.layers.map((layer) => layer.manufacturing?.role)).toEqual([
      "face",
      "backing",
      "non-cut-preview",
    ]);
  } finally {
    await killAndRemove(launched);
  }
});
