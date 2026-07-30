import {
  copyProject,
  createBlankProject,
  createDocument,
  replaceProjectDocument,
  setProjectDisplayUnit,
  setViewportPreferences,
  type DisplayUnit,
  type LaserxProject,
  type UpdateViewportPreferences,
} from "@laserx/domain";

export interface LifecycleDependencies {
  createId(): string;
  now(): string;
}

export interface ProjectSessionState {
  project: LaserxProject;
  filePath: string | null;
  dirty: boolean;
  recovered: boolean;
}

export type ApplicationCommand =
  | { type: "project.new" }
  | {
      type: "project.create-document";
      width: number;
      height: number;
      inputUnit: DisplayUnit;
    }
  | { type: "project.set-display-unit"; displayUnit: DisplayUnit }
  | {
      type: "project.set-viewport-preferences";
      updates: UpdateViewportPreferences;
    };

export interface ProjectCommandDispatcher {
  dispatch(command: ApplicationCommand): ProjectSessionState;
}

export interface ProjectFileService {
  read(filePath: string): Promise<LaserxProject>;
  write(filePath: string, project: LaserxProject): Promise<void>;
}

export interface RecoverySnapshot {
  schemaVersion: 1;
  capturedAt: string;
  originalPath: string | null;
  project: LaserxProject;
}

function blankState(dependencies: LifecycleDependencies): ProjectSessionState {
  const now = dependencies.now();
  return {
    project: createBlankProject({
      id: dependencies.createId(),
      documentId: dependencies.createId(),
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
      case "project.create-document": {
        const document = createDocument({
          id: this.#dependencies.createId(),
          width: command.width,
          height: command.height,
          inputUnit: command.inputUnit,
        });
        this.#state = {
          ...this.#state,
          project: replaceProjectDocument(
            this.#state.project,
            document,
            this.#dependencies.now(),
          ),
          dirty: true,
        };
        break;
      }
      case "project.set-display-unit":
        this.#state = {
          ...this.#state,
          project: setProjectDisplayUnit(
            this.#state.project,
            command.displayUnit,
            this.#dependencies.now(),
          ),
          dirty: true,
        };
        break;
      case "project.set-viewport-preferences":
        this.#state = {
          ...this.#state,
          project: setViewportPreferences(
            this.#state.project,
            command.updates,
            this.#dependencies.now(),
          ),
          dirty: true,
        };
        break;
    }
    return this.state;
  }

  public open(project: LaserxProject, filePath: string): ProjectSessionState {
    this.#state = {
      project: copyProject(project),
      filePath,
      dirty: false,
      recovered: false,
    };
    return this.state;
  }

  public prepareSave(): LaserxProject {
    const project = copyProject(this.#state.project);
    project.project.updatedAt = this.#dependencies.now();
    return project;
  }

  public completeSave(
    savedProject: LaserxProject,
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
