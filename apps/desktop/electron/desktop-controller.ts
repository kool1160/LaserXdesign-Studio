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
  AI_LIMITS,
  OPENAI_PLATFORM_BILLING_URL,
  OPENAI_PLATFORM_SETUP_URL,
  AiProviderError,
  OpenAiProvider,
  connectionStateForError,
  type AiConnectionState,
  type AiGenerationRequest,
  type AiNormalizedConcept,
  type AiProvider,
  type AiProviderConcept,
  type AiProviderResult,
} from "@laserx/ai";
import {
  analyzeDocumentCutability,
  CutabilityAnalysisCache,
  fingerprintCutabilityDocument,
  fingerprintCutabilityAnalysis,
  groupCutabilityFindings,
  materializeBridgeProposal,
  normalizeCutPaths,
  proposeBridge,
  proposeSafeRepairs,
  type BridgeProposal,
  type CutabilityAnalysisSummary,
  type CutabilityRepairGroups,
  type SafeRepairProposal,
} from "@laserx/cutability";
import {
  identityTransform,
  copyDocumentObject,
  type DocumentObject,
  type Layer,
  type LaserxDocument,
  type LaserxProject,
  type PathObject,
  type TextObject,
  type UpdateViewportPreferences,
  type VectorExportSummary,
  type ManufacturingSettings,
  type RasterSourceMetadata,
} from "@laserx/domain";
import { applyAffineTransform } from "@laserx/geometry";
import {
  type FontCatalogEntry,
  FontEngine,
  type TextLayoutRequest,
} from "@laserx/fonts";
import {
  MAX_RASTER_PREVIEW_DIMENSION_PX,
  MAX_RASTER_PROCESSING_TIME_MS,
  inspectRasterSource,
  settingsForRasterTracePreset,
  type RasterPreviewPixels,
  type RasterTraceProgress,
} from "@laserx/import-raster";
import { exportDxf, importDxf } from "@laserx/io-dxf";
import { exportSvg, importSvg } from "@laserx/io-svg";
import {
  buildProductionPackage,
  buildProductionAssemblyPreview,
  manufacturingLayerObjectIds,
  type ProductionAssemblyPreview,
} from "@laserx/production-export";
import {
  generateSignToolCandidate,
  type SignGenerationCandidate,
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
  AiGenerateRequest,
  BridgeProposalRequestDto,
  VectorExportRequest,
  VectorImportPreviewRequest,
  SelectImportSourceRequest,
  ConfigureVectorImportRequest,
  FocusVectorImportFindingRequest,
  ProductionExportRequest,
  SavePhysicalPreviewCaptureRequest,
  OnboardingActionRequest,
} from "./ipc-contract.js";
import {
  canCompleteResolution,
  canResumeSnapshot,
  initialGuidedWorkflowState,
  initialOnboardingPreferences,
  isTerminalStatus,
  isStepSkippable,
  reduceGuidedWorkflow,
  resolveResumeStepId,
  shouldAutoCompleteResolution,
  toWorkflowSnapshot,
  type GuidedProjectBinding,
  type GuidedWorkflowState,
  type OnboardingPreferences,
  type ResolutionFindingCounts,
} from "../src/features/onboarding/guidedWorkflowState.js";
import {
  guidedGoal,
  guidedStep,
} from "../src/features/onboarding/guidedWorkflowDefinitions.js";
import type { PhysicalPreviewAssembly } from "../../../packages/physical-preview-3d/src/index.js";
import { fingerprintPhysicalPreviewInput } from "../../../packages/physical-preview-3d/src/task.js";
import {
  analyzePixelContent,
  PREVIEW_CAPTURE_BACKGROUND,
  readPngHeader,
  validatePngStructure,
  type PixelContentEvidence,
} from "../../../packages/physical-preview-three/src/capture.js";
import {
  CredentialAcquisitionCancelledError,
  CredentialAcquisitionTimeoutError,
  type CredentialAcquisitionPort,
  type CredentialVaultPort,
} from "./ai-credentials.js";
import {
  CutabilityAnalysisCancelledError,
  NodeCutabilityWorkerService,
  type CutabilityWorkerPort,
} from "./cutability-worker-service.js";
import { AppLogger } from "./logger.js";
import { classifyImportSource } from "./import-source.js";
import {
  PhysicalPreviewCoordinator,
  PhysicalPreviewSupersededError,
} from "./physical-preview-coordinator.js";
import {
  PhysicalPreviewCancelledError,
  NodePhysicalPreviewWorkerService,
  type PhysicalPreviewWorkerPort,
} from "./physical-preview-worker-service.js";
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
  OnboardingPreferencesStore,
  type RecentProject,
  type RecoveryStorePort,
  type OnboardingPreferencesStorePort,
} from "./persistence.js";
import { ProjectStorage, validateProjectPath } from "./project-storage.js";
import {
  VectorStorage,
  type VectorFileFormat,
  type VectorFileService,
} from "./vector-storage.js";
import {
  ProductionStorage,
  type ProductionPackageFileService,
} from "./production-storage.js";
import {
  isWithinCapturePixelBudget,
  MAX_CAPTURE_BYTES,
} from "./capture-limits.js";
import {
  unavailablePreviewCaptureDecoder,
  type PreviewCaptureDecoderPort,
} from "./preview-capture-decoder.js";
import {
  PreviewCaptureStorage,
  type PreviewCaptureFileService,
} from "./preview-capture-storage.js";

/** Matches the accepted capture validator: below this nothing is a real PNG. */
const MINIMUM_CAPTURE_PNG_BYTES = 64;

const UNTITLED_PROJECT_NAME = "Untitled";
const MAX_PROJECT_NAME_LENGTH = 200;

function canonicalJson(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function guidedDocumentFingerprint(document: LaserxProject["document"]): string {
  return canonicalJson(document);
}

function projectNameForPath(currentName: string, filePath: string): string {
  if (currentName !== UNTITLED_PROJECT_NAME) {
    return currentName;
  }
  const fileName = basename(filePath, extname(filePath)).trim();
  return fileName.length === 0
    ? currentName
    : fileName.slice(0, MAX_PROJECT_NAME_LENGTH);
}

export type UnsavedChoice = "save" | "discard" | "cancel";

export interface DesktopDialogs {
  chooseOpenProject(): Promise<string | null>;
  chooseSaveProject(suggestedName: string): Promise<string | null>;
  confirmUnsavedChanges(projectName: string): Promise<UnsavedChoice>;
  chooseImportSource?(): Promise<string | null>;
  chooseImportVector?(): Promise<string | null>;
  chooseImportRaster?(): Promise<string | null>;
  chooseExportVector?(
    format: VectorFileFormat,
    suggestedName: string,
  ): Promise<string | null>;
  chooseProductionDirectory?(suggestedName: string): Promise<string | null>;
  choosePreviewCapturePath?(suggestedName: string): Promise<string | null>;
}

export interface DesktopControllerOptions {
  userDataPath: string;
  dialogs: DesktopDialogs;
  onStateChanged: (state: DesktopState) => void;
  autosaveIntervalMs?: number;
  autosaveScheduler?: AutosaveScheduler;
  projectStorage?: ProjectFileService;
  recoveryStore?: RecoveryStorePort;
  onboardingPreferencesStore?: OnboardingPreferencesStorePort;
  fontEngine?: FontEngine;
  geometryWorker?: GeometryWorkerPort;
  vectorStorage?: VectorFileService;
  productionStorage?: ProductionPackageFileService;
  previewCaptureStorage?: PreviewCaptureFileService;
  previewCaptureDecoder?: PreviewCaptureDecoderPort;
  rasterStorage?: RasterFileService;
  rasterCodec?: RasterCodecPort;
  rasterWorker?: RasterWorkerPort;
  rasterOperationTimeoutMs?: number;
  cutabilityWorker?: CutabilityWorkerPort;
  physicalPreviewWorker?: PhysicalPreviewWorkerPort;
  aiProvider?: AiProvider;
  credentialVault?: CredentialVaultPort;
  credentialAcquisition?: CredentialAcquisitionPort;
  credentialConnectionTimeoutMs?: number;
  openExternal?: (url: string) => Promise<void>;
}

export interface AutosaveScheduler {
  schedule(callback: () => void, intervalMs: number): () => void;
}

type CutabilityAnalysisScope = NonNullable<DesktopState["analysis"]["scope"]>;

interface CutabilityAnalysisProjection {
  scope: CutabilityAnalysisScope;
  cutability: CutabilityAnalysisSummary;
}

type SafeRepairVisualPreview = NonNullable<
  DesktopState["analysis"]["safeRepairProposal"]
>["visualPreview"];

function safeRepairPreviewPaths(
  document: LaserxDocument,
  objectIds: readonly string[],
): SafeRepairVisualPreview["before"] {
  const topLevelNodes = new Map(
    document.objects
      .filter((object): object is PathObject => object.type === "path")
      .map((object) => [
        object.id,
        object.points.map((point) =>
          applyAffineTransform(point, object.transform),
        ),
      ]),
  );
  return normalizeCutPaths(document, objectIds).map((path) => ({
    id: path.id,
    objectId: path.objectId,
    closed: path.closed,
    points: path.points.map((point) => ({
      xMm: point.xMm,
      yMm: point.yMm,
    })),
    nodes: (topLevelNodes.get(path.objectId) ?? []).map((point) => ({
      ...point,
    })),
  }));
}

function buildSafeRepairVisualPreview(
  document: LaserxDocument,
  proposal: SafeRepairProposal,
): SafeRepairVisualPreview {
  const replacements = new Map(
    proposal.replacements.map((object) => [object.id, object]),
  );
  const deletedIds = new Set(proposal.deleteObjectIds);
  const proposedDocument: LaserxDocument = {
    ...document,
    objects: document.objects
      .filter((object) => !deletedIds.has(object.id))
      .map((object) => replacements.get(object.id) ?? object),
  };
  const before = safeRepairPreviewPaths(document, proposal.affectedObjectIds);
  if (before.length === 0) {
    throw new Error("Safe-repair preview geometry is unavailable.");
  }
  return {
    before,
    after: safeRepairPreviewPaths(
      proposedDocument,
      proposal.affectedObjectIds,
    ),
  };
}

function objectCutabilityScope(
  objectIds: readonly string[],
): Extract<CutabilityAnalysisScope, { kind: "whole-design" | "selection" }> {
  return objectIds.length === 0
    ? { kind: "whole-design", layerId: null, layerName: null }
    : {
        kind: "selection",
        layerId: null,
        layerName: null,
        objectIds: [...objectIds],
      };
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

const unavailableCredentialVault: CredentialVaultPort = {
  read: () => Promise.resolve(null),
  write: () => Promise.reject(new Error("Operating-system credential storage is unavailable.")),
  delete: () => Promise.resolve(),
};

const unavailableCredentialAcquisition: CredentialAcquisitionPort = {
  acquire: () => Promise.reject(new Error("Secure credential entry is unavailable.")),
};

function disconnectedAiState(provider: Pick<AiProvider, "id" | "name" | "model">): AiConnectionState {
  return {
    providerId: provider.id,
    providerName: provider.name,
    status: "disconnected",
    model: provider.model,
    message: "Connect a user-owned OpenAI API key to generate concepts.",
    retryAfterMs: null,
  };
}

function canonicalWording(value: string): string {
  return value.trim().replace(/\s+/gu, " ").toLocaleUpperCase();
}

function mappedObjectLayer(object: DocumentObject, layerId: string): DocumentObject {
  const copied = copyDocumentObject(object);
  if (copied.type !== "group") return { ...copied, layerId };
  return {
    ...copied,
    layerId,
    children: copied.children.map((child) => mappedObjectLayer(child, layerId)),
  };
}

function normalizedLayerCount(
  candidate: SignGenerationCandidate,
  requestedCount: number,
): Pick<SignGenerationCandidate, "layers" | "objects"> {
  const count = Math.max(1, Math.min(requestedCount, candidate.layers.length));
  const layers = candidate.layers.slice(0, count).map((layer, index) => ({
    ...layer,
    name: index === 0 && count === 1 ? "AI Sign" : layer.name,
  }));
  const sourceIndex = new Map(candidate.layers.map((layer, index) => [layer.id, index]));
  const objects = candidate.objects.map((object) => {
    const index = Math.min(sourceIndex.get(object.layerId) ?? 0, count - 1);
    return mappedObjectLayer(object, (layers[index] as Layer).id);
  });
  return { layers, objects };
}

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

export class DesktopController {
  readonly #session = new ProjectSession({
    createId: () => randomUUID(),
    now: () => new Date().toISOString(),
  });
  readonly #storage: ProjectFileService;
  readonly #recentStore: RecentProjectsStore;
  readonly #recoveryStore: RecoveryStorePort;
  readonly #onboardingPreferencesStore: OnboardingPreferencesStorePort;
  readonly #logger: AppLogger;
  readonly #dialogs: DesktopDialogs;
  readonly #onStateChanged: (state: DesktopState) => void;
  readonly #autosaveIntervalMs: number;
  readonly #autosaveScheduler: AutosaveScheduler;
  readonly #fontEngine: FontEngine;
  readonly #geometryWorker: GeometryWorkerPort;
  readonly #vectorStorage: VectorFileService;
  readonly #productionStorage: ProductionPackageFileService;
  readonly #previewCaptureStorage: PreviewCaptureFileService;
  readonly #previewCaptureDecoder: PreviewCaptureDecoderPort;
  readonly #rasterStorage: RasterFileService;
  readonly #rasterCodec: RasterCodecPort | null;
  readonly #rasterWorker: RasterWorkerPort;
  readonly #rasterOperationTimeoutMs: number;
  readonly #cutabilityWorker: CutabilityWorkerPort;
  readonly #physicalPreviewCoordinator: PhysicalPreviewCoordinator;
  readonly #aiProvider: AiProvider;
  readonly #credentialVault: CredentialVaultPort;
  readonly #credentialAcquisition: CredentialAcquisitionPort;
  readonly #credentialConnectionTimeoutMs: number;
  readonly #openExternal: ((url: string) => Promise<void>) | null;
  readonly #cutabilityCache = new CutabilityAnalysisCache();
  readonly #geometryAbortControllers = new Map<string, AbortController>();
  readonly #rasterAbortControllers = new Map<string, AbortController>();
  readonly #cutabilityAbortControllers = new Map<string, AbortController>();
  readonly #physicalPreviewAbortControllers = new Map<string, AbortController>();
  #aiAbortController: AbortController | null = null;
  #credentialAbortController: AbortController | null = null;
  #recentProjects: RecentProject[] = [];
  #pendingRecovery: RecoverySnapshot | null = null;
  #guidedWorkflow: GuidedWorkflowState = initialGuidedWorkflowState;
  #guidedPreviewCompletion: {
    runToken: string;
    inputFingerprint: string;
  } | null = null;
  #guidedAnalysisCompletion: {
    runToken: string;
    documentFingerprint: string;
  } | null = null;
  #onboardingPreferences: OnboardingPreferences = initialOnboardingPreferences;
  #onboardingRecoveryNotice: string | null = null;
  #stopAutosave: (() => void) | null = null;
  #autosaveInFlight: Promise<void> | null = null;
  #lastExportSummary: VectorExportSummary | null = null;
  #productionExportSummary: {
    status: "success" | "failed";
    packageName: string;
    targetDirectory: string;
    layerCount: number;
    fileCount: number;
    warnings: string[];
    failedFile: string | null;
    error: string | null;
  } | null = null;
  #rasterJob: {
    operationId: string;
    percent: number;
    stage: "selecting" | "reading" | "decoding" | RasterTraceProgress["stage"];
  } | null = null;
  #rasterPreview: (RasterPreviewDataUrls & { operationId: string }) | null = null;
  #selectedVectorSource: {
    sourceName: string;
    format: VectorFileFormat;
    contents: string;
  } | null = null;
  #selectedRasterSource: {
    sourceName: string;
    source: RasterSourceMetadata;
    bytes: Uint8Array;
  } | null = null;
  #cutabilityProjection: CutabilityAnalysisProjection | null = null;
  #cutabilityJob: {
    operationId: string;
    percent: number;
    stage: "normalizing" | "topology" | "spacing" | "classifying";
  } | null = null;
  #focusedCutabilityIssueId: string | null = null;
  #bridgeProposal: BridgeProposal | null = null;
  #repairGroups: CutabilityRepairGroups | null = null;
  #safeRepairProposal: SafeRepairProposal | null = null;
  #safeRepairVisualPreview: SafeRepairVisualPreview | null = null;
  #safeRepairResult: {
    fixedCount: number;
    skippedCount: number;
    remainingCount: number;
    summary: string;
    disclaimer: string;
  } | null = null;
  #physicalPreviewJob: {
    operationId: string;
    percent: number;
    stage: "preparing" | "building";
  } | null = null;
  #physicalPreviewAssembly: PhysicalPreviewAssembly | null = null;
  /**
   * Records a real worker/build failure against the exact physical input that
   * produced it. Guided onboarding may acknowledge that explicit failure,
   * but a stale failure can never satisfy a later document.
   */
  #physicalPreviewFailureFingerprint: string | null = null;
  #physicalPreviewCapture: {
    status: "saved" | "canceled" | "failed";
    targetPath: string | null;
    byteLength: number | null;
    error: string | null;
    /**
     * The physical-content fingerprint in effect when this status was
     * recorded. Read alongside it (never independently) so a save/cancel/
     * failure result is only ever exposed while it still describes the
     * *current* document's physical content -- see the staleness check in
     * the `state` getter, mirroring `#physicalPreviewAssemblyFingerprint`.
     */
    assemblyFingerprint: string | null;
  } | null = null;
  /**
   * The physical-content fingerprint `#physicalPreviewAssembly` was built
   * from. Read alongside it (never independently) so a last-valid assembly
   * is only ever exposed while it still matches the *current* document's
   * physical content -- see the staleness check in the `state` getter.
   */
  #physicalPreviewAssemblyFingerprint: string | null = null;
  #aiConnection: AiConnectionState;
  #aiReference: AiGenerationRequest["referenceImage"] = null;
  #aiJob: {
    operationId: string;
    percent: number;
    stage: "requesting" | "normalizing";
  } | null = null;
  #aiConcepts: AiNormalizedConcept[] = [];
  #aiRawConcepts: AiProviderConcept[] = [];
  #aiResult: AiProviderResult | null = null;
  #aiRequest: AiGenerationRequest | null = null;
  #aiSelectedConceptId: string | null = null;
  #aiProjectFingerprint: string | null = null;

  public constructor(options: DesktopControllerOptions) {
    this.#storage = options.projectStorage ?? new ProjectStorage();
    this.#recentStore = new RecentProjectsStore(options.userDataPath);
    this.#recoveryStore =
      options.recoveryStore ?? new RecoveryStore(options.userDataPath);
    this.#onboardingPreferencesStore =
      options.onboardingPreferencesStore ??
      new OnboardingPreferencesStore(options.userDataPath);
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
    this.#productionStorage = options.productionStorage ?? new ProductionStorage();
    this.#previewCaptureStorage =
      options.previewCaptureStorage ?? new PreviewCaptureStorage();
    // Fail closed: without a wired decoder every capture is rejected, rather
    // than silently skipping the decode check.
    this.#previewCaptureDecoder =
      options.previewCaptureDecoder ?? unavailablePreviewCaptureDecoder;
    this.#rasterStorage = options.rasterStorage ?? new RasterStorage();
    this.#rasterCodec = options.rasterCodec ?? null;
    this.#rasterWorker = options.rasterWorker ?? new NodeRasterWorkerService();
    this.#cutabilityWorker =
      options.cutabilityWorker ?? new NodeCutabilityWorkerService();
    this.#physicalPreviewCoordinator = new PhysicalPreviewCoordinator(
      options.physicalPreviewWorker ?? new NodePhysicalPreviewWorkerService(),
    );
    this.#aiProvider = options.aiProvider ?? new OpenAiProvider();
    this.#credentialVault = options.credentialVault ?? unavailableCredentialVault;
    this.#credentialAcquisition =
      options.credentialAcquisition ?? unavailableCredentialAcquisition;
    this.#credentialConnectionTimeoutMs = options.credentialConnectionTimeoutMs ?? 120_000;
    if (
      !Number.isFinite(this.#credentialConnectionTimeoutMs) ||
      this.#credentialConnectionTimeoutMs <= 0 ||
      this.#credentialConnectionTimeoutMs > 10 * 60_000
    ) {
      throw new RangeError("AI credential connection timeout must be between 1 ms and 10 minutes.");
    }
    this.#openExternal = options.openExternal ?? null;
    this.#aiConnection = disconnectedAiState(this.#aiProvider);
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
    this.#onboardingPreferences =
      (await this.#onboardingPreferencesStore.load()) ??
      initialOnboardingPreferences;
    try {
      const credential = await this.#credentialVault.read(this.#aiProvider.id);
      if (credential !== null) {
        this.#aiConnection = {
          providerId: this.#aiProvider.id,
          providerName: this.#aiProvider.name,
          status: "connected",
          model: this.#aiProvider.model,
          message: "A protected OpenAI API key is available in the operating-system vault.",
          retryAfterMs: null,
        };
      }
    } catch (error) {
      this.#aiConnection = connectionStateForError(this.#aiProvider, error);
    }
    this.#startAutosave();
    await this.#logger.info("desktop-controller-initialized");
    this.#emit();
  }

  public get state(): DesktopState {
    const session = this.#session.state;
    const productionPreview = this.#productionPreview(session.project);
    const activeWorkflow = this.#onboardingPreferences.activeWorkflow;
    const liveGuidedBinding = this.#liveGuidedBinding();
    const resumeEligibility: DesktopState["onboarding"]["resumeEligibility"] =
      activeWorkflow === null
        ? "none"
        : activeWorkflow.projectBinding.projectId !== liveGuidedBinding.projectId ||
            activeWorkflow.projectBinding.documentId !== liveGuidedBinding.documentId
          ? "different-project"
          : canResumeSnapshot(
                guidedGoal(activeWorkflow.goal).definition,
                activeWorkflow,
                liveGuidedBinding,
              )
            ? "available"
            : "stale";
    const workflowGoal = this.#guidedWorkflow.definition?.goal ?? null;
    const workflowSurface =
      workflowGoal === null || this.#guidedWorkflow.currentStepId === null
        ? null
        : guidedStep(workflowGoal, this.#guidedWorkflow.currentStepId)?.surface ?? null;
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
      onboarding: {
        preferences: structuredClone(
          this.#onboardingPreferences,
        ) as DesktopState["onboarding"]["preferences"],
        workflow: {
          status: this.#guidedWorkflow.status,
          goal: workflowGoal,
          runToken: this.#guidedWorkflow.runToken,
          currentStepId: this.#guidedWorkflow.currentStepId,
          surface: workflowSurface,
          completedStepIds: [...this.#guidedWorkflow.completedStepIds],
          skippedStepIds: [...this.#guidedWorkflow.skippedStepIds],
          failureReason: this.#guidedWorkflow.failureReason,
        },
        resumeEligibility,
        recoveryNotice: this.#onboardingRecoveryNotice,
      },
      interchange: {
        sourceSelection:
          this.#selectedVectorSource !== null
            ? {
                kind: "vector" as const,
                sourceName: this.#selectedVectorSource.sourceName,
                format: this.#selectedVectorSource.format,
              }
            : this.#selectedRasterSource !== null
              ? {
                  kind: "raster" as const,
                  sourceName: this.#selectedRasterSource.sourceName,
                  format: this.#selectedRasterSource.source.format,
                  widthPx: this.#selectedRasterSource.source.widthPx,
                  heightPx: this.#selectedRasterSource.source.heightPx,
                  sourceBytes: this.#selectedRasterSource.source.sourceBytes,
                  decodedBytes: this.#selectedRasterSource.source.decodedBytes,
                }
              : null,
        exportSummary:
          this.#lastExportSummary === null
            ? null
            : structuredClone(this.#lastExportSummary),
      },
      production: {
        preview: productionPreview,
        exportSummary:
          this.#productionExportSummary === null
            ? null
            : structuredClone(this.#productionExportSummary),
      },
      raster: {
        job: this.#rasterJob === null ? null : { ...this.#rasterJob },
        preview:
          session.editor.rasterTracePreview === null || this.#rasterPreview === null
            ? null
            : { ...this.#rasterPreview },
      },
      ai: {
        connection: { ...this.#aiConnection },
        credentialPrompt: {
          active: this.#credentialAbortController !== null,
          timeoutMs: this.#credentialConnectionTimeoutMs,
        },
        job: this.#aiJob === null ? null : { ...this.#aiJob },
        reference: this.#aiReference === null
          ? null
          : {
              mimeType: this.#aiReference.mimeType,
              widthPx: this.#aiReference.widthPx,
              heightPx: this.#aiReference.heightPx,
              byteLength: this.#aiReference.byteLength,
              previewDataUrl: this.#aiReference.dataUrl,
              consent: true as const,
            },
        concepts: this.#aiConcepts.map((concept) => ({
          ...concept.summary,
          warnings: [...concept.summary.warnings],
        })),
        selectedConceptId: this.#aiSelectedConceptId,
        usage: this.#aiResult === null ? null : { ...this.#aiResult.usage },
        estimate: {
          model: this.#aiProvider.model,
          maxOutputTokens: AI_LIMITS.outputTokens,
          note: "OpenAI bills the connected account directly. Exact cost depends on input, image, and output tokens.",
        },
      },
      analysis: {
        scope:
          this.#cutabilityProjection === null
            ? null
            : structuredClone(this.#cutabilityProjection.scope),
        job: this.#cutabilityJob === null ? null : { ...this.#cutabilityJob },
        focusedIssueId: this.#focusedCutabilityIssueId,
        bridgeProposal:
          this.#bridgeProposal === null
            ? null
            : structuredClone(this.#bridgeProposal),
        repairGroups:
          this.#repairGroups === null
            ? null
            : structuredClone(this.#repairGroups),
        safeRepairProposal:
          this.#safeRepairProposal === null ||
          this.#safeRepairVisualPreview === null
            ? null
            : {
                id: this.#safeRepairProposal.id,
                documentFingerprint: this.#safeRepairProposal.documentFingerprint,
                analysisFingerprint: this.#safeRepairProposal.analysisFingerprint,
                tolerances: { ...this.#safeRepairProposal.tolerances },
                findingCount: this.#safeRepairProposal.findingIds.length,
                plannedFindingCount:
                  this.#safeRepairProposal.plannedFindingIds.length,
                skippedFindingCount:
                  this.#safeRepairProposal.skippedFindingIds.length,
                affectedObjectIds: [
                  ...this.#safeRepairProposal.affectedObjectIds,
                ],
                changes: this.#safeRepairProposal.changes.map((change) => ({
                  kind: change.kind,
                  objectId: change.objectId,
                  findingCount: change.findingIds.length,
                  description: change.description,
                })),
                visualPreview: structuredClone(
                  this.#safeRepairVisualPreview,
                ),
                summary: this.#safeRepairProposal.summary,
                disclaimer: this.#safeRepairProposal.disclaimer,
              },
        safeRepairResult:
          this.#safeRepairResult === null
            ? null
            : { ...this.#safeRepairResult },
        cutability:
          this.#cutabilityProjection === null
            ? null
            : structuredClone(this.#cutabilityProjection.cutability),
      },
      physicalPreview: (() => {
        const currentInputFingerprint = fingerprintPhysicalPreviewInput(session.project);
        return {
          job: this.#physicalPreviewJob === null ? null : { ...this.#physicalPreviewJob },
          // A last-valid assembly is only ever exposed while it still matches
          // the current document's physical content. A physical edit, or a
          // build that failed/canceled after one, must not leave a now-stale
          // assembly on display -- this check runs on every read rather than
          // depending on every mutation site remembering to invalidate it.
          assembly:
            this.#physicalPreviewAssembly === null ||
            this.#physicalPreviewAssemblyFingerprint !== currentInputFingerprint
              ? null
              : structuredClone(this.#physicalPreviewAssembly),
          // Same reasoning applies to a capture result: it describes an
          // attempt against a specific physical content fingerprint, and a
          // later rebuild or physical edit must not leave the old "Saved"
          // (or failure) status attached to content that was never actually
          // captured. Gating on live equality here -- rather than clearing it
          // at every mutation site that changes physical content -- is the
          // same pattern the assembly field already uses, and for the same
          // reason: it cannot be forgotten at a future call site.
          capture:
            this.#physicalPreviewCapture === null ||
            this.#physicalPreviewCapture.assemblyFingerprint !== currentInputFingerprint
              ? null
              : { ...this.#physicalPreviewCapture },
        };
      })(),
    };
  }

  public async newProject(): Promise<CommandResult> {
    return this.#run(async () => {
      if (await this.#confirmReplacement()) {
        await this.#invalidateGuidanceForProjectReplacement();
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
    return this.#run(async () => {
      this.#session.dispatch({
        type: "project.create-document",
        ...request,
      });
      this.#clearRasterState();
      await this.#advanceCreateGuidanceFromDocumentOutcome();
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

  public async selectImportSource(
    request: SelectImportSourceRequest,
  ): Promise<CommandResult> {
    return this.#run(async () => {
      if (
        this.#guidedWorkflow.status !== "active" ||
        this.#guidedWorkflow.definition?.goal !== "import-own-design" ||
        this.#guidedWorkflow.currentStepId !== "choose-file"
      ) {
        throw new Error(
          "Artwork source selection is available at the guided Choose your artwork checkpoint.",
        );
      }
      if (this.#dialogs.chooseImportSource === undefined) {
        throw new Error("Artwork selection is not available in this desktop host.");
      }
      if (this.#rasterAbortControllers.size > 0) {
        throw new RangeError("Finish or cancel the active raster trace first.");
      }
      const filePath = await this.#dialogs.chooseImportSource();
      if (filePath === null) return;
      const classification = classifyImportSource(filePath);
      if (classification === null) {
        throw new RangeError("Choose an SVG, DXF, PNG, or JPEG artwork file.");
      }

      if (classification.kind === "vector") {
        const selected = {
          sourceName: basename(filePath),
          format: classification.format,
          contents: await this.#vectorStorage.read(filePath),
        };
        this.#session.cancelRasterTrace();
        this.#rasterPreview = null;
        this.#selectedRasterSource = null;
        this.#previewSelectedVectorSource(selected, request.unitlessDxfUnit);
        this.#selectedVectorSource = selected;
      } else {
        if (this.#rasterCodec === null) {
          throw new Error("The desktop raster decoder is not configured.");
        }
        const bytes = await this.#rasterStorage.read(filePath);
        const source = inspectRasterSource(bytes, classification.format);
        this.#session.cancelVectorImport();
        this.#session.cancelRasterTrace();
        this.#selectedVectorSource = null;
        this.#rasterPreview = null;
        this.#selectedRasterSource = {
          sourceName: basename(filePath),
          source,
          bytes,
        };
      }
      await this.#advanceImportGuidanceStep("choose-file");
    });
  }

  public async previewVectorImport(
    request: VectorImportPreviewRequest,
  ): Promise<CommandResult> {
    return this.#run(async () => {
      const guidedImportActive =
        this.#guidedWorkflow.status === "active" &&
        this.#guidedWorkflow.definition?.goal === "import-own-design";
      if (
        guidedImportActive &&
        (this.#guidedWorkflow.currentStepId !== "prepare-source" ||
          this.#selectedVectorSource === null)
      ) {
        throw new Error(
          "Choose vector artwork through the guided artwork selector before preparing it.",
        );
      }
      let selected = guidedImportActive ? this.#selectedVectorSource : null;
      if (selected === null) {
        if (this.#dialogs.chooseImportVector === undefined) {
          throw new Error("Vector import is not available in this desktop host.");
        }
        const filePath = await this.#dialogs.chooseImportVector();
        if (filePath === null) return;
        const classification = classifyImportSource(filePath);
        if (classification?.kind !== "vector") {
          throw new RangeError("Choose an .svg or .dxf vector file.");
        }
        selected = {
          sourceName: basename(filePath),
          format: classification.format,
          contents: await this.#vectorStorage.read(filePath),
        };
      }
      this.#session.cancelRasterTrace();
      this.#rasterPreview = null;
      this.#selectedRasterSource = null;
      this.#previewSelectedVectorSource(selected, request.unitlessDxfUnit);
      this.#selectedVectorSource = selected;
      await this.#advanceImportGuidanceStep("choose-file");
    });
  }

  public async commitVectorImport(): Promise<CommandResult> {
    return this.#run(async () => {
      this.#session.commitVectorImport();
      this.#invalidateCutability();
      this.#selectedVectorSource = null;
      await this.#advanceImportGuidanceStep("prepare-source");
    });
  }

  public async configureVectorImport(
    request: ConfigureVectorImportRequest,
  ): Promise<CommandResult> {
    return this.#run(() => {
      this.#session.configureVectorImport(request.fitMode, request.marginMm);
    });
  }

  public async focusVectorImportFinding(
    request: FocusVectorImportFindingRequest,
  ): Promise<CommandResult> {
    return this.#run(() => {
      this.#session.focusVectorImportFinding(request.objectId);
    });
  }

  public async cancelVectorImport(): Promise<CommandResult> {
    return this.#run(async () => {
      this.#session.cancelVectorImport();
      this.#selectedVectorSource = null;
      await this.#returnImportGuidanceToSourceSelection();
    });
  }

  public async previewRasterTrace(
    request: RasterTraceRequest,
  ): Promise<CommandResult> {
    return this.#run(async () => {
      const guidedImportActive =
        this.#guidedWorkflow.status === "active" &&
        this.#guidedWorkflow.definition?.goal === "import-own-design";
      if (
        guidedImportActive &&
        (this.#guidedWorkflow.currentStepId !== "prepare-source" ||
          this.#selectedRasterSource === null)
      ) {
        throw new Error(
          "Choose a raster image through the guided artwork selector before tracing it.",
        );
      }
      if (
        this.#selectedRasterSource === null &&
        this.#dialogs.chooseImportRaster === undefined
      ) {
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
      const documentFingerprint = guidedDocumentFingerprint(
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
      const startDeadline = (): ReturnType<typeof setTimeout> => {
        const timer = setTimeout(() => {
          deadlineState.timedOut = true;
          abortController.abort();
        }, this.#rasterOperationTimeoutMs);
        timer.unref();
        return timer;
      };
      try {
        let selected = this.#selectedRasterSource;
        let sourceMustRemainSelected = selected !== null;
        if (selected === null) {
          const filePath = await this.#dialogs.chooseImportRaster?.();
          assertActive();
          if (filePath === null || filePath === undefined) return;
          deadline = startDeadline();
          const classification = classifyImportSource(filePath);
          if (classification?.kind !== "raster") {
            throw new RangeError("Choose a .png, .jpg, or .jpeg raster file.");
          }
          this.#rasterJob = { operationId, percent: 2, stage: "reading" };
          this.#emit();
          const bytes = await this.#rasterStorage.read(
            filePath,
            abortController.signal,
          );
          assertActive();
          selected = {
            sourceName: basename(filePath),
            source: inspectRasterSource(bytes, classification.format),
            bytes,
          };
          this.#session.cancelVectorImport();
          this.#selectedVectorSource = null;
          if (
            this.#guidedWorkflow.status === "active" &&
            this.#guidedWorkflow.definition?.goal === "import-own-design"
          ) {
            this.#selectedRasterSource = selected;
            sourceMustRemainSelected = true;
            await this.#advanceImportGuidanceStep("choose-file");
          }
        } else {
          deadline = startDeadline();
        }
        this.#rasterJob = { operationId, percent: 5, stage: "decoding" };
        this.#emit();
        const image = await this.#rasterCodec.decode(
          selected.bytes,
          selected.source,
        );
        await yieldForCancellation();
        const result = await this.#rasterWorker.run(
          {
            operationId,
            source: selected.source,
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
          guidedDocumentFingerprint(this.#session.state.project.document) !==
            documentFingerprint ||
          (sourceMustRemainSelected && this.#selectedRasterSource !== selected)
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
          guidedDocumentFingerprint(this.#session.state.project.document) !==
            documentFingerprint ||
          (sourceMustRemainSelected && this.#selectedRasterSource !== selected)
        ) {
          throw new Error(
            "The document changed while raster tracing was running; the stale result was not previewed.",
          );
        }
        this.#session.previewRasterTrace(result.candidate, selected.sourceName);
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
      this.#selectedRasterSource = null;
      await this.#advanceImportGuidanceStep("prepare-source");
      await this.#analyzeCutability(
        randomUUID(),
        accepted.editor.selectionIds,
        objectCutabilityScope(accepted.editor.selectionIds),
      );
    });
  }

  public async rejectRasterTrace(): Promise<CommandResult> {
    return this.#run(async () => {
      this.#session.cancelRasterTrace();
      this.#rasterPreview = null;
      this.#selectedRasterSource = null;
      await this.#returnImportGuidanceToSourceSelection();
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
      await this.#advanceCreateGuidanceFromDocumentOutcome();
      await this.#analyzeCutability(
        randomUUID(),
        objectIds,
        objectCutabilityScope(objectIds),
      );
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

  public async openAiAccountPage(
    target: "keys" | "billing",
  ): Promise<CommandResult> {
    return this.#run(async () => {
      if (this.#openExternal === null) {
        throw new Error("Opening the OpenAI Platform is unavailable in this desktop host.");
      }
      await this.#openExternal(
        target === "keys" ? OPENAI_PLATFORM_SETUP_URL : OPENAI_PLATFORM_BILLING_URL,
      );
    });
  }

  public async connectAi(replacing = false): Promise<CommandResult> {
    return this.#run(async () => {
      if (this.#credentialAbortController !== null) {
        throw new RangeError("Finish or cancel the active credential connection first.");
      }
      const previous = { ...this.#aiConnection };
      const abortController = new AbortController();
      this.#credentialAbortController = abortController;
      this.#aiConnection = {
        ...previous,
        status: "connecting",
        message: replacing
          ? "Waiting for a replacement key in the secure LaserX credential window."
          : "Waiting for a key in the secure LaserX credential window.",
        retryAfterMs: null,
      };
      this.#emit();
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        abortController.abort();
      }, this.#credentialConnectionTimeoutMs);
      let credential: string | null;
      try {
        const canceled = new Promise<never>((_resolve, reject) => {
          abortController.signal.addEventListener("abort", () => {
            reject(timedOut
              ? new CredentialAcquisitionTimeoutError()
              : new CredentialAcquisitionCancelledError());
          }, { once: true });
        });
        credential = await Promise.race([
          this.#credentialAcquisition.acquire(
            this.#aiProvider.name,
            replacing,
            abortController.signal,
          ),
          canceled,
        ]);
      } catch (error) {
        this.#aiConnection = previous;
        if (error instanceof CredentialAcquisitionTimeoutError) throw error;
        if (abortController.signal.aborted) {
          throw new CredentialAcquisitionCancelledError();
        }
        throw error;
      } finally {
        clearTimeout(timeout);
        if (this.#credentialAbortController === abortController) {
          this.#credentialAbortController = null;
        }
      }
      if (credential === null) {
        this.#aiConnection = previous;
        return;
      }
      try {
        await this.#aiProvider.testConnection(credential);
        await this.#credentialVault.write(this.#aiProvider.id, credential);
        this.#aiConnection = {
          providerId: this.#aiProvider.id,
          providerName: this.#aiProvider.name,
          status: "connected",
          model: this.#aiProvider.model,
          message: replacing
            ? "The protected OpenAI API key was replaced and tested."
            : "The OpenAI connection was tested and stored in the operating-system vault.",
          retryAfterMs: null,
        };
      } catch (error) {
        this.#aiConnection = replacing
          ? previous
          : connectionStateForError(this.#aiProvider, error);
        throw error;
      }
    });
  }

  public async cancelAiConnection(): Promise<CommandResult> {
    return this.#run(() => {
      const controller = this.#credentialAbortController;
      if (controller === null) {
        throw new RangeError("There is no active credential connection to cancel.");
      }
      this.#aiConnection = {
        ...this.#aiConnection,
        message: "Canceling secure credential entry and restoring the previous connection.",
      };
      controller.abort();
    });
  }

  public async testAiConnection(): Promise<CommandResult> {
    return this.#run(async () => {
      const credential = await this.#credentialVault.read(this.#aiProvider.id);
      if (credential === null) {
        this.#aiConnection = disconnectedAiState(this.#aiProvider);
        throw new Error("Connect an OpenAI API key before testing the connection.");
      }
      this.#aiConnection = {
        ...this.#aiConnection,
        status: "connecting",
        message: "Testing the protected OpenAI connection.",
        retryAfterMs: null,
      };
      this.#emit();
      try {
        await this.#aiProvider.testConnection(credential);
        this.#aiConnection = {
          providerId: this.#aiProvider.id,
          providerName: this.#aiProvider.name,
          status: "connected",
          model: this.#aiProvider.model,
          message: "The protected OpenAI connection is valid.",
          retryAfterMs: null,
        };
      } catch (error) {
        this.#aiConnection = connectionStateForError(this.#aiProvider, error);
        throw error;
      }
    });
  }

  public async disconnectAi(): Promise<CommandResult> {
    return this.#run(async () => {
      this.#credentialAbortController?.abort();
      this.#aiAbortController?.abort();
      this.#aiAbortController = null;
      this.#aiJob = null;
      await this.#credentialVault.delete(this.#aiProvider.id);
      this.#aiConnection = disconnectedAiState(this.#aiProvider);
    });
  }

  public async attachAiReference(consent: boolean): Promise<CommandResult> {
    return this.#run(async () => {
      if (!consent) {
        throw new Error("Explicit consent is required before attaching a reference image to an AI request.");
      }
      if (this.#dialogs.chooseImportRaster === undefined) {
        throw new Error("Reference-image selection is unavailable in this desktop host.");
      }
      if (this.#rasterCodec === null) {
        throw new Error("Reference-image decoding is unavailable in this desktop host.");
      }
      const filePath = await this.#dialogs.chooseImportRaster();
      if (filePath === null) return;
      const bytes = await this.#rasterStorage.read(filePath);
      if (bytes.byteLength > AI_LIMITS.referenceBytes) {
        throw new RangeError(`AI references cannot exceed ${String(AI_LIMITS.referenceBytes)} bytes.`);
      }
      const format = extname(filePath).toLowerCase() === ".png" ? "png" : "jpeg";
      const source = inspectRasterSource(bytes, format);
      if (source.widthPx * source.heightPx > AI_LIMITS.referencePixels) {
        throw new RangeError("AI reference image exceeds the bounded pixel limit.");
      }
      await this.#rasterCodec.decode(bytes, source);
      const mimeType = format === "png" ? "image/png" : "image/jpeg";
      this.#aiReference = {
        mimeType,
        dataUrl: `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`,
        widthPx: source.widthPx,
        heightPx: source.heightPx,
        byteLength: bytes.byteLength,
        consent: true,
      };
    });
  }

  public async removeAiReference(): Promise<CommandResult> {
    return this.#run(() => {
      this.#aiReference = null;
    });
  }

  public async generateAiConcepts(request: AiGenerateRequest): Promise<CommandResult> {
    return this.#run(async () => {
      if (this.#aiAbortController !== null) {
        throw new RangeError("Finish or cancel the active AI generation first.");
      }
      const credential = await this.#credentialVault.read(this.#aiProvider.id);
      if (credential === null) {
        this.#aiConnection = disconnectedAiState(this.#aiProvider);
        throw new Error("Connect an OpenAI API key before generating concepts.");
      }
      if (request.useReferenceImage && (!request.referenceConsent || this.#aiReference === null)) {
        throw new Error("Attach the reference image with explicit consent before generation.");
      }
      const providerRequest: AiGenerationRequest = {
        operationId: request.operationId,
        prompt: request.prompt,
        wording: request.wording,
        widthMm: request.widthMm,
        heightMm: request.heightMm,
        style: request.style,
        process: request.process,
        detailLevel: request.detailLevel,
        bridgePreference: request.bridgePreference,
        holes: { ...request.holes },
        layerCount: request.layerCount,
        backingPlate: request.backingPlate,
        conceptCount: request.conceptCount,
        referenceImage: request.useReferenceImage ? this.#aiReference : null,
      };
      const abortController = new AbortController();
      const projectFingerprint = this.#session.projectFingerprint;
      this.#aiAbortController = abortController;
      this.#aiJob = {
        operationId: request.operationId,
        percent: 10,
        stage: "requesting",
      };
      this.#emit();
      try {
        const result = await this.#aiProvider.generate(
          providerRequest,
          credential,
          abortController.signal,
        );
        if (abortController.signal.aborted) {
          throw new AiProviderError("canceled", "AI generation was canceled; the open project was left unchanged.");
        }
        this.#aiJob = {
          operationId: request.operationId,
          percent: 60,
          stage: "normalizing",
        };
        this.#emit();
        const normalized: AiNormalizedConcept[] = [];
        for (let index = 0; index < result.concepts.length; index += 1) {
          const raw = result.concepts[index] as AiProviderConcept;
          normalized.push(await this.#normalizeAiConcept(
            raw,
            providerRequest,
            result,
            abortController.signal,
          ));
          this.#aiJob = {
            operationId: request.operationId,
            percent: 60 + Math.round(((index + 1) / result.concepts.length) * 35),
            stage: "normalizing",
          };
          this.#emit();
        }
        if (this.#session.projectFingerprint !== projectFingerprint) {
          throw new Error("The project changed while AI concepts were generated; the stale concepts were discarded.");
        }
        const first = normalized[0];
        if (first === undefined) {
          throw new Error("The provider returned no normalized concepts.");
        }
        this.#aiConcepts = normalized;
        this.#aiRawConcepts = result.concepts.map((concept) => structuredClone(concept));
        this.#aiResult = structuredClone(result);
        this.#aiRequest = structuredClone(providerRequest);
        this.#aiSelectedConceptId = first.summary.id;
        this.#aiProjectFingerprint = projectFingerprint;
        this.#session.previewAiConcept(first, projectFingerprint);
        this.#aiConnection = {
          providerId: this.#aiProvider.id,
          providerName: this.#aiProvider.name,
          status: "connected",
          model: result.model,
          message: "OpenAI concepts were received and normalized by LaserX.",
          retryAfterMs: null,
        };
      } catch (error) {
        if (error instanceof AiProviderError && error.kind !== "canceled") {
          this.#aiConnection = connectionStateForError(this.#aiProvider, error);
        }
        throw error;
      } finally {
        if (this.#aiAbortController === abortController) {
          this.#aiAbortController = null;
          this.#aiJob = null;
        }
      }
    });
  }

  public async cancelAiGeneration(operationId: string): Promise<CommandResult> {
    return this.#run(() => {
      if (
        this.#aiAbortController === null ||
        this.#aiJob?.operationId !== operationId
      ) {
        throw new RangeError("That AI generation operation is not active.");
      }
      this.#aiAbortController.abort();
    });
  }

  public async selectAiConcept(conceptId: string): Promise<CommandResult> {
    return this.#run(() => {
      this.#assertAiConceptsCurrent();
      const concept = this.#aiConcepts.find((candidate) => candidate.summary.id === conceptId);
      if (concept === undefined) throw new RangeError("That AI concept is unavailable.");
      this.#session.previewAiConcept(concept, this.#aiProjectFingerprint as string);
      this.#aiSelectedConceptId = conceptId;
    });
  }

  public async correctAiWording(
    conceptId: string,
    primaryText: string,
    secondaryText: string,
  ): Promise<CommandResult> {
    return this.#run(async () => {
      if (this.#aiAbortController !== null) {
        throw new RangeError("Finish or cancel the active AI operation first.");
      }
      this.#assertAiConceptsCurrent();
      const projectFingerprint = this.#aiProjectFingerprint as string;
      const request = this.#aiRequest;
      const result = this.#aiResult;
      const rawIndex = this.#aiRawConcepts.findIndex((concept) => concept.id === conceptId);
      const raw = this.#aiRawConcepts[rawIndex];
      if (request === null || result === null || raw === undefined) {
        throw new RangeError("That AI concept is unavailable.");
      }
      if (raw.source !== "structured-vector") {
        throw new Error("Raster wording cannot be altered safely. Revise the prompt and generate new concepts.");
      }
      const combined = `${primaryText.trim()} ${secondaryText.trim()}`.trim();
      if (combined.length === 0 || combined.length > AI_LIMITS.wordingCharacters) {
        throw new RangeError("Corrected wording must contain 1 to 200 characters.");
      }
      const corrected: AiProviderConcept = {
        ...raw,
        observedWording: combined,
        intent: {
          ...raw.intent,
          primaryText: primaryText.trim(),
          secondaryText: secondaryText.trim(),
        },
      };
      const abortController = new AbortController();
      const operationId = randomUUID();
      this.#aiAbortController = abortController;
      this.#aiJob = {
        operationId,
        percent: 60,
        stage: "normalizing",
      };
      this.#emit();
      try {
        const concept = await this.#normalizeAiConcept(
          corrected,
          request,
          result,
          abortController.signal,
          combined,
        );
        if (abortController.signal.aborted) {
          throw new AiProviderError("canceled", "AI wording correction was canceled; the open project was left unchanged.");
        }
        if (
          this.#aiProjectFingerprint !== projectFingerprint ||
          this.#session.projectFingerprint !== projectFingerprint
        ) {
          throw new Error("The project changed while AI wording was corrected; the stale correction was discarded.");
        }
        const conceptIndex = this.#aiConcepts.findIndex((candidate) => candidate.summary.id === conceptId);
        if (conceptIndex < 0) {
          throw new RangeError("That AI concept is unavailable.");
        }
        this.#session.previewAiConcept(concept, projectFingerprint);
        this.#aiRawConcepts[rawIndex] = corrected;
        this.#aiConcepts[conceptIndex] = concept;
        this.#aiSelectedConceptId = conceptId;
      } catch (error) {
        if (abortController.signal.aborted && !(error instanceof AiProviderError)) {
          throw new AiProviderError("canceled", "AI wording correction was canceled; the open project was left unchanged.");
        }
        throw error;
      } finally {
        if (this.#aiAbortController === abortController) {
          this.#aiAbortController = null;
          this.#aiJob = null;
        }
      }
    });
  }

  public async acceptAiConcept(): Promise<CommandResult> {
    return this.#run(async () => {
      const preview = this.#session.state.editor.aiConceptPreview;
      if (preview === null) throw new RangeError("There is no AI concept to accept.");
      const objectIds = preview.objects.map((object) => object.id);
      this.#session.acceptAiConceptPreview();
      this.#clearAiConcepts(false);
      this.#invalidateCutability();
      await this.#analyzeCutability(
        randomUUID(),
        objectIds,
        objectCutabilityScope(objectIds),
      );
    });
  }

  public async discardAiConcepts(): Promise<CommandResult> {
    return this.#run(() => {
      this.#session.cancelAiConceptPreview();
      this.#clearAiConcepts(false);
    });
  }

  public async exportVector(
    request: VectorExportRequest,
  ): Promise<CommandResult> {
    return this.#run(async () => {
      this.#assertGuidedWorkflowReadyForExport();
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
      if (!(await this.#advanceCreateGuidanceStep("save-export"))) {
        await this.#advanceImportGuidanceStep("export-result");
      }
    });
  }

  public async exportProductionPackage(
    request: ProductionExportRequest,
  ): Promise<CommandResult> {
    return this.#run(async () => {
      if (this.#dialogs.chooseProductionDirectory === undefined) {
        throw new Error("Production package export is not available in this desktop host.");
      }
      const productionPackage = buildProductionPackage(this.#session.state.project, {
        layerIds: request.layerIds,
        formats: request.formats,
      });
      const targetDirectory = await this.#dialogs.chooseProductionDirectory(
        productionPackage.name,
      );
      if (targetDirectory === null) return;
      const result = await this.#productionStorage.write(
        targetDirectory,
        productionPackage,
        request.conflictPolicy,
      );
      this.#productionExportSummary = {
        status: result.ok ? "success" : "failed",
        packageName: productionPackage.name,
        targetDirectory: result.targetDirectory,
        layerCount: productionPackage.manifest.layers.length,
        fileCount: result.ok ? result.writtenFiles.length : 0,
        warnings: [...productionPackage.manifest.warnings],
        failedFile: result.failedFile,
        error: result.error,
      };
      if (!result.ok) {
        throw new Error(result.error ?? "The production package could not be written.");
      }
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
      await this.#analyzeCutability(
        operationId,
        objectIds,
        objectCutabilityScope(objectIds),
      );
      await this.#advanceGuidanceAfterWholeDesignAnalysis();
    });
  }

  public async runManufacturingLayerAnalysis(
    operationId: string,
    layerId: string,
  ): Promise<CommandResult> {
    return this.#run(async () => {
      const document = this.#session.state.project.document;
      const layer = document.layers.find((candidate) => candidate.id === layerId);
      if (layer === undefined) {
        throw new RangeError("That manufacturing layer is unavailable.");
      }
      const objectIds = manufacturingLayerObjectIds(document, layerId);
      if (objectIds.length === 0) {
        throw new RangeError("Add geometry to the manufacturing layer before analyzing it.");
      }
      await this.#analyzeCutability(operationId, objectIds, {
        kind: "manufacturing-layer",
        layerId,
        layerName: layer.name,
      });
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

  public async runPhysicalPreview(operationId: string): Promise<CommandResult> {
    return this.#run(async () => {
      await this.#buildPhysicalPreview(operationId);
    });
  }

  public async cancelPhysicalPreview(
    operationId: string,
  ): Promise<CommandResult> {
    return this.#run(() => {
      const controller = this.#physicalPreviewAbortControllers.get(operationId);
      if (controller === undefined) {
        throw new RangeError("That physical preview build is not active.");
      }
      controller.abort();
    });
  }

  /**
   * Saves an already-validated preview capture through the privileged
   * filesystem boundary (G5).
   *
   * The renderer supplies only bytes and a flat filename; the *destination*
   * always comes from the main-process save dialog the user confirms here,
   * so the renderer can never steer the write. Reports success, user
   * cancellation, and failure with equal explicitness, and never touches the
   * project: capture is a read-only side effect of a derived view.
   */
  public async savePhysicalPreviewCapture(
    request: SavePhysicalPreviewCaptureRequest,
  ): Promise<CommandResult> {
    return this.#run(async () => {
      const dialogs = this.#dialogs;
      if (dialogs.choosePreviewCapturePath === undefined) {
        throw new RangeError("Saving a preview capture is unavailable in this window.");
      }

      // Every rejection below happens BEFORE the save dialog opens and before
      // any filesystem work: an invalid or stale capture must not even prompt
      // the user, let alone reach disk. The privileged side never trusts the
      // renderer's claims -- it re-derives them from the bytes themselves.
      const reject = (error: string): void => {
        this.#physicalPreviewCapture = {
          status: "failed",
          targetPath: null,
          byteLength: null,
          error,
          assemblyFingerprint: fingerprintPhysicalPreviewInput(this.#session.state.project),
        };
      };

      const currentAssembly = this.state.physicalPreview.assembly;
      if (currentAssembly === null) {
        reject("There is no current physical preview to capture, so nothing was written.");
        return;
      }
      if (currentAssembly.fingerprint !== request.assemblyFingerprint) {
        reject(
          "The capture no longer matches the current physical preview, so nothing was written.",
        );
        return;
      }

      const pngBytes = Buffer.from(request.pngBase64, "base64");
      // Round-trips the decode: base64 that silently drops invalid characters
      // would otherwise write a corrupt PNG that still looked plausible.
      if (pngBytes.byteLength === 0 || pngBytes.toString("base64") !== request.pngBase64) {
        reject("The capture image data was malformed, so nothing was written.");
        return;
      }
      if (pngBytes.byteLength < MINIMUM_CAPTURE_PNG_BYTES) {
        reject("The capture image was too small to be a real PNG, so nothing was written.");
        return;
      }
      // Checked here, before the dialog, against the same constant the writer
      // enforces: a payload the writer would reject must never prompt the
      // user for a destination first.
      if (pngBytes.byteLength > MAX_CAPTURE_BYTES) {
        reject("The capture exceeds the 64 MB safety limit, so nothing was written.");
        return;
      }
      // Bounds the *decoded* cost before any native decode is attempted.
      // MAX_CAPTURE_BYTES caps only the compressed payload, so a few kilobytes
      // advertising enormous dimensions would otherwise ask the decoder for a
      // multi-gigabyte allocation inside the privileged process. Repeated here
      // independently of the schema, because main must not trust preload.
      if (!isWithinCapturePixelBudget(request.widthPx, request.heightPx)) {
        reject(
          "The capture dimensions exceed the supported preview size, so nothing was written.",
        );
        return;
      }

      // Reuses the accepted pure PNG validation rather than a second decoder,
      // so main and renderer agree on what a valid PNG is by construction.
      // The header alone is not sufficient -- it proves only the signature,
      // IHDR marker, and dimensions, so a truncated or CRC-corrupt chunk
      // stream behind a plausible header would still pass. The full structure
      // walk additionally proves chunk framing, every CRC, a real IDAT, and a
      // terminal IEND with no trailing bytes.
      const captureBytes = new Uint8Array(pngBytes);
      const structureFailure = validatePngStructure(captureBytes);
      if (structureFailure !== null) {
        reject(
          `The capture was not a complete, valid PNG image (${structureFailure}), so nothing was written.`,
        );
        return;
      }
      const header = readPngHeader(captureBytes);
      if (header === null) {
        reject("The capture was not a valid PNG image, so nothing was written.");
        return;
      }
      if (header.widthPx !== request.widthPx || header.heightPx !== request.heightPx) {
        reject(
          "The capture dimensions did not match the encoded image, so nothing was written.",
        );
        return;
      }

      // Structure validation proves framing, CRCs, chunk shape, and ordering,
      // but not that the compressed image data actually decompresses. A real
      // decoder is the only thing that can prove the bytes are a usable
      // image, so it runs here -- still before any dialog or filesystem work.
      const decoded = this.#previewCaptureDecoder.decode(captureBytes);
      if (decoded === null) {
        reject(
          "The capture could not be decoded as an image, so nothing was written.",
        );
        return;
      }
      // The decoder is a third independent opinion on the dimensions; all of
      // the encoded IHDR, the typed request, and the decode must agree.
      if (
        decoded.widthPx !== header.widthPx ||
        decoded.heightPx !== header.heightPx ||
        decoded.widthPx !== request.widthPx ||
        decoded.heightPx !== request.heightPx
      ) {
        reject(
          "The decoded capture dimensions did not match the encoded image, so nothing was written.",
        );
        return;
      }

      // Independently proves the decoded image is not blank. The renderer runs
      // the same check, but main cannot rely on that: a trusted-main-frame IPC
      // payload could still carry a perfectly decodable all-transparent or
      // all-background PNG, and saving it as a customer capture would be a
      // silent failure. Uses the shared background/tolerance contract so the
      // two sides cannot drift into disagreeing about what "blank" means, and
      // derives the answer from the pixels rather than any renderer-supplied
      // flag.
      let decodedContent: PixelContentEvidence;
      try {
        decodedContent = analyzePixelContent(
          decoded.rgba,
          decoded.widthPx,
          decoded.heightPx,
          PREVIEW_CAPTURE_BACKGROUND,
        );
      } catch {
        reject("The decoded capture pixels were unusable, so nothing was written.");
        return;
      }
      if (decodedContent.nonBackgroundPixels === 0) {
        reject(
          "The capture contains only background pixels, so nothing was rendered and nothing was written.",
        );
        return;
      }

      const chosenPath = await dialogs.choosePreviewCapturePath(request.filename);
      if (chosenPath === null) {
        this.#physicalPreviewCapture = {
          status: "canceled",
          targetPath: null,
          byteLength: null,
          error: null,
          // Fingerprint match against request.assemblyFingerprint was already
          // proven above, so currentAssembly.fingerprint is the live value.
          // The state getter gates capture visibility against the physical
          // *input* content fingerprint (matching the assembly staleness
          // check), not the assembly's own output-scene fingerprint used
          // above to validate the request -- those are different hashes.
          assemblyFingerprint: fingerprintPhysicalPreviewInput(this.#session.state.project),
        };
        return;
      }

      const result = await this.#previewCaptureStorage.write(
        chosenPath,
        new Uint8Array(pngBytes),
        request.overwrite ? "replace" : "fail",
      );
      this.#physicalPreviewCapture = result.ok
        ? {
            status: "saved",
            targetPath: result.targetPath,
            byteLength: result.byteLength,
            error: null,
            // The state getter gates capture visibility against the physical
          // *input* content fingerprint (matching the assembly staleness
          // check), not the assembly's own output-scene fingerprint used
          // above to validate the request -- those are different hashes.
          assemblyFingerprint: fingerprintPhysicalPreviewInput(this.#session.state.project),
          }
        : {
            status: "failed",
            targetPath: result.targetPath,
            byteLength: null,
            error: result.error,
            // The state getter gates capture visibility against the physical
          // *input* content fingerprint (matching the assembly staleness
          // check), not the assembly's own output-scene fingerprint used
          // above to validate the request -- those are different hashes.
          assemblyFingerprint: fingerprintPhysicalPreviewInput(this.#session.state.project),
          };
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
      const issue = this.#cutabilityProjection?.cutability.issues.find(
        (candidate) => candidate.id === issueId,
      );
      if (issue === undefined) {
        throw new RangeError("That manufacturing issue is not available.");
      }
      this.#focusedCutabilityIssueId = issue.id;
      this.#session.selectObjectIds(issue.objectIds);
    });
  }

  public async previewSafeRepairs(): Promise<CommandResult> {
    return this.#run(() => {
      const projection = this.#cutabilityProjection;
      if (projection === null) {
        throw new RangeError("Run manufacturing analysis before previewing safe repairs.");
      }
      const proposal = proposeSafeRepairs(
        this.#session.state.project.document,
        projection.cutability,
      );
      this.#safeRepairVisualPreview = buildSafeRepairVisualPreview(
        this.#session.state.project.document,
        proposal,
      );
      this.#safeRepairProposal = proposal;
      this.#safeRepairResult = null;
    });
  }

  public async acceptSafeRepairs(): Promise<CommandResult> {
    return this.#run(async () => {
      const proposal = this.#safeRepairProposal;
      const projection = this.#cutabilityProjection;
      if (proposal === null) {
        throw new RangeError("There is no safe-repair preview to accept.");
      }
      if (projection === null) {
        throw new Error("The repair findings changed after this preview. Run analysis again.");
      }
      const before = this.#session.state.project.document;
      if (
        fingerprintCutabilityDocument(before) !== proposal.documentFingerprint ||
        fingerprintCutabilityAnalysis(projection.cutability) !==
          proposal.analysisFingerprint
      ) {
        throw new Error(
          "The document or repair findings changed after this preview. Preview safe repairs again.",
        );
      }
      const plannedIssues = projection.cutability.issues.filter((issue) =>
        proposal.plannedFindingIds.includes(issue.id),
      );

      const replacementIds = new Set(
        proposal.replacements.map((object) => object.id),
      );
      const beforeNodeCount = before.objects.reduce(
        (count, object) =>
          object.type === "path" && replacementIds.has(object.id)
            ? count + object.points.length
            : count,
        0,
      );
      this.#session.beginTransaction("Fix safe problems");
      try {
        if (proposal.deleteObjectIds.length > 0) {
          this.#session.executeEditorCommand({
            type: "objects.delete",
            objectIds: proposal.deleteObjectIds,
          });
        }
        if (proposal.replacements.length > 0) {
          this.#session.applyTopologyReplacement(
            {
              type: "objects.replace-topology",
              sourceObjectIds: proposal.replacements.map((object) => object.id),
              replacements: proposal.replacements,
            },
            {
              operation: "Fix safe problems",
              beforeNodeCount,
              afterNodeCount: proposal.replacements.reduce(
                (count, object) => count + object.points.length,
                0,
              ),
              replacedObjectIds: proposal.replacements.map(
                (object) => object.id,
              ),
              discardedObjectIds: [...proposal.deleteObjectIds],
              warnings: [
                "Automated cleanup does not prove cut readiness or physical safety.",
              ],
              message: proposal.summary,
            },
          );
        }
        this.#session.commitTransaction();
      } catch (error) {
        this.#session.cancelTransaction();
        throw error;
      }

      const scope = projection.scope;
      this.#invalidateCutability();
      const document = this.#session.state.project.document;
      if (scope.kind === "manufacturing-layer") {
        const layer = document.layers.find(
          (candidate) => candidate.id === scope.layerId,
        );
        if (layer === undefined) {
          throw new RangeError("That manufacturing layer is unavailable.");
        }
        const objectIds = manufacturingLayerObjectIds(
          document,
          scope.layerId,
        );
        const layerScope = {
          kind: "manufacturing-layer" as const,
          layerId: scope.layerId,
          layerName: layer.name,
        };
        if (objectIds.length === 0) {
          this.#publishCutabilityAnalysis(
            layerScope,
            analyzeDocumentCutability(document, {
              operationId: randomUUID(),
              objectIds: [],
              objectIdsMode: "exact",
            }),
          );
        } else {
          await this.#analyzeCutability(
            randomUUID(),
            objectIds,
            layerScope,
          );
        }
      } else if (scope.kind === "selection") {
        const availableIds = new Set(
          document.objects.map((object) => object.id),
        );
        const objectIds = scope.objectIds.filter((id) => availableIds.has(id));
        if (objectIds.length === 0) {
          await this.#analyzeCutability(randomUUID(), [], {
            kind: "whole-design",
            layerId: null,
            layerName: null,
          });
        } else {
          await this.#analyzeCutability(randomUUID(), objectIds, {
            kind: "selection",
            layerId: null,
            layerName: null,
            objectIds,
          });
        }
      } else {
        await this.#analyzeCutability(randomUUID(), [], {
          kind: "whole-design",
          layerId: null,
          layerName: null,
        });
      }

      const currentIssues = this.#cutabilityProjection?.cutability.issues ?? [];
      const stillPresentPlannedCount = plannedIssues.filter((planned) =>
        currentIssues.some(
          (current) =>
            current.repairHint === planned.repairHint &&
            current.objectIds.some((id) => planned.objectIds.includes(id)),
        ),
      ).length;
      const fixedCount = Math.max(
        0,
        plannedIssues.length - stillPresentPlannedCount,
      );
      const remainingCount =
        this.#cutabilityProjection?.cutability.issueCount ?? 0;
      this.#safeRepairResult = {
        fixedCount,
        skippedCount: proposal.skippedFindingIds.length,
        remainingCount,
        summary: `Fixed ${String(fixedCount)}, skipped ${String(proposal.skippedFindingIds.length)}, ${String(remainingCount)} finding(s) remain after reanalysis.`,
        disclaimer:
          "The design was reanalyzed. Automated cleanup does not prove cut readiness or physical safety.",
      };
      await this.#advanceGuidanceAfterWholeDesignAnalysis();
    });
  }

  public async rejectSafeRepairs(): Promise<CommandResult> {
    return this.#run(() => {
      this.#safeRepairProposal = null;
      this.#safeRepairVisualPreview = null;
    });
  }

  public async previewBridge(
    request: BridgeProposalRequestDto,
  ): Promise<CommandResult> {
    return this.#run(() => {
      if (this.#cutabilityProjection === null) {
        throw new RangeError("Run manufacturing analysis before proposing a bridge.");
      }
      this.#bridgeProposal = proposeBridge(
        this.#session.state.project.document,
        this.#cutabilityProjection.cutability,
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
      const analysisScope = this.#cutabilityProjection?.scope;
      if (analysisScope === undefined) {
        throw new RangeError("Run manufacturing analysis before accepting a bridge.");
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
      if (analysisScope.kind === "manufacturing-layer") {
        const layer = state.project.document.layers.find(
          (candidate) => candidate.id === analysisScope.layerId,
        );
        if (layer === undefined) {
          throw new RangeError("That manufacturing layer is unavailable.");
        }
        await this.#analyzeCutability(
          randomUUID(),
          manufacturingLayerObjectIds(
            state.project.document,
            analysisScope.layerId,
          ),
          {
            kind: "manufacturing-layer",
            layerId: analysisScope.layerId,
            layerName: layer.name,
          },
        );
      } else if (analysisScope.kind === "selection") {
        const replacedIds = new Set(proposal.sourceObjectIds);
        const availableIds = new Set(
          state.project.document.objects.map((object) => object.id),
        );
        const objectIds = analysisScope.objectIds.filter(
          (id) => !replacedIds.has(id) && availableIds.has(id),
        );
        if (analysisScope.objectIds.some((id) => replacedIds.has(id))) {
          objectIds.push(...replacements.map((object) => object.id));
        }
        const remappedObjectIds = [...new Set(objectIds)].sort();
        if (remappedObjectIds.length === 0) {
          throw new Error("The analyzed selection could not be mapped after bridge acceptance.");
        }
        await this.#analyzeCutability(randomUUID(), remappedObjectIds, {
          kind: "selection",
          layerId: null,
          layerName: null,
          objectIds: remappedObjectIds,
        });
      } else {
        await this.#analyzeCutability(randomUUID(), [], {
          kind: "whole-design",
          layerId: null,
          layerName: null,
        });
      }
      await this.#advanceGuidanceAfterWholeDesignAnalysis();
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
    return this.#run(async () => {
      const documentBefore = this.#session.state.project.document;
      const cutabilityBefore = fingerprintCutabilityDocument(documentBefore);
      const guidedBefore = guidedDocumentFingerprint(documentBefore);
      this.#session.performEditorAction(request);
      const documentAfter = this.#session.state.project.document;
      const cutabilityAfter = fingerprintCutabilityDocument(documentAfter);
      const guidedAfter = guidedDocumentFingerprint(documentAfter);
      if (cutabilityAfter !== cutabilityBefore || guidedAfter !== guidedBefore) {
        this.#invalidateCutability();
      }
      await this.#advanceCreateGuidanceFromDocumentOutcome();
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
    return this.#run(async () => {
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
      await this.#advanceCreateGuidanceFromDocumentOutcome();
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
        await this.#invalidateGuidanceForProjectReplacement();
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

  public async onboardingAction(
    request: OnboardingActionRequest,
  ): Promise<CommandResult> {
    return this.#run(async () => {
      this.#onboardingRecoveryNotice = null;

      if (request.type === "set-learn-mode") {
        await this.#replaceOnboardingPreferences({
          ...this.#onboardingPreferences,
          learnModeEnabled: request.enabled,
        });
        return;
      }

      if (request.type === "complete-learn-topic") {
        await this.#replaceOnboardingPreferences({
          ...this.#onboardingPreferences,
          completedLearnTopics: [
            ...new Set([
              ...this.#onboardingPreferences.completedLearnTopics,
              request.topic,
            ]),
          ],
        });
        return;
      }

      if (request.type === "reopen-learn-topic") {
        await this.#replaceOnboardingPreferences({
          ...this.#onboardingPreferences,
          completedLearnTopics:
            this.#onboardingPreferences.completedLearnTopics.filter(
              (topic) => topic !== request.topic,
            ),
        });
        return;
      }

      if (request.type === "replay") {
        if (this.#guidedWorkflow.definition?.goal !== request.goal) {
          throw new Error("That guidance run is no longer available to replay.");
        }
        const next = reduceGuidedWorkflow(this.#guidedWorkflow, {
          type: "replay",
          expectedRunToken: request.expectedRunToken,
          nextRunToken: randomUUID(),
        });
        const didReplay = next !== this.#guidedWorkflow;
        await this.#applyGuidedWorkflow(next, { dismissed: false });
        if (didReplay) {
          this.#guidedPreviewCompletion = null;
          this.#guidedAnalysisCompletion = null;
        }
        return;
      }

      if (request.type === "switch-goal") {
        if (
          !isTerminalStatus(this.#guidedWorkflow.status) ||
          this.#guidedWorkflow.runToken !== request.expectedRunToken ||
          this.#guidedWorkflow.definition?.goal === request.goal
        ) {
          return;
        }
        if (
          request.goal === "describe-with-ai" &&
          this.#aiConnection.status !== "connected"
        ) {
          throw new Error(
            "AI guidance is optional and is available after an AI account is connected.",
          );
        }

        // Keep the reducer's source-status contract intact: leave the exact
        // terminal run first, then start the selected goal from idle. The
        // expected terminal token makes a delayed choice a no-op rather than
        // allowing it to replace a newer run.
        const idle = reduceGuidedWorkflow(this.#guidedWorkflow, {
          type: "cancel",
        });
        const next = reduceGuidedWorkflow(idle, {
          type: "start",
          definition: guidedGoal(request.goal).definition,
          runToken: randomUUID(),
          projectId: this.#session.state.project.project.id,
        });
        await this.#applyGuidedWorkflow(next, { dismissed: false });
        this.#guidedPreviewCompletion = null;
        this.#guidedAnalysisCompletion = null;
        return;
      }

      if (request.type === "start") {
        if (
          request.goal === "describe-with-ai" &&
          this.#aiConnection.status !== "connected"
        ) {
          throw new Error(
            "AI guidance is optional and is available after an AI account is connected.",
          );
        }
        const next = reduceGuidedWorkflow(this.#guidedWorkflow, {
          type: "start",
          definition: guidedGoal(request.goal).definition,
          runToken: randomUUID(),
          projectId: this.#session.state.project.project.id,
        });
        const didStart = next !== this.#guidedWorkflow;
        await this.#applyGuidedWorkflow(next, { dismissed: false });
        if (didStart) {
          this.#guidedPreviewCompletion = null;
          this.#guidedAnalysisCompletion = null;
        }
        return;
      }

      if (request.type === "resume") {
        const snapshot = this.#onboardingPreferences.activeWorkflow;
        if (snapshot === null) {
          throw new Error("There is no saved guidance session to resume.");
        }
        const definition = guidedGoal(snapshot.goal).definition;
        const liveBinding = this.#liveGuidedBinding();
        if (!canResumeSnapshot(definition, snapshot, liveBinding)) {
          if (
            snapshot.projectBinding.projectId !== liveBinding.projectId ||
            snapshot.projectBinding.documentId !== liveBinding.documentId
          ) {
            this.#onboardingRecoveryNotice =
              "Open the exact project this guidance belongs to before resuming. The saved guidance was kept.";
            return;
          }
          await this.#replaceOnboardingPreferences({
            ...this.#onboardingPreferences,
            activeWorkflow: null,
          });
          this.#onboardingRecoveryNotice =
            "Saved guidance did not match this exact project and was not resumed. Your design was not changed.";
          return;
        }
        const resumeStepId = resolveResumeStepId(definition, snapshot);
        const next = reduceGuidedWorkflow(this.#guidedWorkflow, {
          type: "resume",
          definition,
          snapshot,
          runToken: randomUUID(),
          liveBinding,
        });
        const didResume = next !== this.#guidedWorkflow;
        if (resumeStepId !== snapshot.currentStepId) {
          this.#onboardingRecoveryNotice =
            "LaserX returned to the nearest saved checkpoint because the previous preview or analysis was temporary.";
        }
        await this.#applyGuidedWorkflow(next, { dismissed: false });
        if (didResume) {
          const isOutcomeGuidedGoal =
            next.definition?.goal === "create-first-sign" ||
            next.definition?.goal === "import-own-design";
          const finalStepId = next.definition?.goal === "create-first-sign"
            ? "save-export"
            : "export-result";
          this.#guidedAnalysisCompletion =
            isOutcomeGuidedGoal &&
            (next.currentStepId === "physical-preview" ||
              next.currentStepId === finalStepId) &&
            next.completedStepIds.includes("analyze-cutability") &&
            next.completedStepIds.includes("resolve-findings") &&
            next.runToken !== null
              ? {
                  runToken: next.runToken,
                  documentFingerprint: guidedDocumentFingerprint(
                    this.#session.state.project.document,
                  ),
                }
              : null;
          this.#guidedPreviewCompletion =
            isOutcomeGuidedGoal &&
            next.currentStepId === finalStepId &&
            next.completedStepIds.includes("physical-preview") &&
            next.runToken !== null
              ? {
                  runToken: next.runToken,
                  inputFingerprint: fingerprintPhysicalPreviewInput(
                    this.#session.state.project,
                  ),
                }
              : null;
        }
        return;
      }

      if (request.type === "exit") {
        const exitingImportGuidance =
          this.#guidedWorkflow.definition?.goal === "import-own-design";
        const next = reduceGuidedWorkflow(this.#guidedWorkflow, {
          type: "dismiss",
          runToken: request.runToken,
        });
        const didExit = next !== this.#guidedWorkflow;
        await this.#applyGuidedWorkflow(next);
        if (didExit) {
          this.#guidedPreviewCompletion = null;
          this.#guidedAnalysisCompletion = null;
          if (exitingImportGuidance) this.#clearPendingImportSource();
        }
        return;
      }

      if (request.type === "back") {
        const previousGoal = this.#guidedWorkflow.definition?.goal;
        const previousStepId = this.#guidedWorkflow.currentStepId;
        const next = reduceGuidedWorkflow(this.#guidedWorkflow, {
          type: "back",
          expectedStepId: request.expectedStepId,
          runToken: request.runToken,
        });
        const didBack = next !== this.#guidedWorkflow;
        await this.#applyGuidedWorkflow(next);
        if (
          didBack &&
          (next.definition?.goal === "create-first-sign" ||
            next.definition?.goal === "import-own-design")
        ) {
          this.#guidedPreviewCompletion = null;
        }
        if (
          didBack &&
          previousGoal === "import-own-design" &&
          previousStepId === "prepare-source"
        ) {
          this.#clearPendingImportSource();
        }
        return;
      }

      if (request.type === "skip") {
        if (
          this.#guidedWorkflow.definition === null ||
          !isStepSkippable(
            this.#guidedWorkflow.definition,
            this.#guidedWorkflow.currentStepId,
          )
        ) {
          throw new Error("This guidance step is required and cannot be skipped.");
        }
        await this.#applyGuidedWorkflow(
          reduceGuidedWorkflow(this.#guidedWorkflow, {
            type: "skip-step",
            expectedStepId: request.expectedStepId,
            runToken: request.runToken,
          }),
        );
        return;
      }

      let acceptedGuidedPreviewFingerprint: string | null = null;
      let acceptedGuidedAnalysis = false;
      let acceptedGuidedResolution = false;
      const guidedGoalId = this.#guidedWorkflow.definition?.goal;
      const isOutcomeGuidedGoal =
        guidedGoalId === "create-first-sign" ||
        guidedGoalId === "import-own-design";
      const isResolutionStep =
        this.#guidedWorkflow.currentStepId === "resolve-findings";
      if (isResolutionStep) {
        if (request.completion.kind !== "resolution") {
          throw new Error(
            "The findings checkpoint can only continue through its guarded resolution action.",
          );
        }
        const liveCounts = this.#currentResolutionCounts();
        if (
          liveCounts === null ||
          JSON.stringify(liveCounts) !== JSON.stringify(request.completion.counts)
        ) {
          throw new Error(
            "The findings changed. Review the current analysis before continuing.",
          );
        }
        if (
          isOutcomeGuidedGoal &&
          !this.#hasCurrentGuidedAnalysisEvidence()
        ) {
          throw new Error(
            "The physical document changed after analysis. Run Analyze all again before continuing.",
          );
        }
        const permitted =
          request.completion.trigger === "automatic"
            ? shouldAutoCompleteResolution(liveCounts)
            : canCompleteResolution(liveCounts);
        if (!permitted) {
          throw new Error("Blocking findings must be resolved before continuing.");
        }
        acceptedGuidedResolution = isOutcomeGuidedGoal;
      } else if (guidedGoalId === "create-first-sign") {
        switch (this.#guidedWorkflow.currentStepId) {
          case "choose-size-material":
            if (request.completion.kind !== "step") {
              throw new Error("Confirm the current size and physical material setup first.");
            }
            if (!this.#createGuidanceHasPhysicalStock()) {
              throw new Error(
                "Set positive real dimensions and assign material and thickness to a physical layer before continuing.",
              );
            }
            break;
          case "add-content":
            if (request.completion.kind !== "step") {
              throw new Error("Confirm the current physical-layer content first.");
            }
            if (!this.#createGuidanceHasPhysicalContent()) {
              throw new Error(
                "Add at least one real object to a physical manufacturing layer before continuing.",
              );
            }
            break;
          case "analyze-cutability":
            if (request.completion.kind !== "step") {
              throw new Error("Confirm the current whole-design analysis first.");
            }
            if (
              !this.#createGuidanceHasPhysicalStock() ||
              !this.#createGuidanceHasPhysicalContent() ||
              !this.#hasCurrentWholeDesignAnalysis()
            ) {
              throw new Error(
                "Keep real physical material and content in the design, then run Analyze all before continuing. Selection or layer-only analysis is not sufficient.",
              );
            }
            acceptedGuidedAnalysis = true;
            break;
          case "physical-preview":
            if (request.completion.kind !== "physical-preview") {
              throw new Error(
                "Open the required 3D preview and render it, or explicitly acknowledge its current failure route.",
              );
            }
            this.#assertGuidedPhysicalPreviewCompletion(request.completion);
            acceptedGuidedPreviewFingerprint = fingerprintPhysicalPreviewInput(
              this.#session.state.project,
            );
            break;
          case "save-export":
            throw new Error(
              "Export SVG or DXF successfully to complete Create My First Sign.",
            );
          default:
            if (request.completion.kind !== "step") {
              throw new Error("That completion does not match this guidance checkpoint.");
            }
        }
      } else if (guidedGoalId === "import-own-design") {
        switch (this.#guidedWorkflow.currentStepId) {
          case "choose-file":
            throw new Error(
              "Choose an SVG, DXF, PNG, or JPEG source before continuing.",
            );
          case "prepare-source":
            throw new Error(
              "Accept the vector import or traced editable paths before continuing.",
            );
          case "assign-physical":
            if (request.completion.kind !== "step") {
              throw new Error("Confirm the imported physical-layer setup first.");
            }
            if (
              !this.#createGuidanceHasPhysicalStock() ||
              !this.#createGuidanceHasPhysicalContent()
            ) {
              throw new Error(
                "Assign material, thickness, and a physical role to an imported layer that contains editable geometry.",
              );
            }
            break;
          case "analyze-cutability":
            if (request.completion.kind !== "step") {
              throw new Error("Confirm the current whole-design analysis first.");
            }
            if (
              !this.#createGuidanceHasPhysicalStock() ||
              !this.#createGuidanceHasPhysicalContent() ||
              !this.#hasCurrentWholeDesignAnalysis()
            ) {
              throw new Error(
                "Keep the imported editable geometry on a physical layer, then run Analyze all. Selection or layer-only analysis is not sufficient.",
              );
            }
            acceptedGuidedAnalysis = true;
            break;
          case "physical-preview":
            if (request.completion.kind !== "physical-preview") {
              throw new Error(
                "Open the required 3D preview and render it, or explicitly acknowledge its current failure route.",
              );
            }
            this.#assertGuidedPhysicalPreviewCompletion(request.completion);
            acceptedGuidedPreviewFingerprint = fingerprintPhysicalPreviewInput(
              this.#session.state.project,
            );
            break;
          case "export-result":
            throw new Error(
              "Export SVG or DXF successfully to complete Import My Own Design.",
            );
          default:
            if (request.completion.kind !== "step") {
              throw new Error("That completion does not match this guidance checkpoint.");
            }
        }
      } else if (request.completion.kind !== "step") {
        throw new Error("That completion is only valid at its matching checkpoint.");
      }

      let next = reduceGuidedWorkflow(this.#guidedWorkflow, {
        type: "advance",
        expectedStepId: request.expectedStepId,
        runToken: request.runToken,
      });
      if (next.status === "active" && next.currentStepId === "resolve-findings") {
        const counts = this.#currentResolutionCounts();
        if (counts !== null && shouldAutoCompleteResolution(counts)) {
          next = reduceGuidedWorkflow(next, {
            type: "advance",
            expectedStepId: "resolve-findings",
            runToken: next.runToken as string,
          });
        }
      }
      const didAdvance = next !== this.#guidedWorkflow;
      await this.#applyGuidedWorkflow(next);
      if (
        didAdvance &&
        (acceptedGuidedAnalysis ||
          acceptedGuidedResolution ||
          ((next.definition?.goal === "create-first-sign" ||
            next.definition?.goal === "import-own-design") &&
            next.currentStepId === "physical-preview" &&
            this.#hasCurrentWholeDesignAnalysis()))
      ) {
        this.#recordGuidedAnalysisCompletion();
      }
      if (didAdvance && acceptedGuidedPreviewFingerprint !== null) {
        this.#guidedPreviewCompletion = {
          runToken: request.runToken,
          inputFingerprint: acceptedGuidedPreviewFingerprint,
        };
      }
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

  public async prepareEmergencyRecovery(): Promise<void> {
    this.stop();
    const autosave = this.#autosaveInFlight;
    if (autosave !== null) {
      await autosave;
    }
    await this.#autosave();
    await this.#logger.info("recovery-emergency-snapshot-complete");
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
    project.project.name = projectNameForPath(project.project.name, normalized);
    await this.#invalidateGuidanceForProjectReplacement();
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
    if (current.editor.importPreview !== null) {
      throw new Error(
        "The SVG or DXF artwork is still a preview and is not part of the project yet. Accept or cancel the vector import before saving.",
      );
    }
    if (current.editor.rasterTracePreview !== null) {
      throw new Error(
        "The traced artwork is still a preview and is not part of the project yet. Accept or reject the raster trace before saving.",
      );
    }
    if (current.editor.signToolPreview !== null) {
      throw new Error(
        "The generated sign is still a preview and is not part of the project yet. Accept or reject the sign preview before saving.",
      );
    }
    if (current.editor.aiConceptPreview !== null) {
      throw new Error(
        "The AI concept is still a preview and is not part of the project yet. Accept or discard the concept before saving.",
      );
    }
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
    project.project.name = projectNameForPath(
      project.project.name,
      normalized,
    );
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

  async #normalizeAiConcept(
    concept: AiProviderConcept,
    request: AiGenerationRequest,
    result: AiProviderResult,
    signal: AbortSignal,
    requestedWording = request.wording,
  ): Promise<AiNormalizedConcept> {
    signal.throwIfAborted();
    let layers: Layer[];
    let objects: DocumentObject[];
    const warnings = [...concept.warnings];
    if (concept.source === "structured-vector") {
      const minimumDimension = Math.min(request.widthMm, request.heightMm);
      const holeDiameterMm = request.holes.enabled
        ? Math.min(request.holes.diameterMm, minimumDimension * 0.15)
        : 0;
      const holeInsetMm = request.holes.enabled
        ? Math.max(
            holeDiameterMm / 2,
            Math.min(request.holes.insetMm, request.widthMm / 2),
          )
        : 0;
      let candidate = generateSignToolCandidate({
        kind: "template",
        stylePresetId: concept.intent.stylePresetId,
        parameters: {
          kind: concept.intent.kind,
          shape: "rectangle",
          widthMm: request.widthMm,
          heightMm: request.heightMm,
          borderWidthMm: Math.max(
            0.5,
            Math.min(concept.intent.borderWidthMm, minimumDimension * 0.2),
          ),
          holeDiameterMm,
          holeInsetMm,
          fontId: "provider-selection-is-not-authoritative",
          fontSizeMm: Math.max(
            2,
            Math.min(concept.intent.fontSizeMm, request.heightMm * 0.35),
          ),
          primaryText: concept.intent.primaryText,
          secondaryText: concept.intent.secondaryText,
          arcRadiusMm: concept.intent.arcRadiusMm === null
            ? null
            : Math.max(
                1,
                Math.min(concept.intent.arcRadiusMm, request.widthMm / 2),
              ),
        },
      }, {
        document: this.#session.state.project.document,
        selectedObjectIds: [],
        createId: () => randomUUID(),
        layoutText: (layoutRequest) => this.#fontEngine.layout(layoutRequest),
      });
      if (!request.backingPlate) {
        const backingLayerId = candidate.layers.find(
          (layer) => layer.name === "Sign Backing",
        )?.id;
        if (backingLayerId !== undefined) {
          candidate = {
            ...candidate,
            layers: candidate.layers.map((layer) =>
              layer.id === backingLayerId
                ? { ...layer, name: "AI Sign Layer" }
                : layer,
            ),
            objects: candidate.objects.filter(
              (object) => object.layerId !== backingLayerId,
            ),
          };
        }
      }
      const normalized = normalizedLayerCount(candidate, request.layerCount);
      layers = normalized.layers;
      objects = normalized.objects;
      warnings.push(...candidate.summary.warnings);
      if (concept.intent.backingPlate !== request.backingPlate) {
        warnings.push("LaserX used the explicit backing-plate choice instead of the provider suggestion.");
      }
    } else {
      if (this.#rasterCodec === null) {
        throw new Error("Raster fallback is unavailable in this desktop host.");
      }
      const prefix = `data:${concept.raster.mimeType};base64,`;
      if (!concept.raster.dataUrl.startsWith(prefix)) {
        throw new RangeError("AI raster fallback data is invalid.");
      }
      const bytes = new Uint8Array(Buffer.from(
        concept.raster.dataUrl.slice(prefix.length),
        "base64",
      ));
      if (
        bytes.byteLength !== concept.raster.byteLength ||
        bytes.byteLength <= 0 ||
        bytes.byteLength > AI_LIMITS.referenceBytes
      ) {
        throw new RangeError("AI raster fallback exceeds its byte boundary.");
      }
      const format = concept.raster.mimeType === "image/png" ? "png" : "jpeg";
      const source = inspectRasterSource(bytes, format);
      if (
        source.widthPx !== concept.raster.widthPx ||
        source.heightPx !== concept.raster.heightPx
      ) {
        throw new RangeError("AI raster fallback dimensions do not match its validated header.");
      }
      const image = await this.#rasterCodec.decode(bytes, source);
      signal.throwIfAborted();
      const settings = {
        ...settingsForRasterTracePreset("balanced"),
        outputWidthMm: request.widthMm,
      };
      const traced = await this.#rasterWorker.run({
        operationId: `${request.operationId}:${concept.id}`,
        source,
        image,
        settings,
      }, signal, () => undefined);
      signal.throwIfAborted();
      const layer: Layer = {
        id: randomUUID(),
        name: "AI Raster Trace",
        visible: true,
        locked: false,
      };
      const scaleX = request.widthMm / traced.candidate.summary.outputWidthMm;
      const scaleY = request.heightMm / traced.candidate.summary.outputHeightMm;
      layers = [layer];
      objects = traced.candidate.paths.map<PathObject>((path) => ({
        id: randomUUID(),
        type: "path",
        layerId: layer.id,
        transform: identityTransform(),
        closed: path.closed,
        points: path.points.map((point) => ({
          xMm: point.xMm * scaleX,
          yMm: point.yMm * scaleY,
        })),
        ...(path.handles === undefined
          ? {}
          : {
              handles: path.handles.map((handles) => ({
                incoming: handles.incoming === null
                  ? null
                  : {
                      xMm: handles.incoming.xMm * scaleX,
                      yMm: handles.incoming.yMm * scaleY,
                    },
                outgoing: handles.outgoing === null
                  ? null
                  : {
                      xMm: handles.outgoing.xMm * scaleX,
                      yMm: handles.outgoing.yMm * scaleY,
                    },
              })),
            }),
      }));
      warnings.push(...traced.candidate.warnings.map((warning) => warning.message));
    }
    if (objects.length === 0 || objects.length > AI_LIMITS.editableObjects) {
      throw new RangeError("AI normalization produced an invalid editable-object count.");
    }
    const document = this.#session.state.project.document;
    const previewDocument = {
      ...document,
      layers: [...document.layers, ...layers],
      objects: [...document.objects, ...objects],
    };
    const analysis = await this.#cutabilityWorker.run({
      operationId: randomUUID(),
      document: previewDocument,
      objectIds: [],
    }, signal, () => undefined);
    signal.throwIfAborted();
    const generatedWording = concept.source === "structured-vector"
      ? `${concept.intent.primaryText} ${concept.intent.secondaryText}`.trim()
      : concept.observedWording;
    const wordingMatches =
      canonicalWording(requestedWording) === canonicalWording(generatedWording) &&
      canonicalWording(requestedWording) === canonicalWording(concept.observedWording);
    if (!wordingMatches) {
      warnings.push("Generated wording differs from the requested wording and must be corrected before acceptance.");
    }
    return {
      summary: {
        id: concept.id,
        title: concept.title,
        description: concept.description,
        source: concept.source,
        requestedWording,
        observedWording: concept.observedWording,
        wordingMatches,
        objectCount: objects.length,
        layerCount: layers.length,
        warnings: [...new Set(warnings)],
      },
      layers,
      objects,
      providerId: result.providerId,
      model: result.model,
      requestId: result.requestId,
      usage: { ...result.usage },
      analysis: {
        status: analysis.status,
        issueCount: analysis.issueCount,
        errorCount: analysis.errorCount,
        warningCount: analysis.warningCount,
        cutReady: false,
        disclaimer: analysis.disclaimer,
      },
      provenanceSaved: false,
    };
  }

  #assertAiConceptsCurrent(): void {
    if (
      this.#aiProjectFingerprint === null ||
      this.#session.projectFingerprint !== this.#aiProjectFingerprint
    ) {
      throw new Error("The project changed after these AI concepts were created. Generate them again before selection or acceptance.");
    }
  }

  #clearAiConcepts(cancelPreview: boolean): void {
    if (cancelPreview) this.#session.cancelAiConceptPreview();
    this.#aiConcepts = [];
    this.#aiRawConcepts = [];
    this.#aiResult = null;
    this.#aiRequest = null;
    this.#aiSelectedConceptId = null;
    this.#aiProjectFingerprint = null;
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
    for (const controller of this.#physicalPreviewAbortControllers.values()) {
      controller.abort();
    }
    this.#physicalPreviewAbortControllers.clear();
    this.#rasterJob = null;
    this.#rasterPreview = null;
    this.#selectedVectorSource = null;
    this.#selectedRasterSource = null;
    this.#cutabilityProjection = null;
    this.#productionExportSummary = null;
    this.#cutabilityJob = null;
    this.#focusedCutabilityIssueId = null;
    this.#bridgeProposal = null;
    this.#repairGroups = null;
    this.#safeRepairProposal = null;
    this.#safeRepairVisualPreview = null;
    this.#safeRepairResult = null;
    this.#physicalPreviewJob = null;
    this.#physicalPreviewAssembly = null;
    this.#physicalPreviewAssemblyFingerprint = null;
    this.#physicalPreviewFailureFingerprint = null;
    this.#physicalPreviewCapture = null;
    this.#guidedPreviewCompletion = null;
    this.#guidedAnalysisCompletion = null;
    this.#aiAbortController?.abort();
    this.#aiAbortController = null;
    this.#aiJob = null;
    this.#aiReference = null;
    this.#clearAiConcepts(false);
    this.#cutabilityCache.invalidate();
    this.#physicalPreviewCoordinator.clearCache();
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

  #clearPhysicalPreviewJob(operationId: string): void {
    if (this.#physicalPreviewJob?.operationId === operationId) {
      this.#physicalPreviewJob = null;
    }
  }

  #invalidateCutability(): void {
    for (const controller of this.#cutabilityAbortControllers.values()) {
      controller.abort();
    }
    this.#cutabilityAbortControllers.clear();
    this.#cutabilityCache.invalidate();
    this.#cutabilityProjection = null;
    this.#productionExportSummary = null;
    this.#cutabilityJob = null;
    this.#focusedCutabilityIssueId = null;
    this.#bridgeProposal = null;
    this.#repairGroups = null;
    this.#safeRepairProposal = null;
    this.#safeRepairVisualPreview = null;
    this.#safeRepairResult = null;
  }

  async #analyzeCutability(
    operationId: string,
    objectIds: readonly string[],
    scope: CutabilityAnalysisScope,
  ): Promise<CutabilityAnalysisSummary | null> {
    if (this.#cutabilityAbortControllers.size > 0) {
      throw new RangeError("Finish or cancel the active manufacturing analysis first.");
    }
    const document = this.#session.state.project.document;
    const cached = this.#cutabilityCache.get(document, objectIds);
    if (cached !== null) {
      const analysis = { ...cached, operationId };
      this.#publishCutabilityAnalysis(scope, analysis);
      return analysis;
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
      this.#cutabilityCache.set(document, objectIds, analysis);
      this.#publishCutabilityAnalysis(scope, analysis);
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

  /**
   * Delegates caching, coalescing of identical in-flight requests, and
   * rejection of superseded work to `PhysicalPreviewCoordinator` (G4A) --
   * unlike cutability, there is no manual fingerprint check or eager
   * per-edit invalidation here: the coordinator's own physical-content key
   * already recomputes only when physical layers/geometry/material/
   * thickness/spacing actually change, so this method only needs to bind
   * the current open-document snapshot to a request and publish the result.
   */
  async #buildPhysicalPreview(operationId: string): Promise<void> {
    const project = this.#session.state.project;
    const inputFingerprint = fingerprintPhysicalPreviewInput(project);
    const abortController = new AbortController();
    this.#physicalPreviewAbortControllers.set(operationId, abortController);
    this.#physicalPreviewJob = { operationId, percent: 0, stage: "preparing" };
    this.#emit();
    try {
      const result = await this.#physicalPreviewCoordinator.build(
        project,
        undefined,
        {
          signal: abortController.signal,
          onProgress: (progress) => {
            if (
              this.#physicalPreviewAbortControllers.get(operationId) === abortController &&
              !abortController.signal.aborted
            ) {
              this.#physicalPreviewJob = {
                operationId,
                percent: progress.percent,
                stage: progress.stage === "complete" ? "building" : progress.stage,
              };
              this.#emit();
            }
          },
        },
      );
      this.#physicalPreviewAssembly = result.assembly;
      this.#physicalPreviewAssemblyFingerprint = result.inputFingerprint;
      this.#physicalPreviewFailureFingerprint = null;
    } catch (error) {
      if (
        error instanceof PhysicalPreviewCancelledError ||
        error instanceof PhysicalPreviewSupersededError
      ) {
        return;
      }
      if (
        fingerprintPhysicalPreviewInput(this.#session.state.project) ===
        inputFingerprint
      ) {
        this.#physicalPreviewFailureFingerprint = inputFingerprint;
      }
      throw error;
    } finally {
      if (this.#physicalPreviewAbortControllers.get(operationId) === abortController) {
        this.#physicalPreviewAbortControllers.delete(operationId);
      }
      this.#clearPhysicalPreviewJob(operationId);
      this.#emit();
    }
  }

  #publishCutabilityAnalysis(
    scope: CutabilityAnalysisScope,
    analysis: CutabilityAnalysisSummary,
  ): void {
    const publishedScope: CutabilityAnalysisScope = scope.kind === "selection"
      ? {
          kind: "selection",
          layerId: null,
          layerName: null,
          objectIds: [...analysis.analyzedObjectIds],
        }
      : { ...scope };
    this.#cutabilityProjection = {
      scope: publishedScope,
      cutability: analysis,
    };
    this.#repairGroups = groupCutabilityFindings(
      this.#session.state.project.document,
      analysis,
    );
    this.#focusedCutabilityIssueId = analysis.issues[0]?.id ?? null;
    this.#bridgeProposal = null;
    this.#safeRepairProposal = null;
    this.#safeRepairVisualPreview = null;
  }

  #liveGuidedBinding(): GuidedProjectBinding {
    const project = this.#session.state.project;
    return {
      projectId: project.project.id,
      documentId: project.document.id,
      fingerprint: guidedDocumentFingerprint(project.document),
    };
  }

  #previewSelectedVectorSource(
    selected: {
      sourceName: string;
      format: VectorFileFormat;
      contents: string;
    },
    unitlessDxfUnit: VectorImportPreviewRequest["unitlessDxfUnit"],
  ): void {
    const candidate = selected.format === "svg"
      ? importSvg(selected.contents)
      : importDxf(selected.contents, {
          ...(unitlessDxfUnit === null
            ? {}
            : { unitlessUnit: unitlessDxfUnit }),
        });
    this.#session.previewVectorImport(candidate, selected.sourceName);
  }

  #currentResolutionCounts(): ResolutionFindingCounts | null {
    const projection = this.#cutabilityProjection;
    const analysis = projection?.cutability ?? null;
    const groups = this.#repairGroups;
    if (
      analysis === null ||
      groups === null ||
      projection?.scope.kind !== "whole-design" ||
      analysis.documentFingerprint !==
        fingerprintCutabilityDocument(this.#session.state.project.document)
    ) {
      return null;
    }
    return {
      safeFixableCount: groups.safeToFix.findingCount,
      needsDecisionCount:
        groups.suggestedFix.findingCount + groups.needsYourDecision.findingCount,
      blockingCount: analysis.errorCount,
    };
  }

  #createGuidanceHasPhysicalStock(): boolean {
    const document = this.#session.state.project.document;
    if (
      !Number.isFinite(document.dimensions.widthMm) ||
      !Number.isFinite(document.dimensions.heightMm) ||
      document.dimensions.widthMm <= 0 ||
      document.dimensions.heightMm <= 0
    ) {
      return false;
    }
    return document.layers.some((layer) => {
      const manufacturing = layer.manufacturing;
      return (
        manufacturing !== undefined &&
        manufacturing.role !== "non-cut-preview" &&
        manufacturing.material.trim() !== "" &&
        Number.isFinite(manufacturing.thicknessMm) &&
        manufacturing.thicknessMm > 0
      );
    });
  }

  #createGuidanceHasPhysicalContent(): boolean {
    const document = this.#session.state.project.document;
    const physicalLayerIds = new Set(
      document.layers
        .filter(
          (layer) =>
            layer.manufacturing !== undefined &&
            layer.manufacturing.role !== "non-cut-preview" &&
            Number.isFinite(layer.manufacturing.thicknessMm) &&
            layer.manufacturing.thicknessMm > 0,
        )
        .map((layer) => layer.id),
    );
    return document.objects.some((object) => physicalLayerIds.has(object.layerId));
  }

  #hasCurrentWholeDesignAnalysis(): boolean {
    return this.#currentResolutionCounts() !== null;
  }

  #recordGuidedAnalysisCompletion(): void {
    if (this.#guidedWorkflow.runToken === null) return;
    this.#guidedAnalysisCompletion = {
      runToken: this.#guidedWorkflow.runToken,
      documentFingerprint: guidedDocumentFingerprint(
        this.#session.state.project.document,
      ),
    };
  }

  #hasCurrentGuidedAnalysisEvidence(): boolean {
    const evidence = this.#guidedAnalysisCompletion;
    return (
      evidence !== null &&
      evidence.runToken === this.#guidedWorkflow.runToken &&
      evidence.documentFingerprint ===
        guidedDocumentFingerprint(this.#session.state.project.document)
    );
  }

  async #advanceCreateGuidanceStep(expectedStepId: string): Promise<boolean> {
    if (
      this.#guidedWorkflow.status !== "active" ||
      this.#guidedWorkflow.definition?.goal !== "create-first-sign" ||
      this.#guidedWorkflow.currentStepId !== expectedStepId ||
      this.#guidedWorkflow.runToken === null
    ) {
      return false;
    }
    const next = reduceGuidedWorkflow(this.#guidedWorkflow, {
      type: "advance",
      expectedStepId,
      runToken: this.#guidedWorkflow.runToken,
    });
    if (next === this.#guidedWorkflow) return false;
    await this.#applyGuidedWorkflow(next);
    return true;
  }

  async #advanceImportGuidanceStep(expectedStepId: string): Promise<boolean> {
    if (
      this.#guidedWorkflow.status !== "active" ||
      this.#guidedWorkflow.definition?.goal !== "import-own-design" ||
      this.#guidedWorkflow.currentStepId !== expectedStepId ||
      this.#guidedWorkflow.runToken === null
    ) {
      return false;
    }
    const next = reduceGuidedWorkflow(this.#guidedWorkflow, {
      type: "advance",
      expectedStepId,
      runToken: this.#guidedWorkflow.runToken,
    });
    if (next === this.#guidedWorkflow) return false;
    await this.#applyGuidedWorkflow(next);
    return true;
  }

  async #advanceOutcomeGuidanceStep(expectedStepId: string): Promise<boolean> {
    if (this.#guidedWorkflow.definition?.goal === "create-first-sign") {
      return this.#advanceCreateGuidanceStep(expectedStepId);
    }
    if (this.#guidedWorkflow.definition?.goal === "import-own-design") {
      return this.#advanceImportGuidanceStep(expectedStepId);
    }
    return false;
  }

  async #returnImportGuidanceToSourceSelection(): Promise<void> {
    if (
      this.#guidedWorkflow.status !== "active" ||
      this.#guidedWorkflow.definition?.goal !== "import-own-design" ||
      this.#guidedWorkflow.currentStepId !== "prepare-source" ||
      this.#guidedWorkflow.runToken === null
    ) {
      return;
    }
    await this.#applyGuidedWorkflow(
      reduceGuidedWorkflow(this.#guidedWorkflow, {
        type: "back",
        expectedStepId: "prepare-source",
        runToken: this.#guidedWorkflow.runToken,
      }),
    );
  }

  #clearPendingImportSource(): void {
    this.#session.cancelVectorImport();
    this.#session.cancelRasterTrace();
    this.#selectedVectorSource = null;
    this.#selectedRasterSource = null;
    this.#rasterPreview = null;
  }

  async #advanceCreateGuidanceFromDocumentOutcome(): Promise<void> {
    if (
      this.#guidedWorkflow.definition?.goal !== "create-first-sign" ||
      this.#guidedWorkflow.status !== "active"
    ) {
      return;
    }
    if (
      this.#guidedWorkflow.currentStepId === "choose-size-material" &&
      this.#createGuidanceHasPhysicalStock()
    ) {
      await this.#advanceCreateGuidanceStep("choose-size-material");
      return;
    }
    if (
      this.#guidedWorkflow.currentStepId === "add-content" &&
      this.#createGuidanceHasPhysicalContent()
    ) {
      await this.#advanceCreateGuidanceStep("add-content");
    }
  }

  async #advanceGuidanceAfterWholeDesignAnalysis(): Promise<void> {
    const guidedGoal = this.#guidedWorkflow.definition?.goal;
    if (
      (guidedGoal !== "create-first-sign" && guidedGoal !== "import-own-design") ||
      this.#guidedWorkflow.status !== "active" ||
      !this.#createGuidanceHasPhysicalStock() ||
      !this.#createGuidanceHasPhysicalContent() ||
      !this.#hasCurrentWholeDesignAnalysis()
    ) {
      return;
    }
    this.#recordGuidedAnalysisCompletion();
    if (this.#guidedWorkflow.currentStepId === "analyze-cutability") {
      await this.#advanceOutcomeGuidanceStep("analyze-cutability");
    }
    if (this.#guidedWorkflow.currentStepId === "resolve-findings") {
      const counts = this.#currentResolutionCounts();
      if (counts !== null && shouldAutoCompleteResolution(counts)) {
        await this.#advanceOutcomeGuidanceStep("resolve-findings");
      }
    }
  }

  #assertGuidedPhysicalPreviewCompletion(
    completion: Extract<
      Extract<OnboardingActionRequest, { type: "advance" }>["completion"],
      { kind: "physical-preview" }
    >,
  ): void {
    if (
      !this.#createGuidanceHasPhysicalStock() ||
      !this.#createGuidanceHasPhysicalContent() ||
      !this.#hasCurrentGuidedAnalysisEvidence()
    ) {
      throw new Error(
        "The physical setup, sign content, or whole-design analysis changed. Restore it and run Analyze all again before continuing.",
      );
    }
    const currentInputFingerprint = fingerprintPhysicalPreviewInput(
      this.#session.state.project,
    );
    if (completion.result === "unavailable" && completion.reason === "build-failed") {
      if (
        completion.assemblyFingerprint !== null ||
        this.#physicalPreviewFailureFingerprint !== currentInputFingerprint
      ) {
        throw new Error(
          "The 3D preview has no current build failure to acknowledge.",
        );
      }
      return;
    }

    const assembly = this.#physicalPreviewAssembly;
    if (
      assembly === null ||
      this.#physicalPreviewAssemblyFingerprint !== currentInputFingerprint ||
      completion.assemblyFingerprint !== assembly.fingerprint
    ) {
      throw new Error(
        "The 3D preview outcome no longer matches the current physical design.",
      );
    }
    if (completion.result === "rendered") {
      if (assembly.status === "unavailable" || assembly.layers.length === 0) {
        throw new Error("A physical 3D result was not rendered.");
      }
      return;
    }
    if (
      completion.reason === "assembly-unavailable" &&
      assembly.status !== "unavailable"
    ) {
      throw new Error("The current physical assembly is available for rendering.");
    }
    if (
      completion.reason !== "assembly-unavailable" &&
      assembly.status === "unavailable"
    ) {
      throw new Error("A missing physical assembly must use its explicit unavailable route.");
    }
  }

  #assertGuidedWorkflowReadyForExport(): void {
    const guidedGoal = this.#guidedWorkflow.definition?.goal;
    const expectedStepId = guidedGoal === "create-first-sign"
      ? "save-export"
      : guidedGoal === "import-own-design"
        ? "export-result"
        : null;
    if (
      this.#guidedWorkflow.status !== "active" ||
      expectedStepId === null ||
      this.#guidedWorkflow.currentStepId !== expectedStepId
    ) {
      return;
    }
    if (
      !this.#createGuidanceHasPhysicalStock() ||
      !this.#createGuidanceHasPhysicalContent() ||
      !this.#hasCurrentGuidedAnalysisEvidence()
    ) {
      throw new Error(
        "The design changed after its guided checks. Go back, restore the physical setup, and run Analyze all again before export.",
      );
    }
    const evidence = this.#guidedPreviewCompletion;
    if (
      evidence === null ||
      evidence.runToken !== this.#guidedWorkflow.runToken ||
      evidence.inputFingerprint !==
        fingerprintPhysicalPreviewInput(this.#session.state.project)
    ) {
      throw new Error(
        "The current physical design has not completed the required 3D preview checkpoint.",
      );
    }
  }

  async #replaceOnboardingPreferences(
    preferences: OnboardingPreferences,
  ): Promise<void> {
    const previous = this.#onboardingPreferences;
    this.#onboardingPreferences = preferences;
    try {
      await this.#onboardingPreferencesStore.save(preferences);
    } catch (error) {
      this.#onboardingPreferences = previous;
      throw error;
    }
  }

  async #applyGuidedWorkflow(
    next: GuidedWorkflowState,
    overrides: Partial<Pick<OnboardingPreferences, "dismissed">> = {},
  ): Promise<void> {
    const previousWorkflow = this.#guidedWorkflow;
    if (next === previousWorkflow) return;
    const previousPreferences = this.#onboardingPreferences;
    this.#guidedWorkflow = next;

    const goal = next.definition?.goal ?? null;
    const completedGoals =
      next.status === "completed" && goal !== null
        ? [...new Set([...previousPreferences.completedGoals, goal])]
        : [...previousPreferences.completedGoals];
    const activeWorkflow = toWorkflowSnapshot(next, this.#liveGuidedBinding());
    const dismissed =
      overrides.dismissed ??
      (next.status === "dismissed"
        ? true
        : next.status === "active"
          ? false
          : previousPreferences.dismissed);
    const preferences: OnboardingPreferences = {
      ...previousPreferences,
      schemaVersion: 2,
      completedGoals,
      dismissed,
      activeWorkflow,
    };
    this.#onboardingPreferences = preferences;
    try {
      await this.#onboardingPreferencesStore.save(preferences);
    } catch (error) {
      this.#guidedWorkflow = previousWorkflow;
      this.#onboardingPreferences = previousPreferences;
      throw error;
    }
  }

  async #invalidateGuidanceForProjectReplacement(): Promise<void> {
    if (this.#guidedWorkflow.status === "idle") return;
    const next = reduceGuidedWorkflow(this.#guidedWorkflow, {
      type: "project-replaced",
    });
    await this.#applyGuidedWorkflow(next);
    this.#guidedPreviewCompletion = null;
    this.#guidedAnalysisCompletion = null;
    this.#onboardingRecoveryNotice =
      "Guidance ended because the open project was replaced.";
  }

  async #refreshActiveWorkflowSnapshot(): Promise<void> {
    if (this.#guidedWorkflow.status !== "active") return;
    const activeWorkflow = toWorkflowSnapshot(
      this.#guidedWorkflow,
      this.#liveGuidedBinding(),
    );
    if (
      JSON.stringify(activeWorkflow) ===
      JSON.stringify(this.#onboardingPreferences.activeWorkflow)
    ) {
      return;
    }
    const preferences: OnboardingPreferences = {
      ...this.#onboardingPreferences,
      activeWorkflow,
    };
    this.#onboardingPreferences = preferences;
    try {
      await this.#onboardingPreferencesStore.save(preferences);
    } catch (error) {
      await this.#logger.error("onboarding-persistence-refresh-failed", error);
    }
  }

  async #run(action: () => void | Promise<void>): Promise<CommandResult> {
    try {
      await action();
      await this.#refreshActiveWorkflowSnapshot();
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

  #productionPreview(project: LaserxProject): {
    packageName: string;
    layers: ProductionAssemblyPreview["layers"];
  } | null {
    return buildProductionAssemblyPreview(project);
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
