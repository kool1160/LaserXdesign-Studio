import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type {
  ProjectFileService,
  RecoverySnapshot,
} from "@laserx/application";
import {
  createBlankProject,
  type LaserxProject,
} from "@laserx/domain";
import { afterEach, describe, expect, it } from "vitest";

import {
  DesktopController,
  type AutosaveScheduler,
  type DesktopDialogs,
  type UnsavedChoice,
} from "../../electron/desktop-controller.js";
import type { RecoveryStorePort } from "../../electron/persistence.js";

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
}

interface DelayedSave {
  started: Promise<RecoverySnapshot>;
  release(): void;
}

function deferred<T>(): Deferred<T> {
  let resolvePromise: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve(value) {
      if (resolvePromise === undefined) {
        throw new Error("Deferred promise was not initialized.");
      }
      resolvePromise(value);
    },
  };
}

class ManualAutosaveScheduler implements AutosaveScheduler {
  #callback: (() => void) | null = null;

  public get active(): boolean {
    return this.#callback !== null;
  }

  public schedule(callback: () => void): () => void {
    if (this.#callback !== null) {
      throw new Error("Autosave was scheduled more than once.");
    }
    this.#callback = callback;
    return () => {
      if (this.#callback === callback) {
        this.#callback = null;
      }
    };
  }

  public trigger(): void {
    if (this.#callback === null) {
      throw new Error("Autosave is not scheduled.");
    }
    this.#callback();
  }
}

class ControlledRecoveryStore implements RecoveryStorePort {
  public current: RecoverySnapshot | null;
  public readonly events: string[] = [];
  #nextSave:
    | {
        started: Deferred<RecoverySnapshot>;
        release: Deferred<undefined>;
      }
    | undefined;

  public constructor(initial: RecoverySnapshot | null = null) {
    this.current = initial === null ? null : structuredClone(initial);
  }

  public delayNextSave(): DelayedSave {
    const started = deferred<RecoverySnapshot>();
    const release = deferred<undefined>();
    this.#nextSave = { started, release };
    return {
      started: started.promise,
      release: () => {
        release.resolve(undefined);
      },
    };
  }

  public load(): Promise<RecoverySnapshot | null> {
    return Promise.resolve(
      this.current === null ? null : structuredClone(this.current),
    );
  }

  public async save(snapshot: RecoverySnapshot): Promise<void> {
    this.events.push("save:start");
    const delayedSave = this.#nextSave;
    this.#nextSave = undefined;
    if (delayedSave !== undefined) {
      delayedSave.started.resolve(structuredClone(snapshot));
      await delayedSave.release.promise;
    }
    this.current = structuredClone(snapshot);
    this.events.push("save:finish");
  }

  public remove(): Promise<void> {
    this.events.push("remove");
    this.current = null;
    return Promise.resolve();
  }
}

class MemoryProjectStorage implements ProjectFileService {
  readonly #projects = new Map<string, LaserxProject>();

  public constructor(
    initialProjects: ReadonlyArray<{
      filePath: string;
      project: LaserxProject;
    }> = [],
  ) {
    for (const entry of initialProjects) {
      this.#projects.set(entry.filePath, structuredClone(entry.project));
    }
  }

  public read(filePath: string): Promise<LaserxProject> {
    const project = this.#projects.get(filePath);
    if (project === undefined) {
      return Promise.reject(new Error(`No project exists at ${filePath}.`));
    }
    return Promise.resolve(structuredClone(project));
  }

  public write(
    filePath: string,
    project: LaserxProject,
  ): Promise<void> {
    this.#projects.set(filePath, structuredClone(project));
    return Promise.resolve();
  }

  public get(filePath: string): LaserxProject | undefined {
    const project = this.#projects.get(filePath);
    return project === undefined ? undefined : structuredClone(project);
  }
}

const temporaryDirectories: string[] = [];
const controllers: DesktopController[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "laserx-autosave-race-"));
  temporaryDirectories.push(directory);
  return directory;
}

function plannedDialogs(options: {
  openPath?: string | null;
  savePath?: string | null;
  unsavedChoice?: UnsavedChoice;
}): DesktopDialogs {
  return {
    chooseOpenProject: () => Promise.resolve(options.openPath ?? null),
    chooseSaveProject: () => Promise.resolve(options.savePath ?? null),
    confirmUnsavedChanges: () =>
      Promise.resolve(options.unsavedChoice ?? "discard"),
  };
}

function pendingRecovery(projectId: string): RecoverySnapshot {
  const now = "2026-07-30T12:00:00.000Z";
  return {
    schemaVersion: 1,
    capturedAt: now,
    originalPath: null,
    project: createBlankProject({
      id: projectId,
      documentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      now,
    }),
  };
}

function makeController(options: {
  userDataPath: string;
  dialogs: DesktopDialogs;
  recoveryStore: ControlledRecoveryStore;
  scheduler: ManualAutosaveScheduler;
  projectStorage?: MemoryProjectStorage;
}): DesktopController {
  const controller = new DesktopController({
    userDataPath: options.userDataPath,
    dialogs: options.dialogs,
    onStateChanged: () => undefined,
    recoveryStore: options.recoveryStore,
    autosaveScheduler: options.scheduler,
    projectStorage: options.projectStorage ?? new MemoryProjectStorage(),
  });
  controllers.push(controller);
  return controller;
}

async function waitForState(
  predicate: () => boolean,
  failureMessage: string,
): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (predicate()) {
      return;
    }
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
  }
  throw new Error(failureMessage);
}

afterEach(async () => {
  for (const controller of controllers.splice(0)) {
    controller.stop();
  }
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("autosave recovery coordination", () => {
  it("settles an in-flight autosave before explicit Save clears recovery", async () => {
    const directory = await temporaryDirectory();
    const projectPath = join(directory, "saved-project.laserx");
    const recoveryStore = new ControlledRecoveryStore();
    const scheduler = new ManualAutosaveScheduler();
    const projectStorage = new MemoryProjectStorage();
    const controller = makeController({
      userDataPath: join(directory, "user-data"),
      dialogs: plannedDialogs({ savePath: projectPath }),
      recoveryStore,
      scheduler,
      projectStorage,
    });
    await controller.initialize();
    await controller.setDisplayUnit("inches");

    const delayedSave = recoveryStore.delayNextSave();
    scheduler.trigger();
    await delayedSave.started;

    const saveResult = controller.saveProjectAs();
    await waitForState(
      () => !controller.state.dirty,
      "Explicit Save did not commit the clean session state.",
    );
    expect(recoveryStore.events).toEqual(["save:start"]);

    delayedSave.release();
    await expect(saveResult).resolves.toMatchObject({ ok: true });

    expect(recoveryStore.events).toEqual([
      "save:start",
      "save:finish",
      "remove",
    ]);
    expect(recoveryStore.current).toBeNull();
    expect(projectStorage.get(projectPath)).toMatchObject({
      schemaVersion: 6,
    });

    scheduler.trigger();
    await Promise.resolve();
    await Promise.resolve();
    expect(recoveryStore.events).toEqual([
      "save:start",
      "save:finish",
      "remove",
    ]);
    expect(recoveryStore.current).toBeNull();
  });

  it("settles an older autosave after New commits and then clears pending recovery", async () => {
    const directory = await temporaryDirectory();
    const recoveryStore = new ControlledRecoveryStore(
      pendingRecovery("33333333-3333-4333-8333-333333333333"),
    );
    const scheduler = new ManualAutosaveScheduler();
    const controller = makeController({
      userDataPath: join(directory, "user-data"),
      dialogs: plannedDialogs({ unsavedChoice: "discard" }),
      recoveryStore,
      scheduler,
    });
    await controller.initialize();
    await controller.setDisplayUnit("inches");
    const originalProjectId = controller.state.project.id;

    const delayedSave = recoveryStore.delayNextSave();
    scheduler.trigger();
    await delayedSave.started;

    const newResult = controller.newProject();
    await waitForState(
      () => controller.state.project.id !== originalProjectId,
      "New Project did not commit its replacement session state.",
    );
    expect(controller.state.dirty).toBe(false);
    expect(controller.state.recovery).not.toBeNull();
    expect(recoveryStore.events).toEqual(["save:start"]);

    delayedSave.release();
    await expect(newResult).resolves.toMatchObject({ ok: true });

    expect(recoveryStore.events).toEqual([
      "save:start",
      "save:finish",
      "remove",
    ]);
    expect(recoveryStore.current).toBeNull();
    expect(controller.state.recovery).toBeNull();
  });

  it("settles an older autosave after Open commits and then clears pending recovery", async () => {
    const directory = await temporaryDirectory();
    const projectPath = join(directory, "opened-project.laserx");
    const openedProject = createBlankProject({
      id: "11111111-1111-4111-8111-111111111111",
      documentId: "22222222-2222-4222-8222-222222222222",
      name: "Opened project",
      now: "2026-07-30T12:00:00.000Z",
    });
    const projectStorage = new MemoryProjectStorage([
      { filePath: projectPath, project: openedProject },
    ]);
    const recoveryStore = new ControlledRecoveryStore(
      pendingRecovery("44444444-4444-4444-8444-444444444444"),
    );
    const scheduler = new ManualAutosaveScheduler();
    const controller = makeController({
      userDataPath: join(directory, "user-data"),
      dialogs: plannedDialogs({
        openPath: projectPath,
        unsavedChoice: "discard",
      }),
      recoveryStore,
      scheduler,
      projectStorage,
    });
    await controller.initialize();
    await controller.setDisplayUnit("inches");

    const delayedSave = recoveryStore.delayNextSave();
    scheduler.trigger();
    await delayedSave.started;

    const openResult = controller.openProject();
    await waitForState(
      () => controller.state.project.id === openedProject.project.id,
      "Open did not commit its replacement session state.",
    );
    expect(controller.state.dirty).toBe(false);
    expect(controller.state.recovery).not.toBeNull();
    expect(recoveryStore.events).toEqual(["save:start"]);

    delayedSave.release();
    await expect(openResult).resolves.toMatchObject({ ok: true });

    expect(recoveryStore.events).toEqual([
      "save:start",
      "save:finish",
      "remove",
    ]);
    expect(recoveryStore.current).toBeNull();
    expect(controller.state.recovery).toBeNull();
  });

  it("preserves the dirty project and its recovery when Open is canceled after Discard", async () => {
    const directory = await temporaryDirectory();
    const recoveryStore = new ControlledRecoveryStore();
    const scheduler = new ManualAutosaveScheduler();
    const controller = makeController({
      userDataPath: join(directory, "user-data"),
      dialogs: plannedDialogs({
        openPath: null,
        unsavedChoice: "discard",
      }),
      recoveryStore,
      scheduler,
    });
    await controller.initialize();
    await controller.setDisplayUnit("inches");
    const projectId = controller.state.project.id;

    scheduler.trigger();
    await waitForState(
      () => recoveryStore.current !== null,
      "Autosave did not create the current recovery snapshot.",
    );
    const recoveryProjectId = recoveryStore.current?.project.project.id;

    await expect(controller.openProject()).resolves.toMatchObject({
      ok: true,
    });

    expect(controller.state.project.id).toBe(projectId);
    expect(controller.state.dirty).toBe(true);
    expect(recoveryStore.current?.project.project.id).toBe(
      recoveryProjectId,
    );
    expect(recoveryStore.events).not.toContain("remove");
  });

  it("keeps close-discard ordered while an autosave is in flight", async () => {
    const directory = await temporaryDirectory();
    const recoveryStore = new ControlledRecoveryStore();
    const scheduler = new ManualAutosaveScheduler();
    const controller = makeController({
      userDataPath: join(directory, "user-data"),
      dialogs: plannedDialogs({ unsavedChoice: "discard" }),
      recoveryStore,
      scheduler,
    });
    await controller.initialize();
    await controller.setDisplayUnit("inches");

    const delayedSave = recoveryStore.delayNextSave();
    scheduler.trigger();
    await delayedSave.started;

    const closeResult = controller.confirmClose();
    await waitForState(
      () => !scheduler.active,
      "Close-discard did not stop the autosave scheduler.",
    );
    expect(recoveryStore.events).toEqual(["save:start"]);

    delayedSave.release();
    await expect(closeResult).resolves.toBe(true);

    expect(recoveryStore.events).toEqual([
      "save:start",
      "save:finish",
      "remove",
    ]);
    expect(recoveryStore.current).toBeNull();
    expect(scheduler.active).toBe(false);
  });
});
