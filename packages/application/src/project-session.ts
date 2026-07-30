import {
  applyEditorCommand,
  cloneObjectsWithNewIds,
  collectObjectIds,
  copyDocumentObject,
  copyProject,
  createBlankProject,
  createDocument,
  getObjectsInRenderOrder,
  getSelectionBounds,
  hitTestDocument,
  isLayerEditable,
  marqueeHitTest,
  replaceProjectDocument,
  setProjectDisplayUnit,
  setViewportPreferences,
  type BoundsMm,
  type DisplayUnit,
  type DocumentObject,
  type EditorCommand,
  type LaserxProject,
  type PointMm,
  type UpdateViewportPreferences,
} from "@laserx/domain";

export const DEFAULT_HISTORY_LIMIT = 100;
export const DEFAULT_DUPLICATE_OFFSET_MM = 10;

export interface LifecycleDependencies {
  createId(): string;
  now(): string;
}

export interface EditorProjection {
  selectionIds: string[];
  selectionBounds: BoundsMm | null;
  clipboardHasContent: boolean;
  history: {
    undoDepth: number;
    redoDepth: number;
    limit: number;
    transactionActive: boolean;
  };
}

export interface ProjectSessionState {
  project: LaserxProject;
  filePath: string | null;
  dirty: boolean;
  recovered: boolean;
  editor: EditorProjection;
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

type GeneratedEditorCommand =
  | Extract<EditorCommand, { type: "objects.duplicate" }>
  | Extract<EditorCommand, { type: "objects.insert" }>
  | Extract<EditorCommand, { type: "objects.group" }>
  | Extract<EditorCommand, { type: "layer.add" }>
  | Extract<EditorCommand, { type: "guide.add" }>;

export type DirectEditorCommand = Exclude<
  EditorCommand,
  GeneratedEditorCommand
>;

export type SelectionMode = "replace" | "add" | "toggle";

export type EditorActionRequest =
  | DirectEditorCommand
  | {
      type: "selection.point";
      point: PointMm;
      toleranceMm: number;
      mode: SelectionMode;
    }
  | {
      type: "selection.marquee";
      bounds: BoundsMm;
      mode: SelectionMode;
    }
  | { type: "selection.all" }
  | { type: "selection.clear" }
  | { type: "clipboard.copy" }
  | { type: "clipboard.paste" }
  | { type: "objects.duplicate-selection" }
  | { type: "objects.group-selection" }
  | { type: "history.undo" }
  | { type: "history.redo" }
  | { type: "history.begin-transaction"; label: string }
  | { type: "history.commit-transaction" }
  | { type: "history.cancel-transaction" }
  | {
      type: "object.create";
      objectType: "line" | "rectangle" | "ellipse";
    }
  | { type: "layer.create"; name: string }
  | { type: "guide.create"; axis: "x" | "y"; positionMm: number };

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

interface HistoryEntry {
  label: string;
  before: LaserxProject;
  after: LaserxProject;
  commands: EditorCommand[];
}

interface ActiveTransaction {
  label: string;
  before: LaserxProject;
  commands: EditorCommand[];
}

function blankProject(dependencies: LifecycleDependencies): LaserxProject {
  const now = dependencies.now();
  return createBlankProject({
    id: dependencies.createId(),
    documentId: dependencies.createId(),
    now,
  });
}

function fingerprint(project: LaserxProject): string {
  return JSON.stringify(project);
}

function copyEditorCommand(command: EditorCommand): EditorCommand {
  return JSON.parse(JSON.stringify(command)) as EditorCommand;
}

function applySelectionMode(
  current: readonly string[],
  incoming: readonly string[],
  mode: SelectionMode,
): string[] {
  if (mode === "replace") {
    return [...incoming];
  }
  const next = new Set(current);
  for (const id of incoming) {
    if (mode === "toggle" && next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
  }
  return [...next];
}

export class ProjectSession implements ProjectCommandDispatcher {
  readonly #dependencies: LifecycleDependencies;
  readonly #historyLimit: number;
  #project: LaserxProject;
  #filePath: string | null = null;
  #recovered = false;
  #savedFingerprint: string | null;
  #selectionIds: string[] = [];
  #clipboard: DocumentObject[] | null = null;
  #pasteSequence = 0;
  #past: HistoryEntry[] = [];
  #future: HistoryEntry[] = [];
  #transaction: ActiveTransaction | null = null;
  #lastEditorCommand: EditorCommand | null = null;

  public constructor(
    dependencies: LifecycleDependencies,
    historyLimit = DEFAULT_HISTORY_LIMIT,
  ) {
    if (!Number.isInteger(historyLimit) || historyLimit <= 0) {
      throw new RangeError("History limit must be a positive integer.");
    }
    this.#dependencies = dependencies;
    this.#historyLimit = historyLimit;
    this.#project = blankProject(dependencies);
    this.#savedFingerprint = fingerprint(this.#project);
  }

  public get state(): ProjectSessionState {
    const selectionBounds = getSelectionBounds(
      this.#project.document,
      this.#selectionIds,
    );
    return {
      project: copyProject(this.#project),
      filePath: this.#filePath,
      dirty: this.#isDirty(),
      recovered: this.#recovered,
      editor: {
        selectionIds: [...this.#selectionIds],
        selectionBounds:
          selectionBounds === null ? null : { ...selectionBounds },
        clipboardHasContent:
          this.#clipboard !== null && this.#clipboard.length > 0,
        history: {
          undoDepth: this.#past.length,
          redoDepth: this.#future.length,
          limit: this.#historyLimit,
          transactionActive: this.#transaction !== null,
        },
      },
    };
  }

  public get lastEditorCommand(): EditorCommand | null {
    return this.#lastEditorCommand === null
      ? null
      : copyEditorCommand(this.#lastEditorCommand);
  }

  public dispatch(command: ApplicationCommand): ProjectSessionState {
    switch (command.type) {
      case "project.new":
        this.#project = blankProject(this.#dependencies);
        this.#filePath = null;
        this.#recovered = false;
        this.#savedFingerprint = fingerprint(this.#project);
        this.#resetEditorForReplacement();
        break;
      case "project.create-document": {
        const document = createDocument({
          id: this.#dependencies.createId(),
          width: command.width,
          height: command.height,
          inputUnit: command.inputUnit,
        });
        this.#commitProject(
          replaceProjectDocument(
            this.#project,
            document,
            this.#dependencies.now(),
          ),
          "Create document",
          [],
        );
        this.#selectionIds = [];
        break;
      }
      case "project.set-display-unit":
        this.#commitProject(
          setProjectDisplayUnit(
            this.#project,
            command.displayUnit,
            this.#dependencies.now(),
          ),
          "Set display unit",
          [],
        );
        break;
      case "project.set-viewport-preferences":
        this.#commitProject(
          setViewportPreferences(
            this.#project,
            command.updates,
            this.#dependencies.now(),
          ),
          "Set viewport preferences",
          [],
        );
        break;
    }
    return this.state;
  }

  public performEditorAction(
    request: EditorActionRequest,
  ): ProjectSessionState {
    switch (request.type) {
      case "selection.point":
        return this.selectPoint(
          request.point,
          request.toleranceMm,
          request.mode,
        );
      case "selection.marquee":
        return this.selectMarquee(request.bounds, request.mode);
      case "selection.all":
        this.#selectionIds = getObjectsInRenderOrder(this.#project.document)
          .filter((object) =>
            isLayerEditable(this.#project.document, object.layerId),
          )
          .map((object) => object.id);
        return this.state;
      case "selection.clear":
        this.#selectionIds = [];
        return this.state;
      case "clipboard.copy":
        return this.copySelection();
      case "clipboard.paste":
        return this.pasteClipboard();
      case "objects.duplicate-selection":
        return this.duplicateSelection();
      case "objects.group-selection":
        return this.groupSelection();
      case "history.undo":
        return this.undo();
      case "history.redo":
        return this.redo();
      case "history.begin-transaction":
        return this.beginTransaction(request.label);
      case "history.commit-transaction":
        return this.commitTransaction();
      case "history.cancel-transaction":
        return this.cancelTransaction();
      case "object.create":
        return this.createObject(request.objectType);
      case "layer.create":
        return this.executeEditorCommand({
          type: "layer.add",
          layer: {
            id: this.#dependencies.createId(),
            name: request.name,
            visible: true,
            locked: false,
          },
        });
      case "guide.create":
        return this.executeEditorCommand({
          type: "guide.add",
          guide: {
            id: this.#dependencies.createId(),
            axis: request.axis,
            positionMm: request.positionMm,
          },
        });
      default:
        return this.executeEditorCommand(request);
    }
  }

  public executeEditorCommand(command: EditorCommand): ProjectSessionState {
    const beforeDocument = this.#project.document;
    const ungroupedChildIds =
      command.type === "objects.ungroup"
        ? beforeDocument.objects
            .filter(
              (object) =>
                command.objectIds.includes(object.id) &&
                object.type === "group",
            )
            .flatMap((object) =>
              object.type === "group"
                ? object.children.map((child) => child.id)
                : [],
            )
        : [];
    const nextDocument = applyEditorCommand(beforeDocument, command);
    if (JSON.stringify(nextDocument) === JSON.stringify(beforeDocument)) {
      this.#reconcileSelection();
      return this.state;
    }
    const nextProject = replaceProjectDocument(
      this.#project,
      nextDocument,
      this.#dependencies.now(),
    );
    this.#commitProject(
      nextProject,
      command.type.replaceAll(".", " "),
      [command],
    );
    this.#lastEditorCommand = copyEditorCommand(command);

    switch (command.type) {
      case "objects.duplicate":
        this.#selectionIds = command.objectIds
          .map((id) => command.idMap[id])
          .filter((id): id is string => id !== undefined);
        break;
      case "objects.insert":
        this.#selectionIds = command.objects.map((object) => object.id);
        break;
      case "objects.group":
        this.#selectionIds = [command.groupId];
        break;
      case "objects.ungroup":
        this.#selectionIds = ungroupedChildIds;
        break;
      default:
        this.#reconcileSelection();
        break;
    }
    return this.state;
  }

  public selectPoint(
    point: PointMm,
    toleranceMm: number,
    mode: SelectionMode,
  ): ProjectSessionState {
    const top = hitTestDocument({
      document: this.#project.document,
      point,
      toleranceMm,
    })[0];
    this.#selectionIds = applySelectionMode(
      this.#selectionIds,
      top === undefined ? [] : [top.objectId],
      mode,
    );
    return this.state;
  }

  public selectMarquee(
    bounds: BoundsMm,
    mode: SelectionMode,
  ): ProjectSessionState {
    this.#selectionIds = applySelectionMode(
      this.#selectionIds,
      marqueeHitTest(this.#project.document, bounds),
      mode,
    );
    return this.state;
  }

  public copySelection(): ProjectSessionState {
    const selected = new Set(this.#selectionIds);
    this.#clipboard = this.#project.document.objects
      .filter(
        (object) =>
          selected.has(object.id) &&
          isLayerEditable(this.#project.document, object.layerId),
      )
      .map(copyDocumentObject);
    this.#pasteSequence = 0;
    return this.state;
  }

  public pasteClipboard(): ProjectSessionState {
    if (this.#clipboard === null || this.#clipboard.length === 0) {
      return this.state;
    }
    const targetLayer =
      this.#project.document.layers.find(
        (layer) =>
          layer.id === this.#project.document.activeLayerId &&
          layer.visible &&
          !layer.locked,
      ) ??
      this.#project.document.layers.find(
        (layer) => layer.visible && !layer.locked,
      );
    if (targetLayer === undefined) {
      return this.state;
    }
    this.#pasteSequence += 1;
    const idMap = this.#createIdMap(this.#clipboard);
    const offset = DEFAULT_DUPLICATE_OFFSET_MM * this.#pasteSequence;
    const objects = cloneObjectsWithNewIds(
      this.#clipboard,
      idMap,
      offset,
      offset,
      targetLayer.id,
    );
    return this.executeEditorCommand({
      type: "objects.insert",
      objects,
    });
  }

  public duplicateSelection(): ProjectSessionState {
    const selected = new Set(this.#selectionIds);
    const objects = this.#project.document.objects.filter(
      (object) =>
        selected.has(object.id) &&
        isLayerEditable(this.#project.document, object.layerId),
    );
    if (objects.length === 0) {
      return this.state;
    }
    const idMap = this.#createIdMap(objects);
    return this.executeEditorCommand({
      type: "objects.duplicate",
      objectIds: objects.map((object) => object.id),
      idMap,
      offsetXmm: DEFAULT_DUPLICATE_OFFSET_MM,
      offsetYmm: DEFAULT_DUPLICATE_OFFSET_MM,
    });
  }

  public createObject(
    objectType: "line" | "rectangle" | "ellipse",
  ): ProjectSessionState {
    const document = this.#project.document;
    const targetLayer =
      document.layers.find(
        (layer) =>
          layer.id === document.activeLayerId &&
          layer.visible &&
          !layer.locked,
      ) ?? document.layers.find((layer) => layer.visible && !layer.locked);
    if (targetLayer === undefined) {
      return this.state;
    }
    const centerXmm = document.dimensions.widthMm / 2;
    const centerYmm = document.dimensions.heightMm / 2;
    const widthMm = Math.min(80, document.dimensions.widthMm / 3);
    const heightMm = Math.min(50, document.dimensions.heightMm / 3);
    const base = {
      id: this.#dependencies.createId(),
      layerId: targetLayer.id,
      transform: {
        a: 1,
        b: 0,
        c: 0,
        d: 1,
        eMm: 0,
        fMm: 0,
      },
    };
    const object: DocumentObject =
      objectType === "line"
        ? {
            ...base,
            type: "line",
            start: {
              xMm: centerXmm - widthMm / 2,
              yMm: centerYmm,
            },
            end: {
              xMm: centerXmm + widthMm / 2,
              yMm: centerYmm,
            },
          }
        : objectType === "rectangle"
          ? {
              ...base,
              type: "rectangle",
              origin: {
                xMm: centerXmm - widthMm / 2,
                yMm: centerYmm - heightMm / 2,
              },
              widthMm,
              heightMm,
            }
          : {
              ...base,
              type: "ellipse",
              center: { xMm: centerXmm, yMm: centerYmm },
              radiusXmm: widthMm / 2,
              radiusYmm: heightMm / 2,
            };
    return this.executeEditorCommand({
      type: "objects.insert",
      objects: [object],
    });
  }

  public groupSelection(): ProjectSessionState {
    const selected = this.#project.document.objects.filter(
      (object) =>
        this.#selectionIds.includes(object.id) &&
        isLayerEditable(this.#project.document, object.layerId),
    );
    if (selected.length < 2) {
      return this.state;
    }
    return this.executeEditorCommand({
      type: "objects.group",
      objectIds: selected.map((object) => object.id),
      groupId: this.#dependencies.createId(),
      layerId:
        selected[0]?.layerId ?? this.#project.document.activeLayerId,
    });
  }

  public beginTransaction(label: string): ProjectSessionState {
    if (this.#transaction !== null) {
      throw new Error("An editor transaction is already active.");
    }
    this.#transaction = {
      label,
      before: copyProject(this.#project),
      commands: [],
    };
    return this.state;
  }

  public commitTransaction(): ProjectSessionState {
    const transaction = this.#transaction;
    if (transaction === null) {
      return this.state;
    }
    this.#transaction = null;
    if (fingerprint(transaction.before) !== fingerprint(this.#project)) {
      this.#pushHistory({
        label: transaction.label,
        before: transaction.before,
        after: copyProject(this.#project),
        commands: transaction.commands.map((command) =>
          copyEditorCommand(command),
        ),
      });
    }
    return this.state;
  }

  public cancelTransaction(): ProjectSessionState {
    if (this.#transaction !== null) {
      this.#project = copyProject(this.#transaction.before);
      this.#transaction = null;
      this.#reconcileSelection();
    }
    return this.state;
  }

  public undo(): ProjectSessionState {
    if (this.#transaction !== null) {
      throw new Error("Commit or cancel the active transaction before undo.");
    }
    const entry = this.#past.pop();
    if (entry === undefined) {
      return this.state;
    }
    this.#future.push(entry);
    this.#project = copyProject(entry.before);
    this.#lastEditorCommand =
      entry.commands.at(-1) === undefined
        ? null
        : copyEditorCommand(entry.commands.at(-1) as EditorCommand);
    this.#reconcileSelection();
    return this.state;
  }

  public redo(): ProjectSessionState {
    if (this.#transaction !== null) {
      throw new Error("Commit or cancel the active transaction before redo.");
    }
    const entry = this.#future.pop();
    if (entry === undefined) {
      return this.state;
    }
    this.#past.push(entry);
    this.#project = copyProject(entry.after);
    this.#lastEditorCommand =
      entry.commands.at(-1) === undefined
        ? null
        : copyEditorCommand(entry.commands.at(-1) as EditorCommand);
    this.#reconcileSelection();
    return this.state;
  }

  public open(project: LaserxProject, filePath: string): ProjectSessionState {
    this.#project = copyProject(project);
    this.#filePath = filePath;
    this.#recovered = false;
    this.#savedFingerprint = fingerprint(this.#project);
    this.#resetEditorForReplacement();
    return this.state;
  }

  public prepareSave(): LaserxProject {
    const project = copyProject(this.#project);
    project.project.updatedAt = this.#dependencies.now();
    return project;
  }

  public completeSave(
    savedProject: LaserxProject,
    filePath: string,
  ): ProjectSessionState {
    const previousFingerprint = fingerprint(this.#project);
    this.#project = copyProject(savedProject);
    const latest = this.#past.at(-1);
    if (
      latest !== undefined &&
      fingerprint(latest.after) === previousFingerprint
    ) {
      latest.after = copyProject(savedProject);
    }
    this.#filePath = filePath;
    this.#recovered = false;
    this.#savedFingerprint = fingerprint(this.#project);
    return this.state;
  }

  public createRecoverySnapshot(): RecoverySnapshot {
    return {
      schemaVersion: 1,
      capturedAt: this.#dependencies.now(),
      originalPath: this.#filePath,
      project: copyProject(this.#project),
    };
  }

  public recover(snapshot: RecoverySnapshot): ProjectSessionState {
    this.#project = copyProject(snapshot.project);
    this.#filePath = snapshot.originalPath;
    this.#recovered = true;
    this.#savedFingerprint = null;
    this.#resetEditorForReplacement();
    return this.state;
  }

  #createIdMap(
    objects: readonly DocumentObject[],
  ): Record<string, string> {
    return Object.fromEntries(
      objects
        .flatMap((object) => collectObjectIds(object))
        .map((id) => [id, this.#dependencies.createId()]),
    );
  }

  #commitProject(
    nextProject: LaserxProject,
    label: string,
    commands: EditorCommand[],
  ): void {
    if (fingerprint(nextProject) === fingerprint(this.#project)) {
      return;
    }
    const before = copyProject(this.#project);
    this.#project = copyProject(nextProject);
    this.#future = [];
    if (this.#transaction !== null) {
      this.#transaction.commands.push(
        ...commands.map((command) => copyEditorCommand(command)),
      );
      return;
    }
    this.#pushHistory({
      label,
      before,
      after: copyProject(nextProject),
      commands: commands.map((command) => copyEditorCommand(command)),
    });
  }

  #pushHistory(entry: HistoryEntry): void {
    this.#past.push(entry);
    if (this.#past.length > this.#historyLimit) {
      this.#past.splice(0, this.#past.length - this.#historyLimit);
    }
    this.#future = [];
  }

  #isDirty(): boolean {
    return (
      this.#savedFingerprint === null ||
      fingerprint(this.#project) !== this.#savedFingerprint
    );
  }

  #reconcileSelection(): void {
    const editable = new Set(
      this.#project.document.objects
        .filter((object) =>
          isLayerEditable(this.#project.document, object.layerId),
        )
        .map((object) => object.id),
    );
    this.#selectionIds = this.#selectionIds.filter((id) =>
      editable.has(id),
    );
  }

  #resetEditorForReplacement(): void {
    this.#selectionIds = [];
    this.#past = [];
    this.#future = [];
    this.#transaction = null;
    this.#lastEditorCommand = null;
  }
}
