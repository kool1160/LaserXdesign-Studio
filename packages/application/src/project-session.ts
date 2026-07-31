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
  type LaserxDocument,
  type LaserxProject,
  type PathObject,
  type PointMm,
  type TextObject,
  type UpdateViewportPreferences,
} from "@laserx/domain";
import {
  applyAffineTransform,
  cleanupEditablePath,
  type EditablePathGeometry,
} from "@laserx/geometry";

import { previewSelectedPathJoin } from "./path-preview.js";

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
  pathSelection: PathSelectionProjection | null;
  topologySummary: TopologyChangeSummary | null;
  history: {
    undoDepth: number;
    redoDepth: number;
    limit: number;
    transactionActive: boolean;
  };
}

export interface PathSelectionProjection {
  objectId: string;
  nodeIndices: number[];
  segmentIndices: number[];
}

export interface TopologyChangeSummary {
  operation: string;
  beforeNodeCount: number;
  afterNodeCount: number;
  replacedObjectIds: string[];
  discardedObjectIds: string[];
  warnings: string[];
  message: string;
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
  | Extract<EditorCommand, { type: "objects.replace" }>
  | Extract<EditorCommand, { type: "objects.replace-topology" }>
  | Extract<EditorCommand, { type: "objects.convert-text" }>
  | Extract<EditorCommand, { type: "objects.group" }>
  | Extract<EditorCommand, { type: "layer.add" }>
  | Extract<EditorCommand, { type: "guide.add" }>
  | Extract<EditorCommand, { type: "path.split" }>
  | Extract<EditorCommand, { type: "paths.join" }>;

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
  | {
      type: "selection.path-node";
      objectId: string;
      nodeIndex: number;
      mode: SelectionMode;
    }
  | {
      type: "selection.path-segment";
      objectId: string;
      segmentIndex: number;
      mode: SelectionMode;
    }
  | { type: "selection.path-clear" }
  | { type: "selection.path-edit"; objectId: string }
  | { type: "clipboard.copy" }
  | { type: "clipboard.paste" }
  | { type: "objects.duplicate-selection" }
  | { type: "objects.group-selection" }
  | { type: "objects.convert-selected-text"; preserveSource: boolean }
  | { type: "path.split-selected" }
  | { type: "paths.join-selected"; toleranceMm: number }
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
  selectionIds: string[];
  clipboard: DocumentObject[] | null;
  pasteSequence: number;
  future: HistoryEntry[];
  lastEditorCommand: EditorCommand | null;
  pathSelection: PathSelectionProjection | null;
  topologySummary: TopologyChangeSummary | null;
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

function copyHistoryEntry(entry: HistoryEntry): HistoryEntry {
  return {
    label: entry.label,
    before: copyProject(entry.before),
    after: copyProject(entry.after),
    commands: entry.commands.map(copyEditorCommand),
  };
}

function copyClipboard(
  clipboard: readonly DocumentObject[] | null,
): DocumentObject[] | null {
  return clipboard?.map(copyDocumentObject) ?? null;
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

function copyPathSelection(
  selection: PathSelectionProjection | null,
): PathSelectionProjection | null {
  return selection === null
    ? null
    : {
        objectId: selection.objectId,
        nodeIndices: [...selection.nodeIndices],
        segmentIndices: [...selection.segmentIndices],
      };
}

function copyTopologySummary(
  summary: TopologyChangeSummary | null,
): TopologyChangeSummary | null {
  return summary === null
    ? null
    : {
        ...summary,
        replacedObjectIds: [...summary.replacedObjectIds],
        discardedObjectIds: [...summary.discardedObjectIds],
        warnings: [...summary.warnings],
      };
}

function worldPathGeometry(object: PathObject): EditablePathGeometry {
  return {
    closed: object.closed,
    points: object.points.map((point) =>
      applyAffineTransform(point, object.transform),
    ),
    ...(object.handles === undefined
      ? {}
      : {
          handles: object.handles.map((handles) => ({
            incoming:
              handles.incoming === null
                ? null
                : applyAffineTransform(handles.incoming, object.transform),
            outgoing:
              handles.outgoing === null
                ? null
                : applyAffineTransform(handles.outgoing, object.transform),
          })),
        }),
  };
}

function applyIndexSelectionMode(
  current: readonly number[],
  incoming: number,
  mode: SelectionMode,
): number[] {
  if (mode === "replace") {
    return [incoming];
  }
  const next = new Set(current);
  if (mode === "toggle" && next.has(incoming)) {
    next.delete(incoming);
  } else {
    next.add(incoming);
  }
  return [...next].sort((first, second) => first - second);
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
  #pathSelection: PathSelectionProjection | null = null;
  #topologySummary: TopologyChangeSummary | null = null;

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
        pathSelection: copyPathSelection(this.#pathSelection),
        topologySummary: copyTopologySummary(this.#topologySummary),
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
        this.#pathSelection = null;
        return this.state;
      case "selection.clear":
        this.#selectionIds = [];
        this.#pathSelection = null;
        return this.state;
      case "selection.path-node":
        return this.selectPathNode(
          request.objectId,
          request.nodeIndex,
          request.mode,
        );
      case "selection.path-segment":
        return this.selectPathSegment(
          request.objectId,
          request.segmentIndex,
          request.mode,
        );
      case "selection.path-clear":
        this.#pathSelection = null;
        return this.state;
      case "selection.path-edit": {
        const object = this.#project.document.objects.find(
          (candidate) => candidate.id === request.objectId,
        );
        if (
          object?.type !== "path" ||
          !isLayerEditable(this.#project.document, object.layerId)
        ) {
          throw new RangeError("Select one editable path to edit its nodes.");
        }
        this.#selectionIds = [object.id];
        this.#pathSelection = {
          objectId: object.id,
          nodeIndices: [],
          segmentIndices: [],
        };
        return this.state;
      }
      case "clipboard.copy":
        return this.copySelection();
      case "clipboard.paste":
        return this.pasteClipboard();
      case "objects.duplicate-selection":
        return this.duplicateSelection();
      case "objects.group-selection":
        return this.groupSelection();
      case "objects.convert-selected-text":
        return this.convertSelectedText(request.preserveSource);
      case "path.split-selected":
        return this.splitSelectedPath();
      case "paths.join-selected":
        return this.joinSelectedPaths(request.toleranceMm);
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
      case "objects.convert-text":
        this.#selectionIds = command.objectIds
          .map((id) => command.groupIds[id])
          .filter((id): id is string => id !== undefined);
        break;
      case "objects.ungroup":
        this.#selectionIds = ungroupedChildIds;
        break;
      case "objects.replace-topology":
        this.#selectionIds = command.replacements.map((object) => object.id);
        this.#pathSelection = null;
        break;
      case "path.add-node":
        this.#selectionIds = [command.objectId];
        this.#pathSelection = {
          objectId: command.objectId,
          nodeIndices: [command.segmentIndex + 1],
          segmentIndices: [],
        };
        break;
      case "path.delete-nodes":
      case "path.simplify":
      case "path.cleanup":
        this.#selectionIds = [command.objectId];
        this.#pathSelection = {
          objectId: command.objectId,
          nodeIndices: [],
          segmentIndices: [],
        };
        break;
      case "path.reverse": {
        const path = nextDocument.objects.find(
          (object) => object.id === command.objectId && object.type === "path",
        );
        this.#selectionIds = [command.objectId];
        if (path?.type === "path" && this.#pathSelection?.objectId === command.objectId) {
          this.#pathSelection = {
            objectId: command.objectId,
            nodeIndices: this.#pathSelection.nodeIndices.map(
              (index) => path.points.length - 1 - index,
            ),
            segmentIndices: [],
          };
        }
        break;
      }
      case "path.split":
        this.#selectionIds = [command.objectId, command.newObjectId];
        this.#pathSelection = null;
        break;
      case "paths.join":
        this.#selectionIds = [command.firstObjectId];
        this.#pathSelection = {
          objectId: command.firstObjectId,
          nodeIndices: [],
          segmentIndices: [],
        };
        break;
      default:
        this.#reconcileSelection();
        break;
    }
    this.#recordTopologySummary(command, beforeDocument, nextDocument);
    this.#reconcilePathSelection();
    return this.state;
  }

  public applyTopologyReplacement(
    command: Extract<EditorCommand, { type: "objects.replace-topology" }>,
    summary: TopologyChangeSummary,
  ): ProjectSessionState {
    this.executeEditorCommand(command);
    this.#topologySummary = copyTopologySummary(summary);
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
    this.#reconcilePathSelection();
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
    this.#pathSelection = null;
    return this.state;
  }

  public selectPathNode(
    objectId: string,
    nodeIndex: number,
    mode: SelectionMode,
  ): ProjectSessionState {
    const object = this.#project.document.objects.find(
      (candidate) => candidate.id === objectId,
    );
    if (
      object?.type !== "path" ||
      !isLayerEditable(this.#project.document, object.layerId) ||
      !Number.isInteger(nodeIndex) ||
      nodeIndex < 0 ||
      nodeIndex >= object.points.length
    ) {
      throw new RangeError("Selected path node is invalid or not editable.");
    }
    const current =
      this.#pathSelection?.objectId === objectId
        ? this.#pathSelection.nodeIndices
        : [];
    this.#selectionIds = [objectId];
    this.#pathSelection = {
      objectId,
      nodeIndices: applyIndexSelectionMode(current, nodeIndex, mode),
      segmentIndices: [],
    };
    return this.state;
  }

  public selectPathSegment(
    objectId: string,
    segmentIndex: number,
    mode: SelectionMode,
  ): ProjectSessionState {
    const object = this.#project.document.objects.find(
      (candidate) => candidate.id === objectId,
    );
    const segmentCount =
      object?.type === "path"
        ? object.closed
          ? object.points.length
          : object.points.length - 1
        : 0;
    if (
      object?.type !== "path" ||
      !isLayerEditable(this.#project.document, object.layerId) ||
      !Number.isInteger(segmentIndex) ||
      segmentIndex < 0 ||
      segmentIndex >= segmentCount
    ) {
      throw new RangeError("Selected path segment is invalid or not editable.");
    }
    const current =
      this.#pathSelection?.objectId === objectId
        ? this.#pathSelection.segmentIndices
        : [];
    this.#selectionIds = [objectId];
    this.#pathSelection = {
      objectId,
      nodeIndices: [],
      segmentIndices: applyIndexSelectionMode(current, segmentIndex, mode),
    };
    return this.state;
  }

  public splitSelectedPath(): ProjectSessionState {
    const selection = this.#pathSelection;
    if (selection === null || selection.nodeIndices.length !== 1) {
      throw new RangeError("Select exactly one interior node to split the path.");
    }
    return this.executeEditorCommand({
      type: "path.split",
      objectId: selection.objectId,
      nodeIndex: selection.nodeIndices[0] as number,
      newObjectId: this.#dependencies.createId(),
    });
  }

  public joinSelectedPaths(toleranceMm: number): ProjectSessionState {
    if (!Number.isFinite(toleranceMm) || toleranceMm < 0) {
      throw new RangeError("Join tolerance must be finite and nonnegative.");
    }
    const paths = this.#selectionIds
      .map((id) =>
        this.#project.document.objects.find((object) => object.id === id),
      )
      .filter(
        (object): object is PathObject =>
          object?.type === "path" &&
          !object.closed &&
          isLayerEditable(this.#project.document, object.layerId),
      );
    if (paths.length !== 2) {
      throw new RangeError("Select exactly two editable open paths to join.");
    }
    const first = paths[0] as PathObject;
    const second = paths[1] as PathObject;
    if (first.layerId !== second.layerId) {
      throw new RangeError(
        "Joining paths requires both paths to share one editable layer.",
      );
    }
    const nearest = previewSelectedPathJoin(paths, toleranceMm);
    if (nearest === null) {
      throw new RangeError("No path endpoints are available to join.");
    }
    return this.executeEditorCommand({
      type: "paths.join",
      firstObjectId: first.id,
      firstEnd: nearest.firstEnd,
      secondObjectId: second.id,
      secondEnd: nearest.secondEnd,
      toleranceMm,
    });
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

  public convertSelectedText(preserveSource: boolean): ProjectSessionState {
    const selected = this.#project.document.objects.filter(
      (object): object is TextObject =>
        object.type === "text" &&
        this.#selectionIds.includes(object.id) &&
        isLayerEditable(this.#project.document, object.layerId),
    );
    if (selected.length === 0) {
      return this.state;
    }
    return this.executeEditorCommand({
      type: "objects.convert-text",
      objectIds: selected.map((object) => object.id),
      groupIds: Object.fromEntries(
        selected.map((object) => [object.id, this.#dependencies.createId()]),
      ),
      contourIds: Object.fromEntries(
        selected.map((object) => [
          object.id,
          object.contours.map(() => this.#dependencies.createId()),
        ]),
      ),
      preserveSource,
    });
  }

  public beginTransaction(label: string): ProjectSessionState {
    if (this.#transaction !== null) {
      throw new Error("An editor transaction is already active.");
    }
    this.#transaction = {
      label,
      before: copyProject(this.#project),
      selectionIds: [...this.#selectionIds],
      clipboard: copyClipboard(this.#clipboard),
      pasteSequence: this.#pasteSequence,
      future: this.#future.map(copyHistoryEntry),
      lastEditorCommand:
        this.#lastEditorCommand === null
          ? null
          : copyEditorCommand(this.#lastEditorCommand),
      pathSelection: copyPathSelection(this.#pathSelection),
      topologySummary: copyTopologySummary(this.#topologySummary),
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
      const transaction = this.#transaction;
      this.#project = copyProject(transaction.before);
      this.#selectionIds = [...transaction.selectionIds];
      this.#clipboard = copyClipboard(transaction.clipboard);
      this.#pasteSequence = transaction.pasteSequence;
      this.#future = transaction.future.map(copyHistoryEntry);
      this.#lastEditorCommand =
        transaction.lastEditorCommand === null
          ? null
          : copyEditorCommand(transaction.lastEditorCommand);
      this.#pathSelection = copyPathSelection(transaction.pathSelection);
      this.#topologySummary = copyTopologySummary(transaction.topologySummary);
      this.#transaction = null;
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
    this.#topologySummary = {
      operation: "Undo",
      beforeNodeCount: 0,
      afterNodeCount: 0,
      replacedObjectIds: [],
      discardedObjectIds: [],
      warnings: [],
      message: `Undid ${entry.label}.`,
    };
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
    this.#topologySummary = {
      operation: "Redo",
      beforeNodeCount: 0,
      afterNodeCount: 0,
      replacedObjectIds: [],
      discardedObjectIds: [],
      warnings: [],
      message: `Redid ${entry.label}.`,
    };
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

  #recordTopologySummary(
    command: EditorCommand,
    before: LaserxDocument,
    after: LaserxDocument,
  ): void {
    let operation: string;
    let beforeIds: string[];
    let afterIds: string[];
    let discardedObjectIds: string[] = [];
    let warnings: string[] = [];
    switch (command.type) {
      case "path.move-nodes":
        operation = "Move nodes";
        beforeIds = [command.objectId];
        afterIds = [command.objectId];
        break;
      case "path.add-node":
        operation = "Add node";
        beforeIds = [command.objectId];
        afterIds = [command.objectId];
        break;
      case "path.delete-nodes":
        operation = "Delete nodes";
        beforeIds = [command.objectId];
        afterIds = [command.objectId];
        break;
      case "path.set-handle":
        operation = "Edit curve handle";
        beforeIds = [command.objectId];
        afterIds = [command.objectId];
        break;
      case "path.set-closed":
        operation = command.closed ? "Close path" : "Open path";
        beforeIds = [command.objectId];
        afterIds = [command.objectId];
        break;
      case "path.reverse":
        operation = "Reverse path";
        beforeIds = [command.objectId];
        afterIds = [command.objectId];
        break;
      case "path.simplify":
        operation = "Simplify path";
        beforeIds = [command.objectId];
        afterIds = [command.objectId];
        break;
      case "path.cleanup":
        operation = "Clean contour";
        beforeIds = [command.objectId];
        afterIds = [command.objectId];
        {
          const source = before.objects.find(
            (object): object is PathObject =>
              object.id === command.objectId && object.type === "path",
          );
          warnings =
            source === undefined
              ? []
              : cleanupEditablePath(
                  worldPathGeometry(source),
                  command.toleranceMm,
                ).warnings;
        }
        break;
      case "path.split":
        operation = "Split path";
        beforeIds = [command.objectId];
        afterIds = [command.objectId, command.newObjectId];
        break;
      case "paths.join":
        operation = "Join paths";
        beforeIds = [command.firstObjectId, command.secondObjectId];
        afterIds = [command.firstObjectId];
        discardedObjectIds = [command.secondObjectId];
        break;
      case "objects.replace-topology":
        operation = "Topology operation";
        beforeIds = [...command.sourceObjectIds];
        afterIds = command.replacements.map((object) => object.id);
        discardedObjectIds = command.sourceObjectIds.filter(
          (id) => !afterIds.includes(id),
        );
        break;
      default:
        return;
    }
    const nodeCount = (document: LaserxDocument, ids: readonly string[]): number =>
      document.objects.reduce(
        (count, object) =>
          object.type === "path" && ids.includes(object.id)
            ? count + object.points.length
            : count,
        0,
      );
    const beforeNodeCount = nodeCount(before, beforeIds);
    const afterNodeCount = nodeCount(after, afterIds);
    this.#topologySummary = {
      operation,
      beforeNodeCount,
      afterNodeCount,
      replacedObjectIds: [...afterIds],
      discardedObjectIds,
      warnings,
      message: `${operation}: ${String(beforeNodeCount)} → ${String(afterNodeCount)} nodes; ${String(afterIds.length)} resulting path${afterIds.length === 1 ? "" : "s"}.`,
    };
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
    this.#reconcilePathSelection();
  }

  #reconcilePathSelection(): void {
    const selection = this.#pathSelection;
    if (selection === null) {
      return;
    }
    const object = this.#project.document.objects.find(
      (candidate) => candidate.id === selection.objectId,
    );
    if (
      object?.type !== "path" ||
      !this.#selectionIds.includes(object.id) ||
      !isLayerEditable(this.#project.document, object.layerId)
    ) {
      this.#pathSelection = null;
      return;
    }
    const segmentCount = object.closed
      ? object.points.length
      : object.points.length - 1;
    this.#pathSelection = {
      objectId: object.id,
      nodeIndices: selection.nodeIndices.filter(
        (index) => index >= 0 && index < object.points.length,
      ),
      segmentIndices: selection.segmentIndices.filter(
        (index) => index >= 0 && index < segmentCount,
      ),
    };
  }

  #resetEditorForReplacement(): void {
    this.#selectionIds = [];
    this.#past = [];
    this.#future = [];
    this.#transaction = null;
    this.#lastEditorCommand = null;
    this.#pathSelection = null;
    this.#topologySummary = null;
  }
}
