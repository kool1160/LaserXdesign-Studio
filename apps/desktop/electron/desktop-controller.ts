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
  identityTransform,
  type TextObject,
  type UpdateViewportPreferences,
  type VectorExportSummary,
} from "@laserx/domain";
import {
  type FontCatalogEntry,
  FontEngine,
  type TextLayoutRequest,
} from "@laserx/fonts";
import { exportDxf, importDxf } from "@laserx/io-dxf";
import { exportSvg, importSvg } from "@laserx/io-svg";

import type {
  CommandResult,
  CreateDocumentRequest,
  DesktopState,
  ResolveRecoveryRequest,
  SetViewportPreferencesRequest,
  TextUpdateRequestDto,
  VectorExportRequest,
  VectorImportPreviewRequest,
} from "./ipc-contract.js";
import { AppLogger } from "./logger.js";
import {
  NodeGeometryWorkerService,
  type GeometryWorkerPort,
} from "./geometry-worker-service.js";
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
  readonly #geometryAbortControllers = new Map<string, AbortController>();
  #recentProjects: RecentProject[] = [];
  #pendingRecovery: RecoverySnapshot | null = null;
  #stopAutosave: (() => void) | null = null;
  #autosaveInFlight: Promise<void> | null = null;
  #lastExportSummary: VectorExportSummary | null = null;

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
    };
  }

  public async newProject(): Promise<CommandResult> {
    return this.#run(async () => {
      if (await this.#confirmReplacement()) {
        this.#session.dispatch({ type: "project.new" });
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
    });
  }

  public async cancelVectorImport(): Promise<CommandResult> {
    return this.#run(() => {
      this.#session.cancelVectorImport();
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

  public async editorAction(
    request: EditorActionRequest,
  ): Promise<CommandResult> {
    return this.#run(() => {
      this.#session.performEditorAction(request);
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
    });
  }

  public async resolveRecovery(
    request: ResolveRecoveryRequest,
  ): Promise<CommandResult> {
    return this.#run(async () => {
      if (request.action === "recover" && this.#pendingRecovery !== null) {
        this.#session.recover(this.#pendingRecovery);
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
  }

  async #openPath(filePath: string): Promise<void> {
    const normalized = validateProjectPath(filePath);
    const project = await this.#storage.read(normalized);
    this.#session.open(project, normalized);
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
