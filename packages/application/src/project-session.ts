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
  identityTransform,
  isLayerEditable,
  marqueeHitTest,
  replaceProjectDocument,
  setProjectDisplayUnit,
  setManufacturingSettings,
  setViewportPreferences,
  type BoundsMm,
  type DisplayUnit,
  type DocumentObject,
  type EditorCommand,
  type LaserxDocument,
  type LaserxProject,
  type Layer,
  type PathObject,
  type PointMm,
  type TextObject,
  type UpdateViewportPreferences,
  type VectorImportCandidate,
  type VectorSourceUnit,
  type VectorInterchangeFormat,
  type InterchangeWarning,
  type RasterSourceMetadata,
  type RasterTraceCandidate,
  type RasterTraceSettings,
  type RasterTraceSummary,
  type ManufacturingSettings,
  type SavedSignTemplate,
} from "@laserx/domain";
import {
  applyAffineTransform,
  cleanupEditablePath,
  type EditablePathGeometry,
} from "@laserx/geometry";
import type { AiNormalizedConcept } from "@laserx/ai/concept";

import { previewSelectedPathJoin } from "./path-preview.js";
import type {
  SignGenerationCandidate,
  SignGenerationSummary,
} from "@laserx/sign-tools";

export const DEFAULT_HISTORY_LIMIT = 100;
export const DEFAULT_DUPLICATE_OFFSET_MM = 10;
export const MAX_VECTOR_IMPORT_GEOMETRY_POINTS = 200_000;

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
  importPreview: VectorImportPreview | null;
  rasterTracePreview: RasterTracePreview | null;
  signToolPreview: SignToolPreview | null;
  aiConceptPreview: AiConceptPreview | null;
  history: {
    undoDepth: number;
    redoDepth: number;
    limit: number;
    transactionActive: boolean;
  };
}

export interface VectorImportPreview {
  sourceName: string;
  format: VectorInterchangeFormat;
  sourceUnit: VectorSourceUnit;
  dimensionsMm: { widthMm: number; heightMm: number } | null;
  layers: Layer[];
  objects: PathObject[];
  warnings: InterchangeWarning[];
  assumptions: string[];
  bounds: BoundsMm | null;
}

interface PendingVectorImport extends VectorImportPreview {
  projectFingerprint: string;
}

export interface RasterTracePreview {
  sourceName: string;
  source: RasterSourceMetadata;
  settings: RasterTraceSettings;
  layers: Layer[];
  objects: PathObject[];
  warnings: InterchangeWarning[];
  assumptions: string[];
  summary: RasterTraceSummary;
}

interface PendingRasterTrace extends RasterTracePreview {
  projectFingerprint: string;
}

export interface SignToolPreview {
  layers: Layer[];
  objects: DocumentObject[];
  summary: SignGenerationSummary;
  template: Omit<SavedSignTemplate, "id" | "name"> | null;
}

interface PendingSignTool extends SignToolPreview {
  projectFingerprint: string;
}

export type AiConceptPreview = AiNormalizedConcept;

interface PendingAiConcept extends AiConceptPreview {
  projectFingerprint: string;
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
      type: "project.set-manufacturing-settings";
      settings: ManufacturingSettings;
    }
  | {
      type: "project.set-viewport-preferences";
      updates: UpdateViewportPreferences;
    };

type GeneratedEditorCommand =
  | Extract<EditorCommand, { type: "objects.duplicate" }>
  | Extract<EditorCommand, { type: "objects.insert" }>
  | Extract<EditorCommand, { type: "objects.import" }>
  | Extract<EditorCommand, { type: "objects.replace" }>
  | Extract<EditorCommand, { type: "objects.replace-topology" }>
  | Extract<EditorCommand, { type: "objects.convert-text" }>
  | Extract<EditorCommand, { type: "objects.group" }>
  | Extract<EditorCommand, { type: "layer.add" }>
  | Extract<EditorCommand, { type: "guide.add" }>
  | Extract<EditorCommand, { type: "path.split" }>
  | Extract<EditorCommand, { type: "paths.join" }>
  | Extract<EditorCommand, { type: "template.upsert" }>
  | Extract<EditorCommand, { type: "template.delete" }>;

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

function copyImportPreview(
  preview: PendingVectorImport | null,
): VectorImportPreview | null {
  return preview === null
    ? null
    : {
        sourceName: preview.sourceName,
        format: preview.format,
        sourceUnit: preview.sourceUnit,
        dimensionsMm:
          preview.dimensionsMm === null ? null : { ...preview.dimensionsMm },
        layers: preview.layers.map((layer) => ({ ...layer })),
        objects: preview.objects.map((object) =>
          copyDocumentObject(object) as PathObject,
        ),
        warnings: preview.warnings.map((item) => ({ ...item })),
        assumptions: [...preview.assumptions],
        bounds: preview.bounds === null ? null : { ...preview.bounds },
      };
}

function copyRasterTracePreview(
  preview: PendingRasterTrace | null,
): RasterTracePreview | null {
  return preview === null
    ? null
    : {
        sourceName: preview.sourceName,
        source: { ...preview.source },
        settings: {
          ...preview.settings,
          crop: { ...preview.settings.crop },
        },
        layers: preview.layers.map((layer) => ({ ...layer })),
        objects: preview.objects.map((object) =>
          copyDocumentObject(object) as PathObject,
        ),
        warnings: preview.warnings.map((item) => ({ ...item })),
        assumptions: [...preview.assumptions],
        summary: {
          ...preview.summary,
          bounds:
            preview.summary.bounds === null
              ? null
              : { ...preview.summary.bounds },
        },
      };
}

function copySignToolPreview(
  preview: PendingSignTool | null,
): SignToolPreview | null {
  return preview === null
    ? null
    : {
        layers: preview.layers.map((item) => ({ ...item })),
        objects: preview.objects.map(copyDocumentObject),
        summary: {
          ...preview.summary,
          warnings: [...preview.summary.warnings],
          assumptions: [...preview.summary.assumptions],
          provenanceIds: [...preview.summary.provenanceIds],
        },
        template:
          preview.template === null
            ? null
            : {
                ...preview.template,
                parameters: { ...preview.template.parameters },
              },
      };
}

function copyAiConceptPreview(
  preview: PendingAiConcept | null,
): AiConceptPreview | null {
  return preview === null
    ? null
    : {
        summary: {
          ...preview.summary,
          warnings: [...preview.summary.warnings],
        },
        layers: preview.layers.map((item) => ({ ...item })),
        objects: preview.objects.map(copyDocumentObject),
        providerId: preview.providerId,
        model: preview.model,
        requestId: preview.requestId,
        usage: { ...preview.usage },
        analysis: { ...preview.analysis },
        provenanceSaved: false,
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
  #importPreview: PendingVectorImport | null = null;
  #rasterTracePreview: PendingRasterTrace | null = null;
  #signToolPreview: PendingSignTool | null = null;
  #aiConceptPreview: PendingAiConcept | null = null;

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
        importPreview: copyImportPreview(this.#importPreview),
        rasterTracePreview: copyRasterTracePreview(this.#rasterTracePreview),
        signToolPreview: copySignToolPreview(this.#signToolPreview),
        aiConceptPreview: copyAiConceptPreview(this.#aiConceptPreview),
        history: {
          undoDepth: this.#past.length,
          redoDepth: this.#future.length,
          limit: this.#historyLimit,
          transactionActive: this.#transaction !== null,
        },
      },
    };
  }

  public get projectFingerprint(): string {
    return fingerprint(this.#project);
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
      case "project.set-manufacturing-settings":
        this.#commitProject(
          setManufacturingSettings(
            this.#project,
            command.settings,
            this.#dependencies.now(),
          ),
          "Set manufacturing settings",
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
      case "objects.import":
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

  public selectObjectIds(objectIds: readonly string[]): ProjectSessionState {
    const available = new Set(
      getObjectsInRenderOrder(this.#project.document).map((object) => object.id),
    );
    this.#selectionIds = [...new Set(objectIds)].filter((id) => available.has(id));
    this.#pathSelection = null;
    return this.state;
  }

  public previewVectorImport(
    candidate: VectorImportCandidate,
    sourceName: string,
  ): ProjectSessionState {
    if (this.#transaction !== null) {
      throw new Error("Commit or cancel the active transaction before importing.");
    }
    if (this.#rasterTracePreview !== null) {
      throw new Error("Accept or reject the active raster trace before importing a vector file.");
    }
    if (this.#aiConceptPreview !== null) {
      throw new Error("Accept or discard the active AI concept before importing a vector file.");
    }
    if (candidate.paths.length === 0) {
      throw new RangeError("The selected file contains no supported 2D geometry to preview.");
    }
    if (candidate.paths.length > 100_000) {
      throw new RangeError("The selected file contains too many imported paths.");
    }
    let geometryPointCount = 0;
    for (const path of candidate.paths) {
      if (
        path.points.length >
        MAX_VECTOR_IMPORT_GEOMETRY_POINTS - geometryPointCount
      ) {
        throw new RangeError(
          "The selected file contains more than 200,000 expanded geometry points.",
        );
      }
      geometryPointCount += path.points.length;
    }
    const document = this.#project.document;
    const editableLayers = document.layers.filter(
      (layer) => layer.visible && !layer.locked,
    );
    const activeLayer = editableLayers.find(
      (layer) => layer.id === document.activeLayerId,
    ) ?? editableLayers[0];
    const newLayers: Layer[] = [];
    const mappedLayerIds = new Map<string, string>();
    const usedLayerNames = new Set(
      document.layers.map((layer) => layer.name.toLocaleLowerCase()),
    );
    const uniqueLayerName = (requested: string): string => {
      const base = requested.trim().slice(0, 100) || "Imported";
      let name = base;
      let sequence = 2;
      while (usedLayerNames.has(name.toLocaleLowerCase())) {
        const suffix = ` (${String(sequence)})`;
        name = `${base.slice(0, 100 - suffix.length)}${suffix}`;
        sequence += 1;
      }
      usedLayerNames.add(name.toLocaleLowerCase());
      return name;
    };
    const layerIdFor = (sourceLayerName: string | null): string => {
      const requested = sourceLayerName?.trim() ?? "";
      if (requested === "" && activeLayer !== undefined) {
        return activeLayer.id;
      }
      const key = requested.toLocaleLowerCase() || "__default_import_layer__";
      const mapped = mappedLayerIds.get(key);
      if (mapped !== undefined) {
        return mapped;
      }
      const existing = editableLayers.find(
        (layer) => layer.name.toLocaleLowerCase() === key,
      );
      if (existing !== undefined) {
        mappedLayerIds.set(key, existing.id);
        return existing.id;
      }
      const layer: Layer = {
        id: this.#dependencies.createId(),
        name: uniqueLayerName(requested || "Imported"),
        visible: true,
        locked: false,
      };
      newLayers.push(layer);
      mappedLayerIds.set(key, layer.id);
      return layer.id;
    };
    const objects = candidate.paths.map<PathObject>((path) => ({
      id: this.#dependencies.createId(),
      type: "path",
      layerId: layerIdFor(path.layerName),
      transform: identityTransform(),
      closed: path.closed,
      points: path.points.map((point) => ({ ...point })),
      ...(path.handles === undefined
        ? {}
        : {
            handles: path.handles.map((handle) => ({
              incoming:
                handle.incoming === null ? null : { ...handle.incoming },
              outgoing:
                handle.outgoing === null ? null : { ...handle.outgoing },
            })),
          }),
    }));
    const previewDocument: LaserxDocument = {
      ...document,
      layers: [...document.layers, ...newLayers],
      objects: [...document.objects, ...objects],
    };
    const bounds = getSelectionBounds(
      previewDocument,
      objects.map((object) => object.id),
    );
    this.#importPreview = {
      sourceName: sourceName.trim() || `Imported ${candidate.format.toUpperCase()}`,
      format: candidate.format,
      sourceUnit: candidate.sourceUnit,
      dimensionsMm:
        candidate.dimensionsMm === null ? null : { ...candidate.dimensionsMm },
      layers: newLayers,
      objects,
      warnings: candidate.warnings.map((item) => ({ ...item })),
      assumptions: [...candidate.assumptions],
      bounds,
      projectFingerprint: fingerprint(this.#project),
    };
    return this.state;
  }

  public cancelVectorImport(): ProjectSessionState {
    this.#importPreview = null;
    return this.state;
  }

  public commitVectorImport(): ProjectSessionState {
    const preview = this.#importPreview;
    if (preview === null) {
      throw new RangeError("There is no vector import preview to commit.");
    }
    if (preview.projectFingerprint !== fingerprint(this.#project)) {
      throw new Error("The project changed after this preview was created. Preview the vector file again before committing it.");
    }
    this.executeEditorCommand({
      type: "objects.import",
      layers: preview.layers,
      objects: preview.objects,
    });
    this.#importPreview = null;
    return this.state;
  }

  public previewRasterTrace(
    candidate: RasterTraceCandidate,
    sourceName: string,
  ): ProjectSessionState {
    if (this.#transaction !== null) {
      throw new Error("Commit or cancel the active transaction before tracing.");
    }
    if (this.#importPreview !== null) {
      throw new Error("Commit or cancel the active vector import before tracing a raster file.");
    }
    if (this.#aiConceptPreview !== null) {
      throw new Error("Accept or discard the active AI concept before tracing a raster file.");
    }
    if (candidate.paths.length === 0) {
      throw new RangeError("The raster trace contains no editable paths to preview.");
    }
    if (candidate.paths.length > 100_000) {
      throw new RangeError("The raster trace contains too many editable paths.");
    }
    let geometryPointCount = 0;
    for (const path of candidate.paths) {
      if (
        path.points.length >
        MAX_VECTOR_IMPORT_GEOMETRY_POINTS - geometryPointCount
      ) {
        throw new RangeError(
          "The raster trace contains more than 200,000 editable geometry points.",
        );
      }
      geometryPointCount += path.points.length;
    }
    const document = this.#project.document;
    const usedLayerNames = new Set(
      document.layers.map((layer) => layer.name.toLocaleLowerCase()),
    );
    const baseName = "Raster Trace";
    let layerName = baseName;
    let sequence = 2;
    while (usedLayerNames.has(layerName.toLocaleLowerCase())) {
      layerName = `${baseName} (${String(sequence)})`;
      sequence += 1;
    }
    const layer: Layer = {
      id: this.#dependencies.createId(),
      name: layerName,
      visible: true,
      locked: false,
    };
    const objects = candidate.paths.map<PathObject>((path) => ({
      id: this.#dependencies.createId(),
      type: "path",
      layerId: layer.id,
      transform: identityTransform(),
      closed: path.closed,
      points: path.points.map((point) => ({ ...point })),
      ...(path.handles === undefined
        ? {}
        : {
            handles: path.handles.map((handle) => ({
              incoming:
                handle.incoming === null ? null : { ...handle.incoming },
              outgoing:
                handle.outgoing === null ? null : { ...handle.outgoing },
            })),
          }),
    }));
    this.#rasterTracePreview = {
      sourceName: sourceName.trim() || `Traced ${candidate.source.format.toUpperCase()}`,
      source: { ...candidate.source },
      settings: {
        ...candidate.settings,
        crop: { ...candidate.settings.crop },
      },
      layers: [layer],
      objects,
      warnings: candidate.warnings.map((warning) => ({ ...warning })),
      assumptions: [...candidate.assumptions],
      summary: {
        ...candidate.summary,
        bounds:
          candidate.summary.bounds === null
            ? null
            : { ...candidate.summary.bounds },
      },
      projectFingerprint: fingerprint(this.#project),
    };
    return this.state;
  }

  public previewSignTool(candidate: SignGenerationCandidate): ProjectSessionState {
    if (this.#transaction !== null) {
      throw new Error("Commit or cancel the active transaction before using sign tools.");
    }
    if (
      this.#importPreview !== null ||
      this.#rasterTracePreview !== null ||
      this.#aiConceptPreview !== null
    ) {
      throw new Error("Accept or reject the active import preview before using sign tools.");
    }
    if (candidate.objects.length === 0 || candidate.objects.length > 10_000) {
      throw new RangeError("Sign-tool previews require 1 to 10,000 editable objects.");
    }
    const document = this.#project.document;
    const existingIds = new Set([
      ...document.layers.map((item) => item.id),
      ...document.guides.map((item) => item.id),
      ...document.objects.flatMap(collectObjectIds),
      ...document.templates.map((item) => item.id),
    ]);
    const incomingIds = [
      ...candidate.layers.map((item) => item.id),
      ...candidate.objects.flatMap(collectObjectIds),
    ];
    const incomingLayers = new Set(candidate.layers.map((item) => item.id));
    if (
      new Set(incomingIds).size !== incomingIds.length ||
      incomingIds.some((id) => existingIds.has(id)) ||
      candidate.objects.some((object) => !incomingLayers.has(object.layerId))
    ) {
      throw new RangeError("Sign-tool preview IDs and layer references must be unique.");
    }
    this.#signToolPreview = {
      layers: candidate.layers.map((item) => ({ ...item })),
      objects: candidate.objects.map(copyDocumentObject),
      summary: {
        ...candidate.summary,
        warnings: [...candidate.summary.warnings],
        assumptions: [...candidate.summary.assumptions],
        provenanceIds: [...candidate.summary.provenanceIds],
      },
      template:
        candidate.template === null
          ? null
          : {
              ...candidate.template,
              parameters: { ...candidate.template.parameters },
            },
      projectFingerprint: fingerprint(this.#project),
    };
    return this.state;
  }

  public cancelSignToolPreview(): ProjectSessionState {
    this.#signToolPreview = null;
    return this.state;
  }

  public acceptSignToolPreview(): ProjectSessionState {
    const preview = this.#signToolPreview;
    if (preview === null) {
      throw new RangeError("There is no sign-tool preview to accept.");
    }
    if (preview.projectFingerprint !== fingerprint(this.#project)) {
      throw new Error("The project changed after this sign-tool preview was created. Preview it again before accepting.");
    }
    this.executeEditorCommand({
      type: "objects.import",
      layers: preview.layers,
      objects: preview.objects,
    });
    this.#signToolPreview = null;
    return this.state;
  }

  public saveSignToolPreviewTemplate(name: string): ProjectSessionState {
    const preview = this.#signToolPreview;
    if (preview === null || preview.template === null) {
      throw new RangeError("Only a template preview can be saved as a reusable template.");
    }
    if (preview.projectFingerprint !== fingerprint(this.#project)) {
      throw new Error("The project changed after this template preview was created. Preview it again before saving.");
    }
    this.executeEditorCommand({
      type: "template.upsert",
      template: {
        id: this.#dependencies.createId(),
        name,
        ...preview.template,
        parameters: { ...preview.template.parameters },
      },
    });
    if (this.#signToolPreview !== null) {
      this.#signToolPreview.projectFingerprint = fingerprint(this.#project);
    }
    return this.state;
  }

  public deleteSignTemplate(templateId: string): ProjectSessionState {
    return this.executeEditorCommand({ type: "template.delete", templateId });
  }

  public previewAiConcept(
    candidate: AiNormalizedConcept,
    sourceProjectFingerprint: string,
  ): ProjectSessionState {
    if (this.#transaction !== null) {
      throw new Error("Commit or cancel the active transaction before previewing AI concepts.");
    }
    if (sourceProjectFingerprint !== fingerprint(this.#project)) {
      throw new Error("The project changed while this AI concept was prepared. The stale preview was not published.");
    }
    if (
      this.#importPreview !== null ||
      this.#rasterTracePreview !== null ||
      this.#signToolPreview !== null
    ) {
      throw new Error("Accept or reject the active preview before previewing an AI concept.");
    }
    if (candidate.objects.length === 0 || candidate.objects.length > 10_000) {
      throw new RangeError("AI concept previews require 1 to 10,000 editable objects.");
    }
    const document = this.#project.document;
    const existingIds = new Set([
      ...document.layers.map((item) => item.id),
      ...document.guides.map((item) => item.id),
      ...document.objects.flatMap(collectObjectIds),
      ...document.templates.map((item) => item.id),
    ]);
    const incomingIds = [
      ...candidate.layers.map((item) => item.id),
      ...candidate.objects.flatMap(collectObjectIds),
    ];
    const incomingLayers = new Set(candidate.layers.map((item) => item.id));
    if (
      new Set(incomingIds).size !== incomingIds.length ||
      incomingIds.some((id) => existingIds.has(id)) ||
      candidate.objects.some((object) => !incomingLayers.has(object.layerId))
    ) {
      throw new RangeError("AI concept preview IDs and layer references must be unique.");
    }
    this.#aiConceptPreview = {
      ...copyAiConceptPreview({
        ...candidate,
        projectFingerprint: sourceProjectFingerprint,
      }) as AiNormalizedConcept,
      projectFingerprint: sourceProjectFingerprint,
    };
    return this.state;
  }

  public cancelAiConceptPreview(): ProjectSessionState {
    this.#aiConceptPreview = null;
    return this.state;
  }

  public acceptAiConceptPreview(): ProjectSessionState {
    const preview = this.#aiConceptPreview;
    if (preview === null) {
      throw new RangeError("There is no AI concept preview to accept.");
    }
    if (!preview.summary.wordingMatches) {
      throw new Error("Verify or correct the generated wording before accepting this AI concept.");
    }
    if (preview.projectFingerprint !== fingerprint(this.#project)) {
      throw new Error("The project changed after this AI concept was created. Generate or select it again before accepting.");
    }
    this.executeEditorCommand({
      type: "objects.import",
      layers: preview.layers,
      objects: preview.objects,
    });
    this.#aiConceptPreview = null;
    return this.state;
  }

  public cancelRasterTrace(): ProjectSessionState {
    this.#rasterTracePreview = null;
    return this.state;
  }

  public commitRasterTrace(): ProjectSessionState {
    const preview = this.#rasterTracePreview;
    if (preview === null) {
      throw new RangeError("There is no raster trace preview to accept.");
    }
    if (preview.projectFingerprint !== fingerprint(this.#project)) {
      throw new Error(
        "The project changed after this trace was created. Run the raster trace again before accepting it.",
      );
    }
    this.executeEditorCommand({
      type: "objects.import",
      layers: preview.layers,
      objects: preview.objects,
    });
    this.#rasterTracePreview = null;
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
    this.#importPreview = null;
    this.#rasterTracePreview = null;
    this.#signToolPreview = null;
    this.#aiConceptPreview = null;
  }
}
