import { randomUUID } from "node:crypto";

import {
  ProjectSession,
  type RecoverySnapshot,
} from "@laserx/application";
import type { UpdateViewportPreferences } from "@laserx/domain";

import type {
  CommandResult,
  CreateDocumentRequest,
  DesktopState,
  ResolveRecoveryRequest,
  SetViewportPreferencesRequest,
} from "./ipc-contract.js";
import { AppLogger } from "./logger.js";
import {
  RecentProjectsStore,
  RecoveryStore,
  type RecentProject,
} from "./persistence.js";
import { ProjectStorage, validateProjectPath } from "./project-storage.js";

export type UnsavedChoice = "save" | "discard" | "cancel";

export interface DesktopDialogs {
  chooseOpenProject(): Promise<string | null>;
  chooseSaveProject(suggestedName: string): Promise<string | null>;
  confirmUnsavedChanges(projectName: string): Promise<UnsavedChoice>;
}

export interface DesktopControllerOptions {
  userDataPath: string;
  dialogs: DesktopDialogs;
  onStateChanged: (state: DesktopState) => void;
  autosaveIntervalMs?: number;
}

export class DesktopController {
  readonly #session = new ProjectSession({
    createId: () => randomUUID(),
    now: () => new Date().toISOString(),
  });
  readonly #storage = new ProjectStorage();
  readonly #recentStore: RecentProjectsStore;
  readonly #recoveryStore: RecoveryStore;
  readonly #logger: AppLogger;
  readonly #dialogs: DesktopDialogs;
  readonly #onStateChanged: (state: DesktopState) => void;
  readonly #autosaveIntervalMs: number;
  #recentProjects: RecentProject[] = [];
  #pendingRecovery: RecoverySnapshot | null = null;
  #autosaveTimer: NodeJS.Timeout | null = null;
  #autosaveInFlight: Promise<void> | null = null;

  public constructor(options: DesktopControllerOptions) {
    this.#recentStore = new RecentProjectsStore(options.userDataPath);
    this.#recoveryStore = new RecoveryStore(options.userDataPath);
    this.#logger = new AppLogger(options.userDataPath);
    this.#dialogs = options.dialogs;
    this.#onStateChanged = options.onStateChanged;
    this.#autosaveIntervalMs = options.autosaveIntervalMs ?? 30_000;
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
        document: {
          kind: session.project.document.kind,
          id: session.project.document.id,
          dimensions: { ...session.project.document.dimensions },
          origin: { ...session.project.document.origin },
          settings: {
            ...session.project.document.settings,
            viewport: {
              ...session.project.document.settings.viewport,
              snapping: {
                ...session.project.document.settings.viewport.snapping,
              },
            },
          },
          objects: structuredClone(session.project.document.objects),
        },
      },
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
    };
  }

  public async newProject(): Promise<CommandResult> {
    return this.#run(async () => {
      if (await this.#confirmReplacement()) {
        this.#session.dispatch({ type: "project.new" });
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
      this.#session.dispatch({
        type: "project.set-viewport-preferences",
        updates: domainUpdates,
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
    await this.#autosaveInFlight;
    await this.#recoveryStore.remove();
    this.#pendingRecovery = null;
    return true;
  }

  public stop(): void {
    if (this.#autosaveTimer !== null) {
      clearInterval(this.#autosaveTimer);
      this.#autosaveTimer = null;
    }
  }

  async #openPath(filePath: string): Promise<void> {
    const normalized = validateProjectPath(filePath);
    const project = await this.#storage.read(normalized);
    this.#session.open(project, normalized);
    this.#recentProjects = await this.#recentStore.add({
      filePath: normalized,
      name: project.project.name,
    });
    await this.#recoveryStore.remove();
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
    this.#recentProjects = await this.#recentStore.add({
      filePath: normalized,
      name: project.project.name,
    });
    this.#pendingRecovery = null;
    await this.#recoveryStore.remove();
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
    await this.#recoveryStore.remove();
    this.#pendingRecovery = null;
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
    this.#autosaveTimer = setInterval(() => {
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
    }, this.#autosaveIntervalMs);
    this.#autosaveTimer.unref();
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
