import { randomUUID } from "node:crypto";
import { basename, extname } from "node:path";

import {
  fingerprintGeometryDocument,
  materializeGeometryOperation,
  prepareGeometryOperation,
  ProjectSession,
  type EditorActionRequest,
  type ProjectFileService,
  type RecoverySnapshot,
  type GeometryOperationRequest,
} from "@laserx/application";
import {
  CutabilityAnalysisCache,
  fingerprintCutabilityDocument,
  materializeBridgeProposal,
  proposeBridge,
  type BridgeProposal,
  type CutabilityAnalysisSummary,
} from "@laserx/cutability";
import {
  identityTransform,
  type TextObject,
  type UpdateViewportPreferences,
  type VectorExportSummary,
  type ManufacturingSettings,
} from "@laserx/domain";
import {
  type FontCatalogEntry,
  FontEngine,
  type TextLayoutRequest,
} from "@laserx/fonts";
import {
  MAX_RASTER_PREVIEW_DIMENSION_PX,
  MAX_RASTER_PROCESSING_TIME_MS,
  inspectRasterSource,
  type RasterPreviewPixels,
  type RasterTraceProgress,
} from "@laserx/import-raster";
import { exportDxf, importDxf } from "@laserx/io-dxf";
import { exportSvg, importSvg } from "@laserx/io-svg";
import {
  generateSignToolCandidate,
  type SignToolRequest,
} from "@laserx/sign-tools";

import type {
  CommandResult,
  CreateDocumentRequest,
  DesktopState,
  ResolveRecoveryRequest,
  SetViewportPreferencesRequest,
  TextUpdateRequestDto,
  RasterTraceRequest,
  BridgeProposalRequestDto,
  VectorExportRequest,
  VectorImportPreviewRequest,
} from "./ipc-contract.js";
import {
  CutabilityAnalysisCancelledError,
  NodeCutabilityWorkerService,
  type CutabilityWorkerPort,
} from "./cutability-worker-service.js";
import { AppLogger } from "./logger.js";
import {
  NodeGeometryWorkerService,
  type GeometryWorkerPort,
} from "./geometry-worker-service.js";
import {
  type RasterCodecPort,
  type RasterPreviewDataUrls,
} from "./raster-codec.js";
import {
  RasterStorage,
  type RasterFileService,
} from "./raster-storage.js";
import {
  NodeRasterWorkerService,
  RasterTraceCancelledError,
  RasterTraceTimeoutError,
  type RasterWorkerPort,
} from "./raster-worker-service.js";
import {
  RecentProjectsStore,
  RecoveryStore,
  type RecentProject,
  type RecoveryStorePort,
} from "./persistence.js";
import { ProjectStorage, validateProjectPath } from "./project-storage.js";
import {
  VectorStorage,
  type VectorFileFormat,
  type VectorFileService,
} from "./vector-storage.js";

export type UnsavedChoice = "save" | "discard" | "cancel";

export interface DesktopDialogs {
  chooseOpenProject(): Promise<string | null>;
  chooseSaveProject(suggestedName: string): Promise<string | null>;
  confirmUnsavedChanges(projectName: string): Promise<UnsavedChoice>;
  chooseImportVector?(): Promise<string | null>;
  chooseImportRaster?(): Promise<string | null>;
  chooseExportVector?(
    format: VectorFileFormat,
    suggestedName: string,
  ): Promise<string | null>;
}

export interface DesktopControllerOptions {
  userDataPath: string;
  dialogs: DesktopDialogs;
  onStateChanged: (state: DesktopState) => void;
  autosaveIntervalMs?: number;
  autosaveScheduler?: AutosaveScheduler;
  projectStorage?: ProjectFileService;
  recoveryStore?: RecoveryStorePort;
  fontEngine?: FontEngine;
  geometryWorker?: GeometryWorkerPort;
  vectorStorage?: VectorFileService;
  rasterStorage?: RasterFileService;
  rasterCodec?: RasterCodecPort;
  rasterWorker?: RasterWorkerPort;
  rasterOperationTimeoutMs?: number;
  cutabilityWorker?: CutabilityWorkerPort;
}

export interface AutosaveScheduler {
  schedule(callback: () => void, intervalMs: number): () => void;
}

const intervalAutosaveScheduler: AutosaveScheduler = {
  schedule(callback, intervalMs) {
    const timer = setInterval(callback, intervalMs);
    timer.unref();
    return () => {
      clearInterval(timer);
    };
  },
};

const MAX_RASTER_PREVIEW_DATA_URL_LENGTH = 8 * 1024 * 1024;

function validatedRasterPreview(
  encoded: RasterPreviewDataUrls,
  pixels: RasterPreviewPixels,
): RasterPreviewDataUrls {
  if (
    !Number.isInteger(encoded.widthPx) ||
    !Number.isInteger(encoded.heightPx) ||
    encoded.widthPx !== pixels.widthPx ||
    encoded.heightPx !== pixels.heightPx ||
    encoded.widthPx <= 0 ||
    encoded.heightPx <= 0 ||
    encoded.widthPx > MAX_RASTER_PREVIEW_DIMENSION_PX ||
    encoded.heightPx > MAX_RASTER_PREVIEW_DIMENSION_PX
  ) {
    throw new RangeError("Encoded raster preview dimensions are invalid or unbounded.");
  }
  for (const value of [encoded.original, encoded.blackWhite, encoded.edges]) {
    if (
      !value.startsWith("data:image/png;base64,") ||
      value.length > MAX_RASTER_PREVIEW_DATA_URL_LENGTH
    ) {
      throw new RangeError("Encoded raster preview data is invalid or unbounded.");
    }
  }
  return { ...encoded };
}

function combineLayerAnalyses(
  operationId: string,
  analyses: readonly CutabilityAnalysisSummary[],
): CutabilityAnalysisSummary {
  const first = analyses[0];
  if (first === undefined) {
    throw new RangeError("Layered manufacturing analysis requires at least one result.");
  }
  const issues = analyses.flatMap((analysis) => analysis.issues);
  const smallestSegments = analyses
    .map((analysis) => analysis.smallestSegmentMm)
    .filter((value): value is number => value !== null);
  return {
    operationId,
    status: analyses.some((analysis) => analysis.status === "ambiguous")
      ? "ambiguous"
      : "complete",
    documentFingerprint: first.documentFingerprint,
    analyzedObjectIds: analyses.flatMap((analysis) => analysis.analyzedObjectIds),
    settings: structuredClone(first.settings),
    pathCount: analyses.reduce((sum, analysis) => sum + analysis.pathCount, 0),
    closedPathCount: analyses.reduce((sum, analysis) => sum + analysis.closedPathCount, 0),
    openPathCount: analyses.reduce((sum, analysis) => sum + analysis.openPathCount, 0),
    segmentCount: analyses.reduce((sum, analysis) => sum + analysis.segmentCount, 0),
    smallestSegmentMm:
      smallestSegments.length === 0 ? null : Math.min(...smallestSegments),
    issueCount: issues.length,
    errorCount: issues.filter((issue) => issue.severity === "error").length,
    warningCount: issues.filter((issue) => issue.severity === "warning").length,
    issues: structuredClone(issues),
    regions: structuredClone(analyses.flatMap((analysis) => analysis.regions)),
    previewAssumption:
      "Each selected layer is analyzed independently under the standard retained-stock assumption; layers may represent separate material pieces.",
    disclaimer: first.disclaimer,
    cutReady: false,
  };
}

export class DesktopController {
  readonly #session = new ProjectSession({
    createId: () => randomUUID(),
    now: () => new Date().toISOString(),
  });
  readonly #storage: ProjectFileService;
  readonly #recentStore: RecentProjectsStore;
  readonly #recoveryStore: RecoveryStorePort;
  readonly #logger: AppLogger;
  readonly #dialogs: DesktopDialogs;
  readonly #onStateChanged: (state: DesktopState) => void;
  readonly #autosaveIntervalMs: number;
  readonly #autosaveScheduler: AutosaveScheduler;
  readonly #fontEngine: FontEngine;
  readonly #geometryWorker: GeometryWorkerPort;
  readonly #vectorStorage: VectorFileService;
  readonly #rasterStorage: RasterFileService;
  readonly #rasterCodec: RasterCodecPort | null;
  readonly #rasterWorker: RasterWorkerPort;
  readonly #rasterOperationTimeoutMs: number;
  readonly #cutabilityWorker: CutabilityWorkerPort;
  readonly #cutabilityCache = new CutabilityAnalysisCache();
  readonly #geometryAbortControllers = new Map<string, AbortController>();
  readonly #rasterAbortControllers = new Map<string, AbortController>();
  readonly #cutabilityAbortControllers = new Map<string, AbortController>();
  #recentProjects: RecentProject[] = [];
  #pendingRecovery: RecoverySnapshot | null = null;
  #stopAutosave: (() => void) | null = null;
  #autosaveInFlight: Promise<void> | null = null;
  #lastExportSummary: VectorExportSummary | null = null;
  #rasterJob: {
    operationId: string;
    percent: number;
    stage: "selecting" | "reading" | "decoding" | RasterTraceProgress["stage"];
  } | null = null;
  #rasterPreview: (RasterPreviewDataUrls & { operationId: string }) | null = null;
  #cutabilityAnalysis: CutabilityAnalysisSummary | null = null;
  #cutabilityJob: {
    operationId: string;
    percent: number;
    stage: "normalizing" | "topology" | "spacing" | "classifying";
  } | null = null;
  #focusedCutabilityIssueId: string | null = null;
  #bridgeProposal: BridgeProposal | null = null;

  public constructor(options: DesktopControllerOptions) {
    this.#storage = options.projectStorage ?? new ProjectStorage();
    this.#recentStore = new RecentProjectsStore(options.userDataPath);
    this.#recoveryStore =
      options.recoveryStore ?? new RecoveryStore(options.userDataPath);
    this.#logger = new AppLogger(options.userDataPath);
    this.#dialogs = options.dialogs;
    this.#onStateChanged = options.onStateChanged;
    this.#autosaveIntervalMs = options.autosaveIntervalMs ?? 30_000;
    this.#autosaveScheduler =
      options.autosaveScheduler ?? intervalAutosaveScheduler;
    this.#fontEngine = options.fontEngine ?? new FontEngine([]);
    this.#geometryWorker =
      options.geometryWorker ?? new NodeGeometryWorkerService();
    this.#vectorStorage = options.vectorStorage ?? new VectorStorage();
    this.#rasterStorage = options.rasterStorage ?? new RasterStorage();
    this.#rasterCodec = options.rasterCodec ?? null;
    this.#rasterWorker = options.rasterWorker ?? new NodeRasterWorkerService();
    this.#cutabilityWorker =
      options.cutabilityWorker ?? new NodeCutabilityWorkerService();
    this.#rasterOperationTimeoutMs =
      options.rasterOperationTimeoutMs ?? MAX_RASTER_PROCESSING_TIME_MS;
    if (
      !Number.isFinite(this.#rasterOperationTimeoutMs) ||
      this.#rasterOperationTimeoutMs <= 0
    ) {
      throw new RangeError("Raster operation timeout must be a positive finite duration.");
    }
  }

  public async initialize(): Promise<void> {
    this.#recentProjects = await this.#recentStore.load();
    this.#pendingRecovery = await this.#recoveryStore.load();
    this.#startAutosave();
    await this.#logger.info("desktop-controller-initialized");
    this.#emit();
  }

  public get state(): DesktopState {
    const session = this.#session.state;
    return {
      project: {
        id: session.project.project.id,
        name: session.project.project.name,
        document: structuredClone(session.project.document),
      },
      editor: structuredClone(session.editor),
      filePath: session.filePath,
      dirty: session.dirty,
      recovered: session.recovered,
      recentProjects: structuredClone(this.#recentProjects),
      recovery:
        this.#pendingRecovery === null
          ? null
          : {
              capturedAt: this.#pendingRecovery.capturedAt,
              originalPath: this.#pendingRecovery.originalPath,
              projectName: this.#pendingRecovery.project.project.name,
            },
      interchange: {
        exportSummary:
          this.#lastExportSummary === null
            ? null
            : structuredClone(this.#lastExportSummary),
      },
      raster: {
        job: this.#rasterJob === null ? null : { ...this.#rasterJob },
        preview:
          session.editor.rasterTracePreview === null || this.#rasterPreview === null
            ? null
            : { ...this.#rasterPreview },
      },
      analysis: {
        job: this.#cutabilityJob === null ? null : { ...this.#cutabilityJob },
        focusedIssueId: this.#focusedCutabilityIssueId,
        bridgeProposal:
          this.#bridgeProposal === null
            ? null
            : structuredClone(this.#bridgeProposal),
        cutability:
          this.#cutabilityAnalysis === null
            ? null
            : structuredClone(this.#cutabilityAnalysis),
      },
    };
  }

  public async newProject(): Promise<CommandResult> {
    return this.#run(async () => {
      if (await this.#confirmReplacement()) {
        this.#session.dispatch({ type: "project.new" });
        this.#clearRasterState();
        await this.#settleAutosaveAndClearRecovery();
      }
    });
  }

  public async openProject(): Promise<CommandResult> {
    return this.#run(async () => {
      if (!(await this.#confirmReplacement())) {
        return;
      }
      const filePath = await this.#dialogs.chooseOpenProject();
      if (filePath !== null) {
        await this.#openPath(filePath);
      }
    });
  }

  public async createDocument(
    request: CreateDocumentRequest,
  ): Promise<CommandResult> {
    return this.#run(() => {
      this.#session.dispatch({
        type: "project.create-document",
        ...request,
      });
      this.#clearRasterState();
    });
  }

  public async openRecent(filePath: string): Promise<CommandResult> {
    return this.#run(async () => {
      const normalized = validateProjectPath(filePath);
      const allowed = this.#recentProjects.some(
        (recent) => validateProjectPath(recent.filePath) === normalized,
      );
      if (!allowed) {
        throw new Error(
          "That path is not in the recent-project list and cannot be opened through this command.",
        );
      }
      if (await this.#confirmReplacement()) {
        await this.#openPath(normalized);
      }
    });
  }

  public async saveProject(): Promise<CommandResult> {
    return this.#run(async () => {
      await this.#save(false);
    });
  }

  public async saveProjectAs(): Promise<CommandResult> {
    return this.#run(async () => {
      await this.#save(true);
    });
  }

  public async previewVectorImport(
    request: VectorImportPreviewRequest,
  ): Promise<CommandResult> {
    return this.#run(async () => {
      if (this.#dialogs.chooseImportVector === undefined) {
        throw new Error("Vector import is not available in this desktop host.");
      }
      const filePath = await this.#dialogs.chooseImportVector();
      if (filePath === null) {
        return;
      }
      const contents = await this.#vectorStorage.read(filePath);
      const extension = extname(filePath).toLowerCase();
      const candidate = extension === ".svg"
        ? importSvg(contents)
        : extension === ".dxf"
          ? importDxf(contents, {
              ...(request.unitlessDxfUnit === null
                ? {}
                : { unitlessUnit: request.unitlessDxfUnit }),
            })
          : (() => {
              throw new RangeError("Choose an .svg or .dxf vector file.");
            })();
      this.#session.previewVectorImport(candidate, basename(filePath));
    });
  }

  public async commitVectorImport(): Promise<CommandResult> {
    return this.#run(() => {
      this.#session.commitVectorImport();
      this.#invalidateCutability();
    });
  }

  public async cancelVectorImport(): Promise<CommandResult> {
    return this.#run(() => {
      this.#session.cancelVectorImport();
    });
  }

  public async previewRasterTrace(
    request: RasterTraceRequest,
  ): Promise<CommandResult> {
    return this.#run(async () => {
      if (this.#dialogs.chooseImportRaster === undefined) {
        throw new Error("Raster tracing is not available in this desktop host.");
      }
      if (this.#rasterCodec === null) {
        throw new Error("The desktop raster decoder is not configured.");
      }
      if (this.#rasterAbortControllers.size > 0) {
        throw new RangeError("Finish or cancel the active raster trace first.");
      }
      if (this.#geometryAbortControllers.size > 0) {
        throw new RangeError("Finish or cancel the active geometry operation first.");
      }
      const operationId = request.operationId;
      const abortController = new AbortController();
      this.#rasterAbortControllers.set(operationId, abortController);
      this.#rasterJob = { operationId, percent: 0, stage: "selecting" };
      const documentFingerprint = fingerprintGeometryDocument(
        this.#session.state.project.document,
      );
      this.#emit();
      let deadline: ReturnType<typeof setTimeout> | null = null;
      const deadlineState = { timedOut: false };
      const assertActive = (): void => {
        if (deadlineState.timedOut) {
          throw new RasterTraceTimeoutError(this.#rasterOperationTimeoutMs);
        }
        if (
          abortController.signal.aborted ||
          this.#rasterAbortControllers.get(operationId) !== abortController
        ) {
          throw new RasterTraceCancelledError();
        }
      };
      const yieldForCancellation = async (): Promise<void> => {
        await new Promise<void>((resolveYield) => {
          setImmediate(resolveYield);
        });
        assertActive();
      };
      try {
        const filePath = await this.#dialogs.chooseImportRaster();
        assertActive();
        if (filePath === null) return;
        deadline = setTimeout(() => {
          deadlineState.timedOut = true;
          abortController.abort();
        }, this.#rasterOperationTimeoutMs);
        deadline.unref();
        this.#rasterJob = { operationId, percent: 2, stage: "reading" };
        this.#emit();
        const bytes = await this.#rasterStorage.read(
          filePath,
          abortController.signal,
        );
        assertActive();
        const extension = extname(filePath).toLowerCase();
        const expectedFormat = extension === ".png" ? "png" : "jpeg";
        const source = inspectRasterSource(bytes, expectedFormat);
        assertActive();
        this.#rasterJob = { operationId, percent: 5, stage: "decoding" };
        this.#emit();
        const image = await this.#rasterCodec.decode(bytes, source);
        await yieldForCancellation();
        const result = await this.#rasterWorker.run(
          {
            operationId,
            source,
            image,
            settings: request.settings,
          },
          abortController.signal,
          (progress) => {
            if (
              !abortController.signal.aborted &&
              this.#rasterAbortControllers.get(operationId) === abortController &&
              progress.operationId === operationId
            ) {
              this.#rasterJob = { ...progress };
              this.#emit();
            }
          },
        );
        assertActive();
        if (result.operationId !== operationId) {
          throw new Error("Raster worker returned a mismatched operation ID.");
        }
        if (
          fingerprintGeometryDocument(this.#session.state.project.document) !==
          documentFingerprint
        ) {
          throw new Error(
            "The document changed while raster tracing was running; the stale result was not previewed.",
          );
        }
        const encodedPreview = validatedRasterPreview(
          await this.#rasterCodec.encodePreview(result.preview),
          result.preview,
        );
        await yieldForCancellation();
        if (
          fingerprintGeometryDocument(this.#session.state.project.document) !==
          documentFingerprint
        ) {
          throw new Error(
            "The document changed while raster tracing was running; the stale result was not previewed.",
          );
        }
        this.#session.previewRasterTrace(result.candidate, basename(filePath));
        this.#rasterPreview = {
          operationId,
          ...encodedPreview,
        };
      } catch (error) {
        if (deadlineState.timedOut) {
          throw new RasterTraceTimeoutError(this.#rasterOperationTimeoutMs);
        }
        if (
          abortController.signal.aborted ||
          error instanceof RasterTraceCancelledError
        ) return;
        throw error;
      } finally {
        if (deadline !== null) clearTimeout(deadline);
        if (this.#rasterAbortControllers.get(operationId) === abortController) {
          this.#rasterAbortControllers.delete(operationId);
        }
        this.#clearRasterJob(operationId);
        this.#emit();
      }
    });
  }

  public async cancelRasterTrace(operationId: string): Promise<CommandResult> {
    return this.#run(() => {
      const abortController = this.#rasterAbortControllers.get(operationId);
      if (abortController === undefined) {
        throw new RangeError("That raster trace operation is not active.");
      }
      abortController.abort();
    });
  }

  public async acceptRasterTrace(): Promise<CommandResult> {
    return this.#run(async () => {
      const accepted = this.#session.commitRasterTrace();
      this.#invalidateCutability();
      this.#rasterPreview = null;
      await this.#analyzeCutability(randomUUID(), accepted.editor.selectionIds);
    });
  }

  public async rejectRasterTrace(): Promise<CommandResult> {
    return this.#run(() => {
      this.#session.cancelRasterTrace();
      this.#rasterPreview = null;
    });
  }

  public async previewSignTool(request: SignToolRequest): Promise<CommandResult> {
    return this.#run(() => {
      const state = this.#session.state;
      const candidate = generateSignToolCandidate(request, {
        document: state.project.document,
        selectedObjectIds: state.editor.selectionIds,
        createId: () => randomUUID(),
        layoutText: (layoutRequest) => this.#fontEngine.layout(layoutRequest),
      });
      this.#session.previewSignTool(candidate);
    });
  }

  public async acceptSignTool(): Promise<CommandResult> {
    return this.#run(async () => {
      const preview = this.#session.state.editor.signToolPreview;
      if (preview === null) {
        throw new RangeError("There is no sign-tool preview to accept.");
      }
      const objectIds = preview.objects.map((object) => object.id);
      this.#session.acceptSignToolPreview();
      this.#invalidateCutability();
      await this.#analyzeCutabilityByLayer(randomUUID(), objectIds);
    });
  }

  public async rejectSignTool(): Promise<CommandResult> {
    return this.#run(() => {
      this.#session.cancelSignToolPreview();
    });
  }

  public async saveSignTemplate(name: string): Promise<CommandResult> {
    return this.#run(() => {
      this.#session.saveSignToolPreviewTemplate(name);
    });
  }

  public async deleteSignTemplate(templateId: string): Promise<CommandResult> {
    return this.#run(() => {
      this.#session.deleteSignTemplate(templateId);
    });
  }

  public async exportVector(
    request: VectorExportRequest,
  ): Promise<CommandResult> {
    return this.#run(async () => {
      if (this.#dialogs.chooseExportVector === undefined) {
        throw new Error("Vector export is not available in this desktop host.");
      }
      const current = this.#session.state;
      const filePath = await this.#dialogs.chooseExportVector(
        request.format,
        `${current.project.project.name}.${request.format}`,
      );
      if (filePath === null) {
        return;
      }
      const artifact = request.format === "svg"
        ? exportSvg(current.project.document)
        : exportDxf(current.project.document);
      await this.#vectorStorage.write(filePath, artifact.content, request.format);
      this.#lastExportSummary = artifact.summary;
    });
  }

  public async setDisplayUnit(
    displayUnit: "millimeters" | "inches",
  ): Promise<CommandResult> {
    return this.#run(() => {
      if (
        this.#session.state.project.document.settings.displayUnit !==
        displayUnit
      ) {
        this.#session.dispatch({
          type: "project.set-display-unit",
          displayUnit,
        });
      }
    });
  }

  public async setViewportPreferences(
    updates: SetViewportPreferencesRequest,
  ): Promise<CommandResult> {
    return this.#run(() => {
      const domainUpdates: UpdateViewportPreferences = {};
      if (updates.rulersVisible !== undefined) {
        domainUpdates.rulersVisible = updates.rulersVisible;
      }
      if (updates.gridVisible !== undefined) {
        domainUpdates.gridVisible = updates.gridVisible;
      }
      if (updates.gridSpacingMm !== undefined) {
        domainUpdates.gridSpacingMm = updates.gridSpacingMm;
      }
      if (updates.snappingEnabled !== undefined) {
        domainUpdates.snappingEnabled = updates.snappingEnabled;
      }
      if (updates.snapToGrid !== undefined) {
        domainUpdates.snapToGrid = updates.snapToGrid;
      }
      if (updates.snapToGuides !== undefined) {
        domainUpdates.snapToGuides = updates.snapToGuides;
      }
      if (updates.snapToObjects !== undefined) {
        domainUpdates.snapToObjects = updates.snapToObjects;
      }
      if (updates.snapToDocument !== undefined) {
        domainUpdates.snapToDocument = updates.snapToDocument;
      }
      this.#session.dispatch({
        type: "project.set-viewport-preferences",
        updates: domainUpdates,
      });
    });
  }

  public async setManufacturingSettings(
    settings: ManufacturingSettings,
  ): Promise<CommandResult> {
    return this.#run(() => {
      this.#session.dispatch({
        type: "project.set-manufacturing-settings",
        settings,
      });
      this.#invalidateCutability();
    });
  }

  public async runCutabilityAnalysis(
    operationId: string,
    objectIds: readonly string[],
  ): Promise<CommandResult> {
    return this.#run(async () => {
      await this.#analyzeCutabilityByLayer(operationId, objectIds);
    });
  }

  public async cancelCutabilityAnalysis(
    operationId: string,
  ): Promise<CommandResult> {
    return this.#run(() => {
      const controller = this.#cutabilityAbortControllers.get(operationId);
      if (controller === undefined) {
        throw new RangeError("That manufacturing analysis is not active.");
      }
      controller.abort();
    });
  }

  public async focusCutabilityIssue(
    issueId: string | null,
  ): Promise<CommandResult> {
    return this.#run(() => {
      if (issueId === null) {
        this.#focusedCutabilityIssueId = null;
        return;
      }
      const issue = this.#cutabilityAnalysis?.issues.find(
        (candidate) => candidate.id === issueId,
      );
      if (issue === undefined) {
        throw new RangeError("That manufacturing issue is not available.");
      }
      this.#focusedCutabilityIssueId = issue.id;
      this.#session.selectObjectIds(issue.objectIds);
    });
  }

  public async previewBridge(
    request: BridgeProposalRequestDto,
  ): Promise<CommandResult> {
    return this.#run(() => {
      if (this.#cutabilityAnalysis === null) {
        throw new RangeError("Run manufacturing analysis before proposing a bridge.");
      }
      this.#bridgeProposal = proposeBridge(
        this.#session.state.project.document,
        this.#cutabilityAnalysis,
        request,
      );
      this.#focusedCutabilityIssueId = request.issueId;
    });
  }

  public async acceptBridge(): Promise<CommandResult> {
    return this.#run(async () => {
      const proposal = this.#bridgeProposal;
      if (proposal === null) {
        throw new RangeError("There is no bridge proposal to accept.");
      }
      const before = this.#session.state.project.document;
      if (fingerprintCutabilityDocument(before) !== proposal.documentFingerprint) {
        throw new Error("The document changed after this bridge preview; preview it again.");
      }
      const replacements = materializeBridgeProposal(proposal, randomUUID);
      const beforeNodeCount = before.objects.reduce(
        (count, object) =>
          object.type === "path" && proposal.sourceObjectIds.includes(object.id)
            ? count + object.points.length
            : count,
        0,
      );
      this.#session.applyTopologyReplacement(
        {
          type: "objects.replace-topology",
          sourceObjectIds: proposal.sourceObjectIds,
          replacements,
        },
        {
          operation: "Apply bridge",
          beforeNodeCount,
          afterNodeCount: replacements.reduce((count, object) => count + object.points.length, 0),
          replacedObjectIds: replacements.map((object) => object.id),
          discardedObjectIds: proposal.sourceObjectIds.filter(
            (id) => !replacements.some((object) => object.id === id),
          ),
          warnings: [...proposal.warnings],
          message: proposal.summary,
        },
      );
      this.#invalidateCutability();
      const state = this.#session.state;
      await this.#analyzeCutability(randomUUID(), state.editor.selectionIds);
    });
  }

  public async rejectBridge(): Promise<CommandResult> {
    return this.#run(() => {
      this.#bridgeProposal = null;
    });
  }

  public async editorAction(
    request: EditorActionRequest,
  ): Promise<CommandResult> {
    return this.#run(() => {
      const before = fingerprintCutabilityDocument(
        this.#session.state.project.document,
      );
      this.#session.performEditorAction(request);
      const after = fingerprintCutabilityDocument(
        this.#session.state.project.document,
      );
      if (after !== before) this.#invalidateCutability();
    });
  }

  public async geometryOperation(
    request: GeometryOperationRequest,
  ): Promise<CommandResult> {
    return this.#run(async () => {
      if (this.#geometryAbortControllers.has(request.operationId)) {
        throw new RangeError("A geometry operation with this ID is already running.");
      }
      if (this.#geometryAbortControllers.size > 0) {
        throw new RangeError("Finish or cancel the active geometry operation first.");
      }
      const state = this.#session.state;
      const prepared = prepareGeometryOperation(
        state.project.document,
        state.editor.selectionIds,
        request,
      );
      const abortController = new AbortController();
      this.#geometryAbortControllers.set(request.operationId, abortController);
      try {
        const result = await this.#geometryWorker.run(
          prepared.task,
          abortController.signal,
        );
        const current = this.#session.state;
        if (
          fingerprintGeometryDocument(current.project.document) !==
          prepared.documentFingerprint
        ) {
          throw new Error(
            "The document changed while geometry was running; the stale result was not applied.",
          );
        }
        const materialized = materializeGeometryOperation(
          prepared,
          result,
          randomUUID,
        );
        this.#session.applyTopologyReplacement(
          {
            type: "objects.replace-topology",
            sourceObjectIds: prepared.sourceObjectIds,
            replacements: materialized.replacements,
          },
          materialized.summary,
        );
        this.#invalidateCutability();
      } finally {
        this.#geometryAbortControllers.delete(request.operationId);
      }
    });
  }

  public cancelGeometryOperation(operationId: string): Promise<CommandResult> {
    this.#geometryAbortControllers.get(operationId)?.abort();
    return Promise.resolve({ ok: true, state: this.state });
  }

  public fontCatalog(): FontCatalogEntry[] {
    return this.#fontEngine.catalog();
  }

  public async createText(
    request: TextLayoutRequest,
  ): Promise<CommandResult> {
    return this.#run(() => {
      const layout = this.#fontEngine.layout(request);
      if (layout.missingCodePoints.length > 0) {
        throw new RangeError(
          `The selected font is missing ${layout.missingCodePoints
            .map((codePoint) => `U+${codePoint.toString(16).toUpperCase()}`)
            .join(", ")}.`,
        );
      }
      if (layout.contours.length === 0) {
        throw new RangeError("Text must contain at least one visible glyph.");
      }
      const document = this.#session.state.project.document;
      const layer =
        document.layers.find(
          (candidate) =>
            candidate.id === document.activeLayerId &&
            candidate.visible &&
            !candidate.locked,
        ) ?? document.layers.find((candidate) => candidate.visible && !candidate.locked);
      if (layer === undefined) {
        throw new RangeError("No editable layer is available.");
      }
      const object: TextObject = {
        id: randomUUID(),
        type: "text",
        layerId: layer.id,
        transform: identityTransform(),
        content: request.content,
        origin: {
          xMm:
            document.dimensions.widthMm / 2 -
            (layout.bounds.minXmm + layout.bounds.maxXmm) / 2,
          yMm:
            document.dimensions.heightMm / 2 -
            (layout.bounds.minYmm + layout.bounds.maxYmm) / 2,
        },
        style: {
          fontId: layout.font.id,
          fontFamily: layout.font.family,
          fontStyle: layout.font.style,
          fontFingerprint: layout.font.fingerprint,
          sizeMm: request.sizeMm,
          trackingMm: request.trackingMm,
          wordSpacingMm: request.wordSpacingMm,
          lineSpacing: request.lineSpacing,
          alignment: request.alignment,
        },
        arc: request.arc === null ? null : { ...request.arc },
        contours: layout.contours.map((contour) => ({
          compoundIndex: contour.compoundIndex,
          closed: contour.closed,
          points: contour.points.map((point) => ({ ...point })),
        })),
        missingFont: false,
      };
      this.#session.executeEditorCommand({
        type: "objects.insert",
        objects: [object],
      });
      this.#invalidateCutability();
    });
  }

  public async updateSelectedText(
    request: TextUpdateRequestDto,
  ): Promise<CommandResult> {
    return this.#run(() => {
      const state = this.#session.state;
      const selected = state.project.document.objects.filter(
        (object): object is TextObject =>
          object.type === "text" &&
          state.editor.selectionIds.includes(object.id),
      );
      if (selected.length !== 1) {
        throw new RangeError("Select exactly one editable text object.");
      }
      const previous = selected[0];
      if (previous === undefined) {
        return;
      }
      const { mode, ...layoutRequest } = request;
      const layout = this.#fontEngine.layout(layoutRequest);
      if (
        mode === "live" &&
        !this.#fontEngine.catalog().some(
          (font) =>
            font.id === previous.style.fontId &&
            font.fingerprint === previous.style.fontFingerprint,
        )
      ) {
        throw new RangeError(
          "Live editing is paused until the font substitution is explicitly confirmed.",
        );
      }
      if (layout.missingCodePoints.length > 0) {
        throw new RangeError(
          `The selected font is missing ${layout.missingCodePoints
            .map((codePoint) => `U+${codePoint.toString(16).toUpperCase()}`)
            .join(", ")}.`,
        );
      }
      if (layout.contours.length === 0) {
        throw new RangeError("Text must contain at least one visible glyph.");
      }
      this.#session.executeEditorCommand({
        type: "objects.replace",
        object: {
          ...previous,
          content: request.content,
          style: {
            fontId: layout.font.id,
            fontFamily: layout.font.family,
            fontStyle: layout.font.style,
            fontFingerprint: layout.font.fingerprint,
            sizeMm: request.sizeMm,
            trackingMm: request.trackingMm,
            wordSpacingMm: request.wordSpacingMm,
            lineSpacing: request.lineSpacing,
            alignment: request.alignment,
          },
          arc: request.arc === null ? null : { ...request.arc },
          contours: layout.contours.map((contour) => ({
            compoundIndex: contour.compoundIndex,
            closed: contour.closed,
            points: contour.points.map((point) => ({ ...point })),
          })),
          missingFont: false,
        },
      });
      this.#invalidateCutability();
    });
  }

  public async resolveRecovery(
    request: ResolveRecoveryRequest,
  ): Promise<CommandResult> {
    return this.#run(async () => {
      if (request.action === "recover" && this.#pendingRecovery !== null) {
        this.#session.recover(this.#pendingRecovery);
        this.#clearRasterState();
        await this.#logger.info("recovery-restored");
      } else if (request.action === "discard") {
        await this.#recoveryStore.remove();
        await this.#logger.info("recovery-discarded");
      }
      this.#pendingRecovery = null;
    });
  }

  public async confirmClose(): Promise<boolean> {
    if (!this.#session.state.dirty) {
      return true;
    }
    const choice = await this.#dialogs.confirmUnsavedChanges(
      this.#session.state.project.project.name,
    );
    if (choice === "cancel") {
      return false;
    }
    if (choice === "save") {
      return this.#save(false);
    }
    this.stop();
    await this.#settleAutosaveAndClearRecovery();
    return true;
  }

  public stop(): void {
    if (this.#stopAutosave !== null) {
      this.#stopAutosave();
      this.#stopAutosave = null;
    }
    this.#clearRasterState();
    for (const controller of this.#geometryAbortControllers.values()) {
      controller.abort();
    }
    this.#geometryAbortControllers.clear();
  }

  async #openPath(filePath: string): Promise<void> {
    const normalized = validateProjectPath(filePath);
    const project = await this.#storage.read(normalized);
    this.#session.open(project, normalized);
    this.#clearRasterState();
    await this.#settleAutosaveAndClearRecovery();
    this.#recentProjects = await this.#recentStore.add({
      filePath: normalized,
      name: project.project.name,
    });
    await this.#logger.info("project-opened");
  }

  async #save(forceSaveAs: boolean): Promise<boolean> {
    const current = this.#session.state;
    let filePath = forceSaveAs ? null : current.filePath;
    if (filePath === null) {
      filePath = await this.#dialogs.chooseSaveProject(
        `${current.project.project.name}.laserx`,
      );
    }
    if (filePath === null) {
      return false;
    }
    const normalized = validateProjectPath(filePath);
    const project = this.#session.prepareSave();
    await this.#storage.write(normalized, project);
    this.#session.completeSave(project, normalized);
    await this.#settleAutosaveAndClearRecovery();
    this.#recentProjects = await this.#recentStore.add({
      filePath: normalized,
      name: project.project.name,
    });
    await this.#logger.info("project-saved");
    return true;
  }

  async #confirmReplacement(): Promise<boolean> {
    if (!this.#session.state.dirty) {
      return true;
    }
    const choice = await this.#dialogs.confirmUnsavedChanges(
      this.#session.state.project.project.name,
    );
    if (choice === "cancel") {
      return false;
    }
    if (choice === "save") {
      return this.#save(false);
    }
    return true;
  }

  #clearRasterState(): void {
    for (const controller of this.#rasterAbortControllers.values()) {
      controller.abort();
    }
    this.#rasterAbortControllers.clear();
    for (const controller of this.#cutabilityAbortControllers.values()) {
      controller.abort();
    }
    this.#cutabilityAbortControllers.clear();
    this.#rasterJob = null;
    this.#rasterPreview = null;
    this.#cutabilityAnalysis = null;
    this.#cutabilityJob = null;
    this.#focusedCutabilityIssueId = null;
    this.#bridgeProposal = null;
    this.#cutabilityCache.invalidate();
  }

  #clearRasterJob(operationId: string): void {
    if (this.#rasterJob?.operationId === operationId) {
      this.#rasterJob = null;
    }
  }

  #clearCutabilityJob(operationId: string): void {
    if (this.#cutabilityJob?.operationId === operationId) {
      this.#cutabilityJob = null;
    }
  }

  #invalidateCutability(): void {
    for (const controller of this.#cutabilityAbortControllers.values()) {
      controller.abort();
    }
    this.#cutabilityAbortControllers.clear();
    this.#cutabilityCache.invalidate();
    this.#cutabilityAnalysis = null;
    this.#cutabilityJob = null;
    this.#focusedCutabilityIssueId = null;
    this.#bridgeProposal = null;
  }

  async #analyzeCutability(
    operationId: string,
    objectIds: readonly string[],
  ): Promise<CutabilityAnalysisSummary | null> {
    if (this.#cutabilityAbortControllers.size > 0) {
      throw new RangeError("Finish or cancel the active manufacturing analysis first.");
    }
    const document = this.#session.state.project.document;
    const cached = this.#cutabilityCache.get(document, objectIds);
    if (cached !== null) {
      this.#cutabilityAnalysis = { ...cached, operationId };
      return this.#cutabilityAnalysis;
    }
    const fingerprint = fingerprintCutabilityDocument(document);
    const abortController = new AbortController();
    this.#cutabilityAbortControllers.set(operationId, abortController);
    this.#cutabilityJob = { operationId, percent: 0, stage: "normalizing" };
    this.#emit();
    try {
      const analysis = await this.#cutabilityWorker.run(
        { operationId, document, objectIds: [...objectIds] },
        abortController.signal,
        (progress) => {
          if (
            this.#cutabilityAbortControllers.get(operationId) === abortController &&
            !abortController.signal.aborted
          ) {
            this.#cutabilityJob = { ...progress };
            this.#emit();
          }
        },
      );
      if (analysis.operationId !== operationId) {
        throw new Error("Manufacturing analysis worker returned a mismatched operation ID.");
      }
      if (
        fingerprintCutabilityDocument(this.#session.state.project.document) !== fingerprint
      ) {
        throw new Error("The document changed while manufacturing analysis was running; the stale result was discarded.");
      }
      this.#cutabilityAnalysis = analysis;
      this.#cutabilityCache.set(document, objectIds, analysis);
      this.#focusedCutabilityIssueId = analysis.issues[0]?.id ?? null;
      this.#bridgeProposal = null;
      return analysis;
    } catch (error) {
      if (error instanceof CutabilityAnalysisCancelledError) return null;
      throw error;
    } finally {
      if (this.#cutabilityAbortControllers.get(operationId) === abortController) {
        this.#cutabilityAbortControllers.delete(operationId);
      }
      this.#clearCutabilityJob(operationId);
      this.#emit();
    }
  }

  async #analyzeCutabilityByLayer(
    operationId: string,
    objectIds: readonly string[],
  ): Promise<void> {
    const document = this.#session.state.project.document;
    const requested = new Set(objectIds);
    const scoped = objectIds.length === 0
      ? document.objects.filter((object) =>
          document.layers.some((layer) => layer.id === object.layerId && layer.visible),
        )
      : document.objects.filter((object) => requested.has(object.id));
    const byLayer = new Map<string, string[]>();
    for (const object of scoped) {
      const ids = byLayer.get(object.layerId);
      if (ids === undefined) byLayer.set(object.layerId, [object.id]);
      else ids.push(object.id);
    }
    if (byLayer.size <= 1) {
      await this.#analyzeCutability(operationId, objectIds);
      return;
    }
    const analyses: CutabilityAnalysisSummary[] = [];
    for (const ids of byLayer.values()) {
      const analysis = await this.#analyzeCutability(randomUUID(), ids);
      if (analysis === null) return;
      analyses.push(analysis);
    }
    this.#cutabilityAnalysis = combineLayerAnalyses(operationId, analyses);
    this.#focusedCutabilityIssueId = this.#cutabilityAnalysis.issues[0]?.id ?? null;
    this.#bridgeProposal = null;
  }

  async #run(action: () => void | Promise<void>): Promise<CommandResult> {
    try {
      await action();
      this.#emit();
      return { ok: true, state: this.state };
    } catch (error) {
      await this.#logger.error("desktop-command-failed", error);
      const message =
        error instanceof Error
          ? error.message
          : "The command failed for an unknown reason.";
      return { ok: false, error: message, state: this.state };
    }
  }

  #emit(): void {
    this.#onStateChanged(this.state);
  }

  #startAutosave(): void {
    this.#stopAutosave = this.#autosaveScheduler.schedule(() => {
      this.#queueAutosave();
    }, this.#autosaveIntervalMs);
  }

  #queueAutosave(): void {
    if (this.#autosaveInFlight !== null) {
      return;
    }
    const autosave = this.#autosave();
    this.#autosaveInFlight = autosave;
    void autosave.finally(() => {
      if (this.#autosaveInFlight === autosave) {
        this.#autosaveInFlight = null;
      }
    });
  }

  async #settleAutosaveAndClearRecovery(): Promise<void> {
    const autosave = this.#autosaveInFlight;
    if (autosave !== null) {
      await autosave;
    }
    await this.#recoveryStore.remove();
    this.#pendingRecovery = null;
  }

  async #autosave(): Promise<void> {
    if (!this.#session.state.dirty) {
      return;
    }
    try {
      await this.#recoveryStore.save(
        this.#session.createRecoverySnapshot(),
      );
      await this.#logger.info("recovery-autosaved");
    } catch (error) {
      await this.#logger.error("recovery-autosave-failed", error);
    }
  }
}
