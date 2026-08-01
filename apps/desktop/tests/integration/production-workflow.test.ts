import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  DesktopController,
  type DesktopDialogs,
} from "../../electron/desktop-controller.js";

const directories: string[] = [];
const controllers: DesktopController[] = [];

afterEach(async () => {
  controllers.splice(0).forEach((controller) => controller.stop());
  await Promise.all(
    directories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("layered production workflow", () => {
  it("persists semantic layers, keeps analysis scopes distinct, and exports a validated package", async () => {
    const directory = await mkdtemp(join(tmpdir(), "laserx-production-workflow-"));
    directories.push(directory);
    const projectPath = join(directory, "layered.laserx");
    const packagePath = join(directory, "layered-production");
    const dialogs: DesktopDialogs = {
      chooseOpenProject: () => Promise.resolve(projectPath),
      chooseSaveProject: () => Promise.resolve(projectPath),
      confirmUnsavedChanges: () => Promise.resolve("discard"),
      chooseProductionDirectory: () => Promise.resolve(packagePath),
    };
    const controller = new DesktopController({
      userDataPath: join(directory, "user-data"),
      dialogs,
      onStateChanged: () => undefined,
    });
    controllers.push(controller);
    await controller.initialize();

    const faceId = controller.state.project.document.activeLayerId;
    await controller.editorAction({ type: "object.create", objectType: "rectangle" });
    await controller.editorAction({ type: "object.create", objectType: "ellipse" });
    const faceDecorativeOneId = controller.state.editor.selectionIds[0] as string;
    await controller.editorAction({ type: "object.create", objectType: "ellipse" });
    const faceDecorativeTwoId = controller.state.editor.selectionIds[0] as string;
    await controller.editorAction({ type: "object.create", objectType: "ellipse" });
    const faceHoleId = controller.state.editor.selectionIds[0] as string;
    await controller.editorAction({
      type: "layer.set-manufacturing",
      layerId: faceId,
      manufacturing: {
        role: "face",
        material: "mild-steel",
        thicknessMm: 3,
        process: "laser",
        notes: "Powder coat black",
        registrationGroup: "main",
        registrationHoleIds: [faceHoleId],
      },
    });
    await controller.editorAction({ type: "layer.create", name: "Backing" });
    const backingId = controller.state.project.document.activeLayerId;
    await controller.editorAction({ type: "object.create", objectType: "rectangle" });
    await controller.editorAction({ type: "object.create", objectType: "ellipse" });
    const backingDecorativeOneId = controller.state.editor.selectionIds[0] as string;
    await controller.editorAction({ type: "object.create", objectType: "ellipse" });
    const backingDecorativeTwoId = controller.state.editor.selectionIds[0] as string;
    await controller.editorAction({ type: "object.create", objectType: "ellipse" });
    const originalBackingHoleId = controller.state.editor.selectionIds[0] as string;
    await controller.editorAction({
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

    const beforeCoordination = JSON.stringify(controller.state.project);
    await controller.editorAction({
      type: "layers.coordinate-registration",
      sourceLayerId: faceId,
      targetLayerId: backingId,
    });
    const afterCoordination = JSON.stringify(controller.state.project);
    const coordinatedBacking = controller.state.project.document.layers.find(
      (layer) => layer.id === backingId,
    );
    const coordinatedBackingHoleId = coordinatedBacking?.manufacturing
      ?.registrationHoleIds[0] as string;
    expect(
      controller.state.project.document.objects
        .filter((object) => object.layerId === backingId)
        .map((object) => object.id),
    ).toEqual(expect.arrayContaining([
      backingDecorativeOneId,
      backingDecorativeTwoId,
      coordinatedBackingHoleId,
    ]));
    expect(
      controller.state.project.document.objects.some(
        (object) => object.id === originalBackingHoleId,
      ),
    ).toBe(false);
    expect(
      controller.state.project.document.objects.some(
        (object) => object.id === faceDecorativeOneId || object.id === faceDecorativeTwoId,
      ),
    ).toBe(true);
    await controller.editorAction({ type: "history.undo" });
    expect(JSON.stringify(controller.state.project)).toBe(beforeCoordination);
    await controller.editorAction({ type: "history.redo" });
    expect(JSON.stringify(controller.state.project)).toBe(afterCoordination);

    await controller.runCutabilityAnalysis(
      "11111111-1111-4111-8111-111111111111",
      [],
    );
    expect(controller.state.analysis.scope).toEqual({
      kind: "whole-design",
      layerId: null,
      layerName: null,
    });
    await controller.runManufacturingLayerAnalysis(
      "22222222-2222-4222-8222-222222222222",
      backingId,
    );
    expect(controller.state.analysis.scope).toEqual({
      kind: "manufacturing-layer",
      layerId: backingId,
      layerName: "Backing",
    });

    const exported = await controller.exportProductionPackage({
      layerIds: [faceId, backingId],
      formats: ["svg", "dxf"],
      conflictPolicy: "fail",
    });
    expect(exported.ok).toBe(true);
    expect(exported.state.production.exportSummary).toMatchObject({
      status: "success",
      layerCount: 2,
      fileCount: 5,
    });
    const manifest = JSON.parse(
      await readFile(join(packagePath, "manifest.json"), "utf8"),
    ) as {
      sourceProjectVersion: number;
      layers: { role: string; registrationHoles: { objectId: string }[] }[];
    };
    expect(manifest.sourceProjectVersion).toBe(8);
    expect(manifest.layers.map((layer) => layer.role)).toEqual(["face", "backing"]);
    expect(manifest.layers.map((layer) => layer.registrationHoles.map((hole) => hole.objectId))).toEqual([
      [faceHoleId],
      [coordinatedBackingHoleId],
    ]);

    await controller.saveProjectAs();
    await controller.newProject();
    await controller.openRecent(projectPath);
    expect(
      controller.state.project.document.layers.map((layer) => layer.manufacturing?.role),
    ).toEqual(["face", "backing"]);
    expect(
      controller.state.project.document.layers.map(
        (layer) => layer.manufacturing?.registrationHoleIds,
      ),
    ).toEqual([[faceHoleId], [coordinatedBackingHoleId]]);
  });

  it("publishes a failed command and zero files when package storage is partial", async () => {
    const directory = await mkdtemp(join(tmpdir(), "laserx-production-failure-"));
    directories.push(directory);
    const controller = new DesktopController({
      userDataPath: join(directory, "user-data"),
      dialogs: {
        chooseOpenProject: () => Promise.resolve(null),
        chooseSaveProject: () => Promise.resolve(null),
        confirmUnsavedChanges: () => Promise.resolve("discard"),
        chooseProductionDirectory: () => Promise.resolve(join(directory, "failed")),
      },
      productionStorage: {
        write: () => Promise.resolve({
          ok: false,
          targetDirectory: join(directory, "failed"),
          writtenFiles: ["01-face-layer-1.svg"],
          failedFile: "01-face-layer-1.dxf",
          error: "Injected partial write failure.",
        }),
      },
      onStateChanged: () => undefined,
    });
    controllers.push(controller);
    await controller.initialize();
    const layerId = controller.state.project.document.activeLayerId;
    await controller.editorAction({ type: "object.create", objectType: "rectangle" });
    await controller.editorAction({
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

    const result = await controller.exportProductionPackage({
      layerIds: [layerId],
      formats: ["svg", "dxf"],
      conflictPolicy: "fail",
    });
    expect(result.ok).toBe(false);
    expect(result.state.production.exportSummary).toMatchObject({
      status: "failed",
      fileCount: 0,
      failedFile: "01-face-layer-1.dxf",
      error: "Injected partial write failure.",
    });
  });
});
