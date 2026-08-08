import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { fingerprintGeometryDocument } from "@laserx/application";
import { analyzeDocumentCutability } from "@laserx/cutability";
import type { ManufacturingLayerMetadata, RasterTraceCandidate, RasterTraceSettings } from "@laserx/domain";
import type {
  DecodedRaster,
  RasterTraceTaskRequest,
  RasterTraceTaskResult,
} from "@laserx/import-raster";
import { afterEach, describe, expect, it } from "vitest";

import {
  DesktopController,
  type DesktopDialogs,
} from "../../electron/desktop-controller.js";
import type { CutabilityWorkerPort } from "../../electron/cutability-worker-service.js";
import type { PhysicalPreviewWorkerPort } from "../../electron/physical-preview-worker-service.js";
import type {
  RasterCodecPort,
  RasterPreviewDataUrls,
} from "../../electron/raster-codec.js";
import type { RasterFileService } from "../../electron/raster-storage.js";
import type { RasterWorkerPort } from "../../electron/raster-worker-service.js";
import type {
  VectorFileFormat,
  VectorFileService,
} from "../../electron/vector-storage.js";
import { runPhysicalPreviewTask } from "../../../../packages/physical-preview-3d/src/task.js";

const VECTOR_SOURCE =
  '<svg width="120mm" height="70mm" viewBox="0 0 120 70"><g data-layer="Cut"><polygon points="10,10 110,10 110,60 10,60"/></g></svg>';
const RASTER_OPERATION_ID = "d0000000-0000-4000-8000-000000000001";
const ANALYSIS_OPERATION_ID = "d0000000-0000-4000-8000-000000000002";
const PREVIEW_OPERATION_ID = "d0000000-0000-4000-8000-000000000003";
const directories: string[] = [];
const controllers: DesktopController[] = [];

const rasterSettings: RasterTraceSettings = {
  preset: "balanced",
  outputWidthMm: 80,
  crop: { left: 0, top: 0, right: 0, bottom: 0 },
  rotationDeg: 0,
  grayscaleMode: "luminance",
  contrast: 0,
  threshold: 128,
  invert: false,
  blurRadiusPx: 1,
  denoiseRadiusPx: 1,
  background: "auto",
  speckleAreaPx: 6,
  smoothingPasses: 1,
  simplificationToleranceMm: 0.2,
};

class MemoryVectorStorage implements VectorFileService {
  public readonly writes: Array<{
    filePath: string;
    contents: string;
    format: VectorFileFormat;
  }> = [];

  public read(): Promise<string> {
    return Promise.resolve(VECTOR_SOURCE);
  }

  public write(
    filePath: string,
    contents: string,
    format: VectorFileFormat,
  ): Promise<void> {
    this.writes.push({ filePath, contents, format });
    return Promise.resolve();
  }
}

function pngHeader(): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  bytes.set([0, 0, 0, 13, 73, 72, 68, 82], 8);
  new DataView(bytes.buffer).setUint32(16, 8);
  new DataView(bytes.buffer).setUint32(20, 8);
  bytes[24] = 8;
  bytes[25] = 6;
  return bytes;
}

function decodedRaster(): DecodedRaster {
  return {
    widthPx: 8,
    heightPx: 8,
    rgba: new Uint8Array(8 * 8 * 4).fill(255),
  };
}

function encodedPreview(): RasterPreviewDataUrls {
  return {
    widthPx: 2,
    heightPx: 2,
    original: "data:image/png;base64,AA==",
    blackWhite: "data:image/png;base64,AA==",
    edges: "data:image/png;base64,AA==",
  };
}

function rasterCandidate(request: RasterTraceTaskRequest): RasterTraceCandidate {
  return {
    source: { ...request.source },
    settings: { ...request.settings, crop: { ...request.settings.crop } },
    paths: [
      {
        layerName: "Raster Trace",
        closed: true,
        points: [
          { xMm: 10, yMm: 10 },
          { xMm: 70, yMm: 10 },
          { xMm: 70, yMm: 50 },
          { xMm: 10, yMm: 50 },
        ],
      },
    ],
    warnings: [],
    assumptions: ["Square pixels."],
    summary: {
      engineId: "guided-test-trace",
      engineVersion: "1",
      sourceWidthPx: 8,
      sourceHeightPx: 8,
      traceWidthPx: 8,
      traceHeightPx: 8,
      outputWidthMm: 80,
      outputHeightMm: 80,
      pathCount: 1,
      nodeCount: 4,
      sourceBoundaryNodeCount: 16,
      smallestFeatureMm: 40,
      speckleThresholdPx: 6,
      removedSpeckleCount: 0,
      removedSpeckleAreaPx: 0,
      simplificationToleranceMm: 0.2,
      bounds: { minXmm: 10, minYmm: 10, maxXmm: 70, maxYmm: 50 },
    },
  };
}

function rasterResult(request: RasterTraceTaskRequest): RasterTraceTaskResult {
  const pixels = new Uint8Array(16).fill(255);
  return {
    operationId: request.operationId,
    candidate: rasterCandidate(request),
    preview: {
      widthPx: 2,
      heightPx: 2,
      originalRgba: pixels.slice(),
      blackWhiteRgba: pixels.slice(),
      edgeRgba: pixels.slice(),
    },
  };
}

const cutabilityWorker: CutabilityWorkerPort = {
  run: (request) => Promise.resolve(analyzeDocumentCutability(
    request.document,
    { operationId: request.operationId, objectIds: request.objectIds },
  )),
};
const physicalPreviewWorker: PhysicalPreviewWorkerPort = {
  run: (request) => Promise.resolve(runPhysicalPreviewTask(request)),
};
const rasterStorage: RasterFileService = {
  read: () => Promise.resolve(pngHeader()),
};
const rasterCodec: RasterCodecPort = {
  decode: decodedRaster,
  encodePreview: encodedPreview,
};
const rasterWorker: RasterWorkerPort = {
  run: (request) => Promise.resolve(rasterResult(request)),
};

interface Fixture {
  directory: string;
  userDataPath: string;
  projectPath: string;
  exportPath: string;
  vectorPath: string;
  rasterPath: string;
}

async function fixture(): Promise<Fixture> {
  const directory = await mkdtemp(join(tmpdir(), "laserx-guided-import-"));
  directories.push(directory);
  return {
    directory,
    userDataPath: join(directory, "user-data"),
    projectPath: join(directory, "guided-import.laserx"),
    exportPath: join(directory, "guided-import.svg"),
    vectorPath: join(directory, "artwork.svg"),
    rasterPath: join(directory, "artwork.png"),
  };
}

function controllerFor(
  paths: Fixture,
  sourcePath: string,
  storage = new MemoryVectorStorage(),
): { controller: DesktopController; storage: MemoryVectorStorage } {
  const dialogs: DesktopDialogs = {
    chooseOpenProject: () => Promise.resolve(paths.projectPath),
    chooseSaveProject: () => Promise.resolve(paths.projectPath),
    chooseImportSource: () => Promise.resolve(sourcePath),
    chooseExportVector: () => Promise.resolve(paths.exportPath),
    confirmUnsavedChanges: () => Promise.resolve("discard"),
  };
  const controller = new DesktopController({
    userDataPath: paths.userDataPath,
    dialogs,
    vectorStorage: storage,
    rasterStorage,
    rasterCodec,
    rasterWorker,
    cutabilityWorker,
    physicalPreviewWorker,
    onStateChanged: () => undefined,
  });
  controllers.push(controller);
  return { controller, storage };
}

function activeIdentity(controller: DesktopController): {
  expectedStepId: string;
  runToken: string;
} {
  const workflow = controller.state.onboarding.workflow;
  expect(workflow.status).toBe("active");
  expect(workflow.currentStepId).not.toBeNull();
  expect(workflow.runToken).not.toBeNull();
  return {
    expectedStepId: workflow.currentStepId as string,
    runToken: workflow.runToken as string,
  };
}

function faceManufacturing(
  material: ManufacturingLayerMetadata["material"] = "mild-steel",
): ManufacturingLayerMetadata {
  return {
    role: "face",
    material,
    thicknessMm: 3,
    process: "laser",
    notes: "",
    registrationGroup: null,
    registrationHoleIds: [],
  };
}

async function startImport(controller: DesktopController): Promise<void> {
  expect(await controller.onboardingAction({
    type: "start",
    goal: "import-own-design",
  })).toMatchObject({ ok: true });
  expect(controller.state.onboarding.workflow.currentStepId).toBe("choose-file");
}

afterEach(async () => {
  for (const controller of controllers.splice(0)) controller.stop();
  await Promise.all(directories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })));
});

describe("Import My Own Design guidance", () => {
  it("keeps vector selection provisional, rejects a stale commit, and cancels back without losing unrelated work", async () => {
    const paths = await fixture();
    const { controller } = controllerFor(paths, paths.vectorPath);
    await controller.initialize();
    await startImport(controller);
    const originalFingerprint = fingerprintGeometryDocument(
      controller.state.project.document,
    );
    expect(await controller.previewVectorImport({ unitlessDxfUnit: null })).toMatchObject({
      ok: false,
    });
    expect(await controller.previewRasterTrace({
      operationId: RASTER_OPERATION_ID,
      settings: rasterSettings,
    })).toMatchObject({ ok: false });

    expect(await controller.selectImportSource({ unitlessDxfUnit: null })).toMatchObject({
      ok: true,
    });
    expect(controller.state.onboarding.workflow.currentStepId).toBe("prepare-source");
    expect(controller.state.interchange.sourceSelection).toMatchObject({
      kind: "vector",
      format: "svg",
      sourceName: "artwork.svg",
    });
    expect(controller.state.editor.importPreview).not.toBeNull();
    expect(controller.state.editor.rasterTracePreview).toBeNull();
    expect(await controller.previewRasterTrace({
      operationId: RASTER_OPERATION_ID,
      settings: rasterSettings,
    })).toMatchObject({ ok: false });
    expect(fingerprintGeometryDocument(controller.state.project.document)).toBe(
      originalFingerprint,
    );
    expect(controller.state.dirty).toBe(false);

    await controller.editorAction({ type: "object.create", objectType: "line" });
    const unrelatedFingerprint = fingerprintGeometryDocument(
      controller.state.project.document,
    );
    const staleCommit = await controller.commitVectorImport();
    expect(staleCommit).toMatchObject({ ok: false });
    expect(controller.state.onboarding.workflow.currentStepId).toBe("prepare-source");
    expect(controller.state.project.document.objects).toHaveLength(1);

    expect(await controller.cancelVectorImport()).toMatchObject({ ok: true });
    expect(controller.state.onboarding.workflow.currentStepId).toBe("choose-file");
    expect(controller.state.interchange.sourceSelection).toBeNull();
    expect(controller.state.editor.importPreview).toBeNull();
    expect(fingerprintGeometryDocument(controller.state.project.document)).toBe(
      unrelatedFingerprint,
    );
  });

  it("reveals raster tracing only after selection and rejects or accepts without false advancement", async () => {
    const paths = await fixture();
    const { controller } = controllerFor(paths, paths.rasterPath);
    await controller.initialize();
    await startImport(controller);
    const before = fingerprintGeometryDocument(controller.state.project.document);

    await controller.selectImportSource({ unitlessDxfUnit: null });
    expect(controller.state.onboarding.workflow.currentStepId).toBe("prepare-source");
    expect(controller.state.interchange.sourceSelection).toMatchObject({
      kind: "raster",
      format: "png",
      widthPx: 8,
      heightPx: 8,
    });
    expect(controller.state.editor.importPreview).toBeNull();
    expect(controller.state.editor.rasterTracePreview).toBeNull();
    expect(await controller.previewVectorImport({ unitlessDxfUnit: null })).toMatchObject({
      ok: false,
    });

    await controller.rejectRasterTrace();
    expect(controller.state.onboarding.workflow.currentStepId).toBe("choose-file");
    expect(fingerprintGeometryDocument(controller.state.project.document)).toBe(before);

    await controller.selectImportSource({ unitlessDxfUnit: null });
    expect(await controller.previewRasterTrace({
      operationId: RASTER_OPERATION_ID,
      settings: rasterSettings,
    })).toMatchObject({ ok: true });
    expect(controller.state.onboarding.workflow.currentStepId).toBe("prepare-source");
    expect(controller.state.editor.rasterTracePreview).not.toBeNull();
    expect(fingerprintGeometryDocument(controller.state.project.document)).toBe(before);

    await controller.acceptRasterTrace();
    expect(controller.state.onboarding.workflow.currentStepId).toBe("assign-physical");
    expect(controller.state.interchange.sourceSelection).toBeNull();
    expect(controller.state.editor.rasterTracePreview).toBeNull();
    expect(controller.state.project.document.objects).toMatchObject([
      { type: "path", closed: true },
    ]);
  });

  it("resumes a transient source preview at the stable source-selection checkpoint", async () => {
    const paths = await fixture();
    const first = controllerFor(paths, paths.vectorPath).controller;
    await first.initialize();
    await first.saveProjectAs();
    await startImport(first);
    await first.selectImportSource({ unitlessDxfUnit: null });
    expect(first.state.onboarding.workflow.currentStepId).toBe("prepare-source");
    first.stop();

    const second = controllerFor(paths, paths.vectorPath).controller;
    await second.initialize();
    await second.openProject();
    expect(second.state.onboarding.resumeEligibility).toBe("available");
    await second.onboardingAction({ type: "resume" });
    expect(second.state.onboarding.workflow.currentStepId).toBe("choose-file");
    expect(second.state.onboarding.recoveryNotice).toContain(
      "nearest saved checkpoint",
    );
    expect(second.state.interchange.sourceSelection).toBeNull();
    expect(second.state.editor.importPreview).toBeNull();
  });

  it("completes vector import only through physical metadata, whole-design analysis, current 3D, and real export", async () => {
    const paths = await fixture();
    const { controller, storage } = controllerFor(paths, paths.vectorPath);
    await controller.initialize();
    await startImport(controller);
    await controller.selectImportSource({ unitlessDxfUnit: "millimeters" });
    await controller.commitVectorImport();
    expect(controller.state.onboarding.workflow.currentStepId).toBe("assign-physical");

    const importedObject = controller.state.project.document.objects[0];
    expect(importedObject).toBeDefined();
    const layerId = importedObject?.layerId as string;
    await controller.editorAction({
      type: "layer.set-manufacturing",
      layerId,
      manufacturing: faceManufacturing(),
    });
    expect(controller.state.onboarding.workflow.currentStepId).toBe(
      "analyze-cutability",
    );

    await controller.runCutabilityAnalysis(
      `${ANALYSIS_OPERATION_ID.slice(0, -1)}3`,
      [importedObject?.id as string],
    );
    expect(controller.state.analysis.scope?.kind).toBe("selection");
    expect(controller.state.onboarding.workflow.currentStepId).toBe(
      "analyze-cutability",
    );
    const rejectedSelection = await controller.onboardingAction({
      type: "advance",
      ...activeIdentity(controller),
      completion: { kind: "step" },
    });
    expect(rejectedSelection).toMatchObject({ ok: false });

    await controller.runCutabilityAnalysis(ANALYSIS_OPERATION_ID, []);
    expect(controller.state.analysis.scope?.kind).toBe("whole-design");
    expect(controller.state.onboarding.workflow.currentStepId).toBe(
      "physical-preview",
    );
    await controller.runPhysicalPreview(PREVIEW_OPERATION_ID);
    const staleAssembly = controller.state.physicalPreview.assembly;
    expect(staleAssembly).not.toBeNull();

    await controller.editorAction({
      type: "layer.set-manufacturing",
      layerId,
      manufacturing: faceManufacturing("acrylic"),
    });
    expect(controller.state.analysis.cutability).toBeNull();
    expect(controller.state.physicalPreview.assembly).toBeNull();
    const stalePreview = await controller.onboardingAction({
      type: "advance",
      ...activeIdentity(controller),
      completion: {
        kind: "physical-preview",
        result: "rendered",
        assemblyFingerprint: staleAssembly?.fingerprint as string,
      },
    });
    expect(stalePreview).toMatchObject({ ok: false });

    await controller.runCutabilityAnalysis(
      `${ANALYSIS_OPERATION_ID.slice(0, -1)}4`,
      [],
    );
    await controller.runPhysicalPreview(
      `${PREVIEW_OPERATION_ID.slice(0, -1)}4`,
    );
    const currentAssembly = controller.state.physicalPreview.assembly;
    expect(currentAssembly).not.toBeNull();
    expect(await controller.onboardingAction({
      type: "advance",
      ...activeIdentity(controller),
      completion: {
        kind: "physical-preview",
        result: "rendered",
        assemblyFingerprint: currentAssembly?.fingerprint as string,
      },
    })).toMatchObject({ ok: true });
    expect(controller.state.onboarding.workflow.currentStepId).toBe("export-result");

    await controller.editorAction({
      type: "layer.set-manufacturing",
      layerId,
      manufacturing: faceManufacturing("wood"),
    });
    const staleExport = await controller.exportVector({ format: "svg" });
    expect(staleExport).toMatchObject({ ok: false });
    expect(storage.writes).toHaveLength(0);

    await controller.editorAction({ type: "history.undo" });
    expect(await controller.saveProjectAs()).toMatchObject({ ok: true });
    expect(await controller.exportVector({ format: "svg" })).toMatchObject({ ok: true });
    expect(storage.writes).toHaveLength(1);
    expect(storage.writes[0]?.contents).toContain("<svg");
    expect(controller.state.onboarding.workflow.status).toBe("completed");
    expect(controller.state.onboarding.preferences.completedGoals).toContain(
      "import-own-design",
    );
  });
});
