import {
  createBlankProject,
  type DisplayUnit,
  type LaserxProjectV1,
  updateProjectSettings,
} from "@laserx/domain";

export interface LifecycleDependencies {
  createId(): string;
  now(): string;
}

export interface ProjectSessionState {
  project: LaserxProjectV1;
  filePath: string | null;
  dirty: boolean;
  recovered: boolean;
}

export type ApplicationCommand =
  | { type: "project.new" }
  | { type: "project.set-display-unit"; displayUnit: DisplayUnit };

export interface ProjectCommandDispatcher {
  dispatch(command: ApplicationCommand): ProjectSessionState;
}

export interface ProjectFileService {
  read(filePath: string): Promise<LaserxProjectV1>;
  write(filePath: string, project: LaserxProjectV1): Promise<void>;
}

export interface RecoverySnapshot {
  schemaVersion: 1;
  capturedAt: string;
  originalPath: string | null;
  project: LaserxProjectV1;
}

function copyProject(project: LaserxProjectV1): LaserxProjectV1 {
  return {
    ...project,
    project: { ...project.project },
    document: {
      ...project.document,
      settings: { ...project.document.settings },
    },
    migrationHistory: project.migrationHistory.map((record) => ({
      ...record,
    })),
  };
}

function blankState(dependencies: LifecycleDependencies): ProjectSessionState {
  const now = dependencies.now();
  return {
    project: createBlankProject({
      id: dependencies.createId(),
      now,
    }),
    filePath: null,
    dirty: false,
    recovered: false,
  };
}

export class ProjectSession implements ProjectCommandDispatcher {
  readonly #dependencies: LifecycleDependencies;
  #state: ProjectSessionState;

  public constructor(dependencies: LifecycleDependencies) {
    this.#dependencies = dependencies;
    this.#state = blankState(dependencies);
  }

  public get state(): ProjectSessionState {
    return {
      ...this.#state,
      project: copyProject(this.#state.project),
    };
  }

  public dispatch(command: ApplicationCommand): ProjectSessionState {
    switch (command.type) {
      case "project.new":
        this.#state = blankState(this.#dependencies);
        break;
      case "project.set-display-unit":
        this.#state = {
          ...this.#state,
          project: updateProjectSettings(
            this.#state.project,
            { displayUnit: command.displayUnit },
            this.#dependencies.now(),
          ),
          dirty: true,
        };
        break;
    }
    return this.state;
  }

  public open(project: LaserxProjectV1, filePath: string): ProjectSessionState {
    this.#state = {
      project: copyProject(project),
      filePath,
      dirty: false,
      recovered: false,
    };
    return this.state;
  }

  public prepareSave(): LaserxProjectV1 {
    return updateProjectSettings(
      this.#state.project,
      {},
      this.#dependencies.now(),
    );
  }

  public completeSave(
    savedProject: LaserxProjectV1,
    filePath: string,
  ): ProjectSessionState {
    this.#state = {
      project: copyProject(savedProject),
      filePath,
      dirty: false,
      recovered: false,
    };
    return this.state;
  }

  public createRecoverySnapshot(): RecoverySnapshot {
    return {
      schemaVersion: 1,
      capturedAt: this.#dependencies.now(),
      originalPath: this.#state.filePath,
      project: copyProject(this.#state.project),
    };
  }

  public recover(snapshot: RecoverySnapshot): ProjectSessionState {
    this.#state = {
      project: copyProject(snapshot.project),
      filePath: snapshot.originalPath,
      dirty: true,
      recovered: true,
    };
    return this.state;
  }
}
