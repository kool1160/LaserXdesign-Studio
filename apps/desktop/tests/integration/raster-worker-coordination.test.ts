import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { RasterTraceCandidate, RasterTraceSettings } from "@laserx/domain";
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
import type {
  RasterCodecPort,
  RasterPreviewDataUrls,
} from "../../electron/raster-codec.js";
import type { RasterFileService } from "../../electron/raster-storage.js";
import {
  RasterTraceCancelledError,
  type RasterWorkerPort,
} from "../../electron/raster-worker-service.js";

const OPERATION_ID = "60000000-0000-4000-8000-000000000071";
const temporaryDirectories: string[] = [];
const controllers: DesktopController[] = [];

const settings: RasterTraceSettings = {
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

function candidate(request: RasterTraceTaskRequest): RasterTraceCandidate {
  const points = [
    { xMm: 10, yMm: 10 },
    { xMm: 70, yMm: 10 },
    { xMm: 70, yMm: 50 },
    { xMm: 10, yMm: 50 },
  ];
  return {
    source: { ...request.source },
    settings: { ...request.settings, crop: { ...request.settings.crop } },
    paths: [{ layerName: "Raster Trace", closed: true, points }],
    warnings: [
      {
        code: "trace-requires-cutability-analysis",
        message: "Cutability review required.",
        source: null,
      },
    ],
    assumptions: ["Square pixels."],
    summary: {
      engineId: "test-trace",
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
      removedSpeckleCount: 1,
      removedSpeckleAreaPx: 2,
      simplificationToleranceMm: 0.2,
      bounds: { minXmm: 10, minYmm: 10, maxXmm: 70, maxYmm: 50 },
    },
  };
}

function result(request: RasterTraceTaskRequest): RasterTraceTaskResult {
  const pixels = new Uint8Array(16).fill(255);
  return {
    operationId: request.operationId,
    candidate: candidate(request),
    preview: {
      widthPx: 2,
      heightPx: 2,
      originalRgba: pixels.slice(),
      blackWhiteRgba: pixels.slice(),
      edgeRgba: pixels.slice(),
    },
  };
}

const rasterStorage: RasterFileService = {
  read: () => Promise.resolve(pngHeader()),
};

const rasterCodec: RasterCodecPort = {
  decode: (): DecodedRaster => ({
    widthPx: 8,
    heightPx: 8,
    rgba: new Uint8Array(8 * 8 * 4).fill(255),
  }),
  encodePreview: (): RasterPreviewDataUrls => ({
    widthPx: 2,
    heightPx: 2,
    original: "data:image/png;base64,AA==",
    blackWhite: "data:image/png;base64,AA==",
    edges: "data:image/png;base64,AA==",
  }),
};

async function desktop(worker: RasterWorkerPort): Promise<DesktopController> {
  const directory = await mkdtemp(join(tmpdir(), "laserx-raster-worker-"));
  temporaryDirectories.push(directory);
  const dialogs: DesktopDialogs = {
    chooseOpenProject: () => Promise.resolve(null),
    chooseSaveProject: () => Promise.resolve(null),
    confirmUnsavedChanges: () => Promise.resolve("discard"),
    chooseImportRaster: () => Promise.resolve(join(directory, "clean-logo.png")),
  };
  const controller = new DesktopController({
    userDataPath: directory,
    dialogs,
    onStateChanged: () => undefined,
    rasterStorage,
    rasterCodec,
    rasterWorker: worker,
  });
  controllers.push(controller);
  await controller.initialize();
  return controller;
}

afterEach(async () => {
  for (const controller of controllers.splice(0)) controller.stop();
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("raster worker coordination", () => {
  it("previews without mutation, accepts once, enters analysis, and undoes exactly", async () => {
    const worker: RasterWorkerPort = {
      run: (request, _signal, onProgress) => {
        onProgress({ operationId: request.operationId, percent: 55, stage: "tracing" });
        return Promise.resolve(result(request));
      },
    };
    const controller = await desktop(worker);
    const before = JSON.stringify(controller.state.project.document);

    const previewed = await controller.previewRasterTrace({
      operationId: OPERATION_ID,
      settings,
    });
    expect(previewed.ok).toBe(true);
    expect(JSON.stringify(controller.state.project.document)).toBe(before);
    expect(controller.state.dirty).toBe(false);
    expect(controller.state.editor.history.undoDepth).toBe(0);
    expect(controller.state.editor.rasterTracePreview).toMatchObject({
      sourceName: "clean-logo.png",
      summary: { pathCount: 1, nodeCount: 4 },
    });
    expect(controller.state.raster.preview?.original).toMatch(/^data:image\/png/u);

    await controller.acceptRasterTrace();
    expect(controller.state.project.document.objects[0]).toMatchObject({
      type: "path",
      closed: true,
    });
    expect(controller.state.editor.history.undoDepth).toBe(1);
    expect(controller.state.analysis.cutability).toMatchObject({
      status: "requires-settings",
      pathCount: 1,
      cutReady: false,
    });

    await controller.editorAction({ type: "history.undo" });
    expect(JSON.stringify(controller.state.project.document)).toBe(before);
    expect(controller.state.analysis.cutability).toBeNull();
  });

  it("terminates cancellation and leaves project, dirty state, and history unchanged", async () => {
    let started: (() => void) | null = null;
    const startedPromise = new Promise<void>((resolve) => {
      started = resolve;
    });
    const worker: RasterWorkerPort = {
      run: (_request, signal) =>
        new Promise((_resolve, reject) => {
          started?.();
          signal.addEventListener(
            "abort",
            () => reject(new RasterTraceCancelledError()),
            { once: true },
          );
        }),
    };
    const controller = await desktop(worker);
    const before = JSON.stringify(controller.state.project.document);
    const running = controller.previewRasterTrace({ operationId: OPERATION_ID, settings });
    await startedPromise;
    await controller.cancelRasterTrace(OPERATION_ID);
    const finished = await running;

    expect(finished.ok).toBe(true);
    expect(JSON.stringify(controller.state.project.document)).toBe(before);
    expect(controller.state.dirty).toBe(false);
    expect(controller.state.editor.history.undoDepth).toBe(0);
    expect(controller.state.editor.rasterTracePreview).toBeNull();
  });

  it("rejects a completed stale result after another document command", async () => {
    let complete: (value: RasterTraceTaskResult) => void = () => {
      throw new Error("Worker completion was not initialized.");
    };
    const captured: { request: RasterTraceTaskRequest | null } = { request: null };
    const worker: RasterWorkerPort = {
      run: (request) => {
        captured.request = request;
        return new Promise((resolve) => {
          complete = resolve;
        });
      },
    };
    const controller = await desktop(worker);
    const running = controller.previewRasterTrace({ operationId: OPERATION_ID, settings });
    while (captured.request === null) await Promise.resolve();
    await controller.editorAction({ type: "object.create", objectType: "rectangle" });
    complete(result(captured.request));
    const finished = await running;

    expect(finished).toMatchObject({ ok: false });
    expect(controller.state.editor.rasterTracePreview).toBeNull();
    expect(controller.state.project.document.objects).toHaveLength(1);
    expect(controller.state.editor.history.undoDepth).toBe(1);
  });
});
