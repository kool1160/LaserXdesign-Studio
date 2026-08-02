import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { analyzeDocumentCutability } from "@laserx/cutability";
import type { AiProvider } from "@laserx/ai";
import type { RasterTraceCandidate } from "@laserx/domain";
import { createFontSource, FontEngine } from "@laserx/fonts";
import type {
  DecodedRaster,
  RasterTraceTaskRequest,
  RasterTraceTaskResult,
} from "@laserx/import-raster";
import { afterEach, describe, expect, it } from "vitest";

import {
  DeterministicAiProvider,
  FixedCredentialAcquisition,
  MemoryCredentialVault,
} from "../../electron/ai-test-provider.js";
import type { CredentialAcquisitionPort } from "../../electron/ai-credentials.js";
import type { CutabilityWorkerPort } from "../../electron/cutability-worker-service.js";
import {
  DesktopController,
  type DesktopDialogs,
} from "../../electron/desktop-controller.js";
import type { RasterCodecPort } from "../../electron/raster-codec.js";
import type { RasterWorkerPort } from "../../electron/raster-worker-service.js";

const OPERATION_ID = "a1000000-0000-4000-8000-000000000001";
const CREDENTIAL = "laserx-test-credential-placeholder";
const temporaryDirectories: string[] = [];
const controllers: DesktopController[] = [];

const fontBytes = readFileSync(new URL(
  "../../../../packages/fonts/node_modules/@fontsource-variable/noto-sans/files/noto-sans-latin-wght-normal.woff2",
  import.meta.url,
));

function testFontEngine(): FontEngine {
  return new FontEngine([
    ["bundled:saira-stencil-one", "Saira Stencil One"],
    ["bundled:roboto-slab", "Roboto Slab"],
    ["bundled:rye", "Rye"],
  ].map(([id, family]) => createFontSource({
    id: id as string,
    family: family as string,
    style: "Regular",
    source: "bundled",
    categories: ["industrial"],
    license: {
      spdx: "OFL-1.1",
      copyright: "Test fixture derived from Noto Sans.",
      licenseFile: "packages/fonts/licenses/OFL-1.1.txt",
      provenance: "integration-test-fixture",
    },
  }, fontBytes)));
}

const cutabilityWorker: CutabilityWorkerPort = {
  run: (request, _signal, onProgress) => {
    onProgress?.({ operationId: request.operationId, percent: 100, stage: "classifying" });
    return Promise.resolve(analyzeDocumentCutability(request.document, {
      operationId: request.operationId,
      objectIds: request.objectIds,
    }));
  },
};

async function desktop(options: {
  aiProvider?: AiProvider;
  credential?: string | null;
  delayMs?: number;
  rasterCodec?: RasterCodecPort;
  rasterWorker?: RasterWorkerPort;
  cutabilityWorker?: CutabilityWorkerPort;
  credentialAcquisition?: CredentialAcquisitionPort;
  credentialConnectionTimeoutMs?: number;
} = {}): Promise<{ controller: DesktopController; vault: MemoryCredentialVault }> {
  const directory = await mkdtemp(join(tmpdir(), "laserx-ai-generation-"));
  temporaryDirectories.push(directory);
  const dialogs: DesktopDialogs = {
    chooseOpenProject: () => Promise.resolve(null),
    chooseSaveProject: () => Promise.resolve(null),
    confirmUnsavedChanges: () => Promise.resolve("discard"),
  };
  const vault = new MemoryCredentialVault(
    Object.hasOwn(options, "credential") ? options.credential ?? null : CREDENTIAL,
  );
  const controller = new DesktopController({
    userDataPath: directory,
    dialogs,
    onStateChanged: () => undefined,
    fontEngine: testFontEngine(),
    cutabilityWorker: options.cutabilityWorker ?? cutabilityWorker,
    aiProvider: options.aiProvider ?? new DeterministicAiProvider(options.delayMs ?? 0),
    credentialVault: vault,
    credentialAcquisition:
      options.credentialAcquisition ?? new FixedCredentialAcquisition(CREDENTIAL),
    ...(options.credentialConnectionTimeoutMs === undefined
      ? {}
      : { credentialConnectionTimeoutMs: options.credentialConnectionTimeoutMs }),
    ...(options.rasterCodec === undefined ? {} : { rasterCodec: options.rasterCodec }),
    ...(options.rasterWorker === undefined ? {} : { rasterWorker: options.rasterWorker }),
  });
  controllers.push(controller);
  await controller.initialize();
  return { controller, vault };
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

function rasterCandidate(task: RasterTraceTaskRequest): RasterTraceCandidate {
  return {
    source: { ...task.source },
    settings: { ...task.settings, crop: { ...task.settings.crop } },
    paths: [{
      layerName: "AI Raster Trace",
      closed: true,
      points: [
        { xMm: 0, yMm: 0 },
        { xMm: 80, yMm: 0 },
        { xMm: 80, yMm: 80 },
        { xMm: 0, yMm: 80 },
      ],
    }],
    warnings: [],
    assumptions: ["Square pixels."],
    summary: {
      engineId: "test-ai-raster-trace",
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
      smallestFeatureMm: 80,
      speckleThresholdPx: 6,
      removedSpeckleCount: 0,
      removedSpeckleAreaPx: 0,
      simplificationToleranceMm: 0.2,
      bounds: { minXmm: 0, minYmm: 0, maxXmm: 80, maxYmm: 80 },
    },
  };
}

function request() {
  return {
    operationId: OPERATION_ID,
    prompt: "A restrained industrial sign with exact wording",
    wording: "LASERX",
    widthMm: 609.6,
    heightMm: 304.8,
    style: "industrial" as const,
    process: "laser" as const,
    detailLevel: "balanced" as const,
    bridgePreference: "automatic" as const,
    holes: { enabled: true, diameterMm: 6, insetMm: 25.4 },
    layerCount: 3,
    backingPlate: true,
    conceptCount: 3,
    useReferenceImage: false,
    referenceConsent: false,
  };
}

function gatedCorrectionCutabilityWorker(): {
  worker: CutabilityWorkerPort;
  started: Promise<void>;
  release(): void;
} {
  let callCount = 0;
  let releaseCorrection: () => void = () => undefined;
  let markStarted: () => void = () => undefined;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const worker: CutabilityWorkerPort = {
    run: (analysisRequest, signal, onProgress) => {
      callCount += 1;
      onProgress?.({
        operationId: analysisRequest.operationId,
        percent: 100,
        stage: "classifying",
      });
      const analysis = () => analyzeDocumentCutability(analysisRequest.document, {
        operationId: analysisRequest.operationId,
        objectIds: analysisRequest.objectIds,
      });
      if (callCount !== 4) return Promise.resolve(analysis());
      markStarted();
      return new Promise((resolve, reject) => {
        const abort = () => {
          signal.removeEventListener("abort", abort);
          reject(new DOMException("aborted", "AbortError"));
        };
        releaseCorrection = () => {
          signal.removeEventListener("abort", abort);
          resolve(analysis());
        };
        if (signal.aborted) abort();
        else signal.addEventListener("abort", abort, { once: true });
      });
    },
  };
  return {
    worker,
    started,
    release: () => releaseCorrection(),
  };
}

afterEach(async () => {
  for (const controller of controllers.splice(0)) controller.stop();
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true }),
  ));
});

describe("AI generation coordination", () => {
  it("previews multiple editable concepts, gates wording, accepts once, analyzes, and undoes", async () => {
    const { controller } = await desktop();
    const before = JSON.stringify(controller.state.project.document);

    expect(controller.state.ai.connection.status).toBe("connected");
    const generated = await controller.generateAiConcepts(request());
    if (!generated.ok) throw new Error(generated.error);
    expect(generated).toMatchObject({ ok: true });
    expect(JSON.stringify(controller.state.project.document)).toBe(before);
    expect(controller.state.dirty).toBe(false);
    expect(controller.state.editor.history.undoDepth).toBe(0);
    expect(controller.state.ai.concepts).toHaveLength(3);
    expect(controller.state.editor.aiConceptPreview).toMatchObject({
      summary: {
        id: "mock-concept-1",
        source: "structured-vector",
        wordingMatches: false,
      },
      analysis: { cutReady: false },
      provenanceSaved: false,
    });

    const blocked = await controller.acceptAiConcept();
    expect(blocked.ok).toBe(false);
    expect(JSON.stringify(controller.state.project.document)).toBe(before);

    expect(await controller.correctAiWording(
      "mock-concept-1",
      "LASERX",
      "",
    )).toMatchObject({ ok: true });
    expect(controller.state.editor.aiConceptPreview?.summary.wordingMatches).toBe(true);

    expect(await controller.acceptAiConcept()).toMatchObject({ ok: true });
    expect(controller.state.project.document.objects.length).toBeGreaterThan(0);
    expect(controller.state.editor.history.undoDepth).toBe(1);
    const analysis = controller.state.analysis.cutability;
    expect(analysis).not.toBeNull();
    expect(["complete", "ambiguous"]).toContain(analysis?.status);
    expect(analysis?.cutReady).toBe(false);
    const serializedProject = JSON.stringify(controller.state.project);
    expect(serializedProject).not.toContain("A restrained industrial sign");
    expect(serializedProject).not.toContain("mock-response-m10");

    await controller.editorAction({ type: "history.undo" });
    expect(JSON.stringify(controller.state.project.document)).toBe(before);
    expect(controller.state.analysis.cutability).toBeNull();
  });

  it("discards a wording correction normalized against a project that changed midflight", async () => {
    const gate = gatedCorrectionCutabilityWorker();
    const { controller } = await desktop({ cutabilityWorker: gate.worker });
    const beforeProject = JSON.stringify(controller.state.project);

    expect(await controller.generateAiConcepts(request())).toMatchObject({ ok: true });
    expect(await controller.selectAiConcept("mock-concept-2")).toMatchObject({ ok: true });
    const priorPreview = JSON.stringify(controller.state.editor.aiConceptPreview);
    const correction = controller.correctAiWording("mock-concept-2", "LASERX", "");
    await gate.started;
    expect(controller.state.ai.job).toMatchObject({ stage: "normalizing" });

    expect(await controller.editorAction({
      type: "object.create",
      objectType: "rectangle",
    })).toMatchObject({ ok: true });
    const mutatedProject = JSON.stringify(controller.state.project);
    expect(mutatedProject).not.toBe(beforeProject);
    expect(controller.state.editor.history.undoDepth).toBe(1);
    gate.release();

    const correctionResult = await correction;
    expect(correctionResult.ok).toBe(false);
    if (correctionResult.ok) throw new Error("Expected a stale correction failure.");
    expect(correctionResult.error).toMatch(/stale correction/u);
    expect(JSON.stringify(controller.state.editor.aiConceptPreview)).toBe(priorPreview);
    expect(JSON.stringify(controller.state.project)).toBe(mutatedProject);
    expect(controller.state.editor.history.undoDepth).toBe(1);
    const acceptance = await controller.acceptAiConcept();
    expect(acceptance.ok).toBe(false);
    if (acceptance.ok) throw new Error("Expected stale preview acceptance to fail.");
    expect(acceptance.error).toMatch(/project changed/u);
    expect(JSON.stringify(controller.state.project)).toBe(mutatedProject);

    expect(await controller.editorAction({ type: "history.undo" })).toMatchObject({ ok: true });
    expect(JSON.stringify(controller.state.project)).toBe(beforeProject);
    expect(controller.state.editor.history.undoDepth).toBe(0);
  }, 15_000);

  it("cancels wording normalization without replacing its safe prior preview", async () => {
    const gate = gatedCorrectionCutabilityWorker();
    const { controller } = await desktop({ cutabilityWorker: gate.worker });
    const beforeProject = JSON.stringify(controller.state.project);

    expect(await controller.generateAiConcepts(request())).toMatchObject({ ok: true });
    expect(await controller.selectAiConcept("mock-concept-2")).toMatchObject({ ok: true });
    const priorPreview = JSON.stringify(controller.state.editor.aiConceptPreview);
    const correction = controller.correctAiWording("mock-concept-2", "LASERX", "");
    await gate.started;
    const correctionOperationId = controller.state.ai.job?.operationId;
    if (correctionOperationId === undefined) throw new Error("Expected an active correction job.");

    expect(await controller.cancelAiGeneration(correctionOperationId)).toMatchObject({ ok: true });
    const correctionResult = await correction;
    expect(correctionResult.ok).toBe(false);
    if (correctionResult.ok) throw new Error("Expected a canceled correction failure.");
    expect(correctionResult.error).toMatch(/wording correction was canceled/u);
    expect(controller.state.ai.job).toBeNull();
    expect(JSON.stringify(controller.state.editor.aiConceptPreview)).toBe(priorPreview);
    expect(JSON.stringify(controller.state.project)).toBe(beforeProject);
    expect(controller.state.editor.history.undoDepth).toBe(0);

    expect(await controller.acceptAiConcept()).toMatchObject({ ok: true });
    expect(controller.state.editor.history.undoDepth).toBe(1);
    expect(await controller.editorAction({ type: "history.undo" })).toMatchObject({ ok: true });
    expect(JSON.stringify(controller.state.project)).toBe(beforeProject);
  }, 15_000);

  it("connects, tests, replaces, and disconnects without changing the project", async () => {
    const { controller, vault } = await desktop({ credential: null });
    const before = JSON.stringify(controller.state.project);
    expect(controller.state.ai.connection.status).toBe("disconnected");

    expect(await controller.connectAi()).toMatchObject({ ok: true });
    expect(await vault.read("openai")).toBe(CREDENTIAL);
    expect(await controller.testAiConnection()).toMatchObject({ ok: true });
    expect(await controller.connectAi(true)).toMatchObject({ ok: true });
    expect(await controller.disconnectAi()).toMatchObject({ ok: true });
    expect(await vault.read("openai")).toBeNull();
    expect(controller.state.ai.connection.status).toBe("disconnected");
    expect(JSON.stringify(controller.state.project)).toBe(before);
    expect(controller.state.editor.history.undoDepth).toBe(0);
  });

  it("cancels a waiting credential prompt and restores the prior connection and controls", async () => {
    const waiting: CredentialAcquisitionPort = {
      acquire: (_provider, _replacing, signal) => new Promise((resolve) => {
        signal.addEventListener("abort", () => resolve(null), { once: true });
      }),
    };
    const { controller } = await desktop({
      credential: null,
      credentialAcquisition: waiting,
      credentialConnectionTimeoutMs: 5_000,
    });
    const connection = controller.connectAi();
    await expect.poll(() => controller.state.ai.credentialPrompt.active).toBe(true);
    expect(controller.state.ai.connection.status).toBe("connecting");
    expect(await controller.cancelAiConnection()).toMatchObject({ ok: true });
    const result = await connection;
    expect(result).toMatchObject({ ok: false });
    if (result.ok) throw new Error("Expected credential cancellation to fail the command.");
    expect(result.error).toMatch(/canceled/u);
    expect(controller.state.ai.credentialPrompt.active).toBe(false);
    expect(controller.state.ai.connection.status).toBe("disconnected");
  });

  it("times out an acquisition that ignores cancellation and allows retry", async () => {
    const neverSettles: CredentialAcquisitionPort = {
      acquire: () => new Promise(() => undefined),
    };
    const { controller } = await desktop({
      credential: null,
      credentialAcquisition: neverSettles,
      credentialConnectionTimeoutMs: 20,
    });
    const result = await controller.connectAi();
    expect(result).toMatchObject({ ok: false });
    if (result.ok) throw new Error("Expected credential timeout to fail the command.");
    expect(result.error).toMatch(/timed out/u);
    expect(controller.state.ai.credentialPrompt.active).toBe(false);
    expect(controller.state.ai.connection.status).toBe("disconnected");
    expect((await controller.connectAi()).ok).toBe(false);
  });

  it("restores a working prior connection when replacement validation fails", async () => {
    const failingProvider: AiProvider = {
      id: "openai",
      name: "Failing replacement provider",
      model: "replacement-test-model",
      testConnection: () => Promise.reject(new Error("Replacement key was rejected.")),
      generate: () => Promise.reject(new Error("Not used.")),
    };
    const { controller, vault } = await desktop({ aiProvider: failingProvider });
    expect(controller.state.ai.connection.status).toBe("connected");
    const prior = await vault.read("openai");
    const result = await controller.connectAi(true);
    expect(result).toMatchObject({ ok: false });
    expect(controller.state.ai.connection.status).toBe("connected");
    expect(await vault.read("openai")).toBe(prior);
  });

  it("routes provider raster fallback through the M07 worker and exact requested size", async () => {
    const bytes = pngHeader();
    const dataUrl = `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
    const aiProvider: AiProvider = {
      id: "openai",
      name: "Raster fallback provider",
      model: "raster-test-model",
      testConnection: () => Promise.resolve(),
      generate: (generationRequest) => Promise.resolve({
        providerId: "openai",
        model: "raster-test-model",
        requestId: "raster-response",
        concepts: Array.from({ length: generationRequest.conceptCount }, (_, index) => ({
          id: `raster-concept-${String(index + 1)}`,
          title: `Raster concept ${String(index + 1)}`,
          description: "Provider raster fallback fixture.",
          source: "raster-trace" as const,
          observedWording: generationRequest.wording,
          warnings: [],
          raster: {
            mimeType: "image/png" as const,
            dataUrl,
            widthPx: 8,
            heightPx: 8,
            byteLength: bytes.byteLength,
          },
        })),
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      }),
    };
    const rasterCodec: RasterCodecPort = {
      decode: (): DecodedRaster => ({
        widthPx: 8,
        heightPx: 8,
        rgba: new Uint8Array(8 * 8 * 4).fill(255),
      }),
      encodePreview: () => ({
        widthPx: 1,
        heightPx: 1,
        original: "data:image/png;base64,AA==",
        blackWhite: "data:image/png;base64,AA==",
        edges: "data:image/png;base64,AA==",
      }),
    };
    const rasterWorker: RasterWorkerPort = {
      run: (task): Promise<RasterTraceTaskResult> => Promise.resolve({
        operationId: task.operationId,
        candidate: rasterCandidate(task),
        preview: {
          widthPx: 1,
          heightPx: 1,
          originalRgba: new Uint8Array(4).fill(255),
          blackWhiteRgba: new Uint8Array(4).fill(255),
          edgeRgba: new Uint8Array(4).fill(255),
        },
      }),
    };
    const { controller } = await desktop({ aiProvider, rasterCodec, rasterWorker });
    const rasterRequest = {
      ...request(),
      widthMm: 100,
      heightMm: 50,
      conceptCount: 2,
    };

    expect(await controller.generateAiConcepts(rasterRequest)).toMatchObject({ ok: true });
    const preview = controller.state.editor.aiConceptPreview;
    expect(preview?.summary).toMatchObject({
      source: "raster-trace",
      wordingMatches: true,
      objectCount: 1,
    });
    const object = preview?.objects[0];
    expect(object?.type).toBe("path");
    if (object?.type !== "path") throw new Error("Expected a traced path preview.");
    expect(Math.max(...object.points.map((point) => point.xMm))).toBe(100);
    expect(Math.max(...object.points.map((point) => point.yMm))).toBe(50);
    expect(controller.state.editor.history.undoDepth).toBe(0);
  });

  it("cancels a pending request without publishing concepts or changing the project", async () => {
    const { controller } = await desktop({ delayMs: 2_000 });
    const before = JSON.stringify(controller.state.project);
    const generation = controller.generateAiConcepts(request());
    await Promise.resolve();
    expect(controller.state.ai.job?.operationId).toBe(OPERATION_ID);

    expect(await controller.cancelAiGeneration(OPERATION_ID)).toMatchObject({ ok: true });
    expect(await generation).toMatchObject({ ok: false });
    expect(controller.state.ai.concepts).toHaveLength(0);
    expect(controller.state.editor.aiConceptPreview).toBeNull();
    expect(JSON.stringify(controller.state.project)).toBe(before);
    expect(controller.state.editor.history.undoDepth).toBe(0);
  });
});
