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
      state = await window.laserx.getState();
      const faceDecorativeOneId = state.editor.selectionIds[0] as string;
      await window.laserx.editorAction({ type: "object.create", objectType: "ellipse" });
      state = await window.laserx.getState();
      const faceDecorativeTwoId = state.editor.selectionIds[0] as string;
      await window.laserx.editorAction({ type: "object.create", objectType: "ellipse" });
      state = await window.laserx.getState();
      const faceHoleId = state.editor.selectionIds[0] as string;
      await window.laserx.editorAction({
        type: "objects.set-bounds",
        objectIds: [faceHoleId],
        widthMm: 6,
        heightMm: 6,
        lockAspectRatio: false,
      });
      await window.laserx.editorAction({
        type: "objects.move",
        objectIds: [faceHoleId],
        deltaXmm: -120,
        deltaYmm: -40,
      });
      state = await window.laserx.getState();
      const faceHole = state.project.document.objects.find(
        (object) => object.id === faceHoleId,
      );
      if (faceHole?.type !== "ellipse") throw new Error("Expected a face circle.");
      await window.laserx.editorAction({
        type: "objects.rotate",
        objectIds: [faceHoleId],
        angleDeg: 37,
        pivot: {
          xMm:
            faceHole.transform.a * faceHole.center.xMm +
            faceHole.transform.c * faceHole.center.yMm +
            faceHole.transform.eMm,
          yMm:
            faceHole.transform.b * faceHole.center.xMm +
            faceHole.transform.d * faceHole.center.yMm +
            faceHole.transform.fMm,
        },
      });
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
          registrationHoleIds: [faceHoleId],
        },
      });
      await window.laserx.editorAction({ type: "layer.create", name: "Backing" });
      state = await window.laserx.getState();
      const backingId = state.project.document.activeLayerId;
      await window.laserx.editorAction({ type: "object.create", objectType: "rectangle" });
      await window.laserx.editorAction({ type: "object.create", objectType: "ellipse" });
      state = await window.laserx.getState();
      const backingDecorativeOneId = state.editor.selectionIds[0] as string;
      await window.laserx.editorAction({ type: "object.create", objectType: "ellipse" });
      state = await window.laserx.getState();
      const backingDecorativeTwoId = state.editor.selectionIds[0] as string;
      await window.laserx.editorAction({ type: "object.create", objectType: "ellipse" });
      state = await window.laserx.getState();
      const originalBackingHoleId = state.editor.selectionIds[0] as string;
      await window.laserx.editorAction({
        type: "objects.set-bounds",
        objectIds: [originalBackingHoleId],
        widthMm: 10,
        heightMm: 10,
        lockAspectRatio: false,
      });
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
          registrationHoleIds: [originalBackingHoleId],
        },
      });
      state = await window.laserx.getState();
      const beforeCoordination = JSON.stringify(state.project);
      await window.laserx.editorAction({
        type: "layers.coordinate-registration",
        sourceLayerId: faceId,
        targetLayerId: backingId,
      });
      state = await window.laserx.getState();
      const afterCoordination = JSON.stringify(state.project);
      const coordinatedBackingHoleId = state.project.document.layers.find(
        (layer) => layer.id === backingId,
      )?.manufacturing?.registrationHoleIds[0] as string;
      const backingObjectIds = state.project.document.objects
        .filter((object) => object.layerId === backingId)
        .map((object) => object.id);
      await window.laserx.editorAction({ type: "history.undo" });
      const undoExact = JSON.stringify((await window.laserx.getState()).project) === beforeCoordination;
      await window.laserx.editorAction({ type: "history.redo" });
      const redoExact = JSON.stringify((await window.laserx.getState()).project) === afterCoordination;
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
          registrationHoleIds: [],
        },
      });
      return {
        faceId,
        backingId,
        previewId,
        faceHoleId,
        coordinatedBackingHoleId,
        faceDecorativeIds: [faceDecorativeOneId, faceDecorativeTwoId],
        backingDecorativeIds: [backingDecorativeOneId, backingDecorativeTwoId],
        backingObjectIds,
        originalBackingHoleId,
        undoExact,
        redoExact,
      };
    });

    expect(layerIds.undoExact).toBe(true);
    expect(layerIds.redoExact).toBe(true);
    expect(layerIds.backingObjectIds).toEqual(expect.arrayContaining([
      ...layerIds.backingDecorativeIds,
      layerIds.coordinatedBackingHoleId,
    ]));
    expect(layerIds.backingObjectIds).not.toContain(layerIds.originalBackingHoleId);

    await page.evaluate(async ({ faceId, backingId, previewId, ovalId }) => {
      const state = await window.laserx.getState();
      const oval = state.project.document.objects.find(
        (object) => object.id === ovalId,
      );
      if (oval?.type !== "ellipse") throw new Error("Expected a decorative oval.");
      await window.laserx.editorAction({ type: "layer.activate", layerId: faceId });
      await window.laserx.editorAction({
        type: "layer.set-visibility",
        layerId: backingId,
        visible: false,
      });
      await window.laserx.editorAction({
        type: "layer.set-visibility",
        layerId: previewId,
        visible: false,
      });
      await window.laserx.editorAction({
        type: "selection.point",
        point: {
          xMm:
            oval.transform.a * oval.center.xMm +
            oval.transform.c * oval.center.yMm +
            oval.transform.eMm,
          yMm:
            oval.transform.b * oval.center.xMm +
            oval.transform.d * oval.center.yMm +
            oval.transform.fMm,
        },
        toleranceMm: 1,
        mode: "replace",
      });
    }, {
      faceId: layerIds.faceId,
      backingId: layerIds.backingId,
      previewId: layerIds.previewId,
      ovalId: layerIds.faceDecorativeIds[1] as string,
    });
    await expect(page.getByTestId("designate-registration-holes")).toBeDisabled();
    await expect(page.getByText(/Registration holes must be true circles/u)).toBeVisible();

    await page.evaluate(async (faceHoleId) => {
      const state = await window.laserx.getState();
      const hole = state.project.document.objects.find(
        (object) => object.id === faceHoleId,
      );
      if (hole?.type !== "ellipse") throw new Error("Expected the designated face circle.");
      await window.laserx.editorAction({
        type: "selection.point",
        point: {
          xMm:
            hole.transform.a * hole.center.xMm +
            hole.transform.c * hole.center.yMm +
            hole.transform.eMm,
          yMm:
            hole.transform.b * hole.center.xMm +
            hole.transform.d * hole.center.yMm +
            hole.transform.fMm,
        },
        toleranceMm: 1,
        mode: "replace",
      });
    }, layerIds.faceHoleId);
    await expect(page.getByTestId("designate-registration-holes")).toBeEnabled();
    await page.getByTestId("designate-registration-holes").click();
    await expect(page.getByText("Designated registration circles: 1")).toBeVisible();
    await page.evaluate(async ({ backingId, previewId }) => {
      await window.laserx.editorAction({
        type: "layer.set-visibility",
        layerId: backingId,
        visible: true,
      });
      await window.laserx.editorAction({
        type: "layer.set-visibility",
        layerId: previewId,
        visible: true,
      });
    }, layerIds);

    await expect(page.getByTestId("production-package")).toBeVisible();
    await expect(page.getByLabel("Exploded two-dimensional assembly preview").locator(".assembly-layer")).toHaveCount(2);

    const expectedAnalysisIds = await page.evaluate(async ({ backingId }) => {
      const state = await window.laserx.getState();
      return {
        whole: state.project.document.objects.map((object) => object.id).sort(),
        selection: [...state.editor.selectionIds].sort(),
        backing: state.project.document.objects
          .filter((object) => object.layerId === backingId)
          .map((object) => object.id)
          .sort(),
      };
    }, layerIds);
    expect(expectedAnalysisIds.selection).toEqual([layerIds.faceHoleId]);

    await page.getByTestId("run-cutability-analysis").click();
    await expect(page.getByTestId("cutability-scope")).toContainText(
      "Whole-design analysis",
    );
    let analysisState = await page.evaluate(async () =>
      (await window.laserx.getState()).analysis,
    );
    expect(analysisState.scope).toEqual({
      kind: "whole-design",
      layerId: null,
      layerName: null,
    });
    expect(analysisState.cutability?.analyzedObjectIds).toEqual(
      expectedAnalysisIds.whole,
    );

    await page.getByTestId("run-selection-cutability-analysis").click();
    await expect(page.getByTestId("cutability-scope")).toContainText(
      "Selection analysis",
    );
    analysisState = await page.evaluate(async () =>
      (await window.laserx.getState()).analysis,
    );
    expect(analysisState.scope).toEqual({
      kind: "selection",
      layerId: null,
      layerName: null,
      objectIds: expectedAnalysisIds.selection,
    });
    expect(analysisState.cutability?.analyzedObjectIds).toEqual(
      expectedAnalysisIds.selection,
    );

    await page.evaluate(async (layerId) => {
      await window.laserx.editorAction({ type: "layer.activate", layerId });
    }, layerIds.backingId);
    await page.getByTestId("analyze-manufacturing-layer").click();
    await expect(page.getByTestId("cutability-scope")).toContainText(
      "Physical layer: Backing",
    );
    analysisState = await page.evaluate(async () =>
      (await window.laserx.getState()).analysis,
    );
    expect(analysisState.scope).toMatchObject({
      kind: "manufacturing-layer",
      layerId: layerIds.backingId,
    });
    expect(analysisState.cutability?.analyzedObjectIds).toEqual(
      expectedAnalysisIds.backing,
    );

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
      layers: {
        id: string;
        role: string;
        registrationHoles: { objectId: string; xMm: number; yMm: number; diameterMm: number }[];
        files: { name: string }[];
      }[];
    };
    expect(manifest.sourceProjectVersion).toBe(8);
    expect(manifest.originMm).toEqual({ xMm: 0, yMm: 0 });
    expect(manifest.layers.map((layer) => layer.id)).toEqual([
      layerIds.faceId,
      layerIds.backingId,
    ]);
    expect(manifest.layers.some((layer) => layer.id === layerIds.previewId)).toBe(false);
    expect(manifest.layers.map((layer) => layer.registrationHoles.map((hole) => hole.objectId))).toEqual([
      [layerIds.faceHoleId],
      [layerIds.coordinatedBackingHoleId],
    ]);
    expect(
      manifest.layers[0]?.registrationHoles.map(({ xMm, yMm, diameterMm }) => ({
        xMm,
        yMm,
        diameterMm,
      })),
    ).toEqual(
      manifest.layers[1]?.registrationHoles.map(({ xMm, yMm, diameterMm }) => ({
        xMm,
        yMm,
        diameterMm,
      })),
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
      document: {
        layers: { manufacturing?: { role: string; registrationHoleIds: string[] } }[];
      };
    };
    expect(saved.document.layers.map((layer) => layer.manufacturing?.role)).toEqual([
      "face",
      "backing",
      "non-cut-preview",
    ]);
    expect(saved.document.layers.map((layer) => layer.manufacturing?.registrationHoleIds)).toEqual([
      [layerIds.faceHoleId],
      [layerIds.coordinatedBackingHoleId],
      [],
    ]);

    const reopenedRegistrationIds = await page.evaluate(async (filePath) => {
      await window.laserx.newProject();
      await window.laserx.openRecent({ filePath });
      return (await window.laserx.getState()).project.document.layers.map(
        (layer) => layer.manufacturing?.registrationHoleIds,
      );
    }, launched.projectPath);
    expect(reopenedRegistrationIds).toEqual([
      [layerIds.faceHoleId],
      [layerIds.coordinatedBackingHoleId],
      [],
    ]);
  } finally {
    await killAndRemove(launched);
  }
});
