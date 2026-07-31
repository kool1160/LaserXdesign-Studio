import type {
  EditorActionRequest,
  GeometryOperationRequest,
} from "@laserx/application";
import {
  isInvertibleTransform,
  type AffineTransformMm,
  type DocumentObject,
} from "@laserx/domain";
import type { FontCatalogEntry, TextLayoutRequest } from "@laserx/fonts";
import { z } from "zod";

export const IPC_CHANNELS = {
  getState: "laserx:state:get",
  newProject: "laserx:project:new",
  createDocument: "laserx:document:create",
  openProject: "laserx:project:open",
  openRecent: "laserx:project:open-recent",
  saveProject: "laserx:project:save",
  saveProjectAs: "laserx:project:save-as",
  previewVectorImport: "laserx:vector:preview-import",
  commitVectorImport: "laserx:vector:commit-import",
  cancelVectorImport: "laserx:vector:cancel-import",
  exportVector: "laserx:vector:export",
  setDisplayUnit: "laserx:project:set-display-unit",
  setViewportPreferences: "laserx:viewport:set-preferences",
  editorAction: "laserx:editor:action",
  geometryOperation: "laserx:geometry:operate",
  cancelGeometryOperation: "laserx:geometry:cancel",
  getFontCatalog: "laserx:fonts:catalog",
  createText: "laserx:text:create",
  updateSelectedText: "laserx:text:update-selected",
  resolveRecovery: "laserx:recovery:resolve",
  stateChanged: "laserx:state:changed",
} as const;

export const displayUnitSchema = z.enum(["millimeters", "inches"]);
const finiteNumber = z.number();
const positiveNumber = finiteNumber.positive();
const nonnegativeNumber = finiteNumber.nonnegative();
const objectIdsSchema = z.array(z.uuid()).min(1);
const pointSchema = z.strictObject({
  xMm: finiteNumber,
  yMm: finiteNumber,
});
const pathControlHandlesSchema = z.strictObject({
  incoming: pointSchema.nullable(),
  outgoing: pointSchema.nullable(),
});
const boundsSchema = z.strictObject({
  minXmm: finiteNumber,
  minYmm: finiteNumber,
  maxXmm: finiteNumber,
  maxYmm: finiteNumber,
});
const transformSchema: z.ZodType<AffineTransformMm> = z
  .strictObject({
    a: finiteNumber,
    b: finiteNumber,
    c: finiteNumber,
    d: finiteNumber,
    eMm: finiteNumber,
    fMm: finiteNumber,
  })
  .refine(isInvertibleTransform, "Transform must be invertible.");

const objectBaseShape = {
  id: z.uuid(),
  layerId: z.uuid(),
  transform: transformSchema,
};
const textStyleSchema = z.strictObject({
  fontId: z.string().min(1).max(200),
  fontFamily: z.string().min(1).max(200),
  fontStyle: z.string().min(1).max(100),
  fontFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  sizeMm: positiveNumber,
  trackingMm: finiteNumber,
  wordSpacingMm: finiteNumber,
  lineSpacing: positiveNumber,
  alignment: z.enum(["left", "center", "right"]),
});
const textArcSchema = z.strictObject({
  radiusMm: positiveNumber,
  startAngleDeg: finiteNumber,
  clockwise: z.boolean(),
});
const textContourSchema = z.strictObject({
  compoundIndex: z.number().int().nonnegative(),
  closed: z.boolean(),
  points: z.array(pointSchema).min(2),
});
const editableTextSourceSchema = z.strictObject({
  content: z.string().min(1).max(10_000),
  origin: pointSchema,
  style: textStyleSchema,
  arc: textArcSchema.nullable(),
  contours: z.array(textContourSchema).min(1),
});
const documentObjectSchema: z.ZodType<DocumentObject> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.strictObject({
      ...objectBaseShape,
      type: z.literal("line"),
      start: pointSchema,
      end: pointSchema,
    }),
    z.strictObject({
      ...objectBaseShape,
      type: z.literal("rectangle"),
      origin: pointSchema,
      widthMm: positiveNumber,
      heightMm: positiveNumber,
    }),
    z.strictObject({
      ...objectBaseShape,
      type: z.literal("ellipse"),
      center: pointSchema,
      radiusXmm: positiveNumber,
      radiusYmm: positiveNumber,
    }),
    z.strictObject({
      ...objectBaseShape,
      type: z.literal("path"),
      closed: z.boolean(),
      points: z.array(pointSchema).min(2),
      handles: z.array(pathControlHandlesSchema).optional(),
    }),
    z.strictObject({
      ...objectBaseShape,
      type: z.literal("text"),
      content: z.string().min(1).max(10_000),
      origin: pointSchema,
      style: textStyleSchema,
      arc: textArcSchema.nullable(),
      contours: z.array(textContourSchema).min(1),
      missingFont: z.boolean(),
    }),
    z.strictObject({
      ...objectBaseShape,
      type: z.literal("group"),
      children: z.array(documentObjectSchema).min(1),
      sourceText: editableTextSourceSchema.optional(),
    }),
  ]),
);

const layerSchema = z.strictObject({
  id: z.uuid(),
  name: z.string().min(1).max(100),
  visible: z.boolean(),
  locked: z.boolean(),
});
const guideSchema = z.strictObject({
  id: z.uuid(),
  axis: z.enum(["x", "y"]),
  positionMm: finiteNumber,
});

const documentSchema = z.strictObject({
  kind: z.literal("document"),
  id: z.uuid(),
  dimensions: z.strictObject({
    widthMm: positiveNumber,
    heightMm: positiveNumber,
  }),
  origin: z.strictObject({
    xMm: z.literal(0),
    yMm: z.literal(0),
  }),
  settings: z.strictObject({
    displayUnit: displayUnitSchema,
    viewport: z.strictObject({
      rulersVisible: z.boolean(),
      gridVisible: z.boolean(),
      gridSpacingMm: positiveNumber,
      snapping: z.strictObject({
        enabled: z.boolean(),
        snapToGrid: z.boolean(),
        snapToGuides: z.boolean(),
        snapToObjects: z.boolean(),
        snapToDocument: z.boolean(),
      }),
    }),
  }),
  layers: z.array(layerSchema).min(1),
  activeLayerId: z.uuid(),
  guides: z.array(guideSchema),
  objects: z.array(documentObjectSchema),
});

export const openRecentRequestSchema = z.strictObject({
  filePath: z.string().min(1).max(32_768),
});

export const createDocumentRequestSchema = z.strictObject({
  width: positiveNumber,
  height: positiveNumber,
  inputUnit: displayUnitSchema,
});

export const setDisplayUnitRequestSchema = z.strictObject({
  displayUnit: displayUnitSchema,
});

export const setViewportPreferencesRequestSchema = z.strictObject({
  rulersVisible: z.boolean().optional(),
  gridVisible: z.boolean().optional(),
  gridSpacingMm: positiveNumber.optional(),
  snappingEnabled: z.boolean().optional(),
  snapToGrid: z.boolean().optional(),
  snapToGuides: z.boolean().optional(),
  snapToObjects: z.boolean().optional(),
  snapToDocument: z.boolean().optional(),
});

const textLayoutRequestShape = {
  fontId: z.string().trim().min(1).max(200),
  content: z.string().min(1).max(10_000),
  sizeMm: positiveNumber,
  trackingMm: finiteNumber,
  wordSpacingMm: finiteNumber,
  lineSpacing: positiveNumber,
  alignment: z.enum(["left", "center", "right"]),
  arc: textArcSchema.nullable(),
};
export const textLayoutRequestSchema: z.ZodType<TextLayoutRequest> =
  z.strictObject(textLayoutRequestShape);
export const textUpdateRequestSchema = z.strictObject({
  ...textLayoutRequestShape,
  mode: z.enum(["live", "explicit"]),
});

const fontCategorySchema = z.enum([
  "stencil",
  "script",
  "serif",
  "slab",
  "western",
  "industrial",
  "display",
]);
const fontLicenseSchema = z.strictObject({
  spdx: z.enum(["OFL-1.1", "Apache-2.0", "MIT", "SYSTEM"]),
  copyright: z.string(),
  licenseFile: z.string().nullable(),
  provenance: z.string(),
});
export const fontCatalogEntrySchema: z.ZodType<FontCatalogEntry> =
  z.strictObject({
    id: z.string().min(1),
    family: z.string().min(1),
    style: z.string().min(1),
    source: z.enum(["bundled", "system"]),
    categories: z.array(fontCategorySchema),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    license: fontLicenseSchema,
  });
export const fontCatalogSchema = z.array(fontCatalogEntrySchema);

const selectionModeSchema = z.enum(["replace", "add", "toggle"]);

export const editorActionRequestSchema: z.ZodType<EditorActionRequest> =
  z.discriminatedUnion("type", [
    z.strictObject({
      type: z.literal("selection.point"),
      point: pointSchema,
      toleranceMm: finiteNumber.nonnegative(),
      mode: selectionModeSchema,
    }),
    z.strictObject({
      type: z.literal("selection.marquee"),
      bounds: boundsSchema,
      mode: selectionModeSchema,
    }),
    z.strictObject({ type: z.literal("selection.all") }),
    z.strictObject({ type: z.literal("selection.clear") }),
    z.strictObject({
      type: z.literal("selection.path-node"),
      objectId: z.uuid(),
      nodeIndex: z.number().int().nonnegative(),
      mode: selectionModeSchema,
    }),
    z.strictObject({
      type: z.literal("selection.path-segment"),
      objectId: z.uuid(),
      segmentIndex: z.number().int().nonnegative(),
      mode: selectionModeSchema,
    }),
    z.strictObject({ type: z.literal("selection.path-clear") }),
    z.strictObject({
      type: z.literal("selection.path-edit"),
      objectId: z.uuid(),
    }),
    z.strictObject({ type: z.literal("clipboard.copy") }),
    z.strictObject({ type: z.literal("clipboard.paste") }),
    z.strictObject({ type: z.literal("objects.duplicate-selection") }),
    z.strictObject({ type: z.literal("objects.group-selection") }),
    z.strictObject({
      type: z.literal("objects.convert-selected-text"),
      preserveSource: z.boolean(),
    }),
    z.strictObject({ type: z.literal("path.split-selected") }),
    z.strictObject({
      type: z.literal("paths.join-selected"),
      toleranceMm: nonnegativeNumber,
    }),
    z.strictObject({ type: z.literal("history.undo") }),
    z.strictObject({ type: z.literal("history.redo") }),
    z.strictObject({
      type: z.literal("history.begin-transaction"),
      label: z.string().trim().min(1).max(100),
    }),
    z.strictObject({ type: z.literal("history.commit-transaction") }),
    z.strictObject({ type: z.literal("history.cancel-transaction") }),
    z.strictObject({
      type: z.literal("object.create"),
      objectType: z.enum(["line", "rectangle", "ellipse"]),
    }),
    z.strictObject({
      type: z.literal("objects.move"),
      objectIds: objectIdsSchema,
      deltaXmm: finiteNumber,
      deltaYmm: finiteNumber,
      snapToleranceMm: finiteNumber.positive().optional(),
    }),
    z.strictObject({
      type: z.literal("objects.set-bounds"),
      objectIds: objectIdsSchema,
      xMm: finiteNumber.optional(),
      yMm: finiteNumber.optional(),
      widthMm: nonnegativeNumber.optional(),
      heightMm: nonnegativeNumber.optional(),
      lockAspectRatio: z.boolean(),
    }),
    z.strictObject({
      type: z.literal("objects.scale"),
      objectIds: objectIdsSchema,
      scaleX: finiteNumber.refine((value) => value !== 0),
      scaleY: finiteNumber.refine((value) => value !== 0),
      pivot: pointSchema,
    }),
    z.strictObject({
      type: z.literal("objects.rotate"),
      objectIds: objectIdsSchema,
      angleDeg: finiteNumber,
      pivot: pointSchema,
    }),
    z.strictObject({
      type: z.literal("objects.mirror"),
      objectIds: objectIdsSchema,
      axis: z.enum(["horizontal", "vertical"]),
      pivot: pointSchema,
    }),
    z.strictObject({
      type: z.literal("objects.delete"),
      objectIds: objectIdsSchema,
    }),
    z.strictObject({
      type: z.literal("path.move-nodes"),
      objectId: z.uuid(),
      nodeIndices: z.array(z.number().int().nonnegative()).min(1),
      deltaXmm: finiteNumber,
      deltaYmm: finiteNumber,
    }),
    z.strictObject({
      type: z.literal("path.add-node"),
      objectId: z.uuid(),
      segmentIndex: z.number().int().nonnegative(),
      ratio: finiteNumber.gt(0).lt(1),
    }),
    z.strictObject({
      type: z.literal("path.delete-nodes"),
      objectId: z.uuid(),
      nodeIndices: z.array(z.number().int().nonnegative()).min(1),
    }),
    z.strictObject({
      type: z.literal("path.set-handle"),
      objectId: z.uuid(),
      nodeIndex: z.number().int().nonnegative(),
      handle: z.enum(["incoming", "outgoing"]),
      point: pointSchema.nullable(),
    }),
    z.strictObject({
      type: z.literal("path.set-closed"),
      objectId: z.uuid(),
      closed: z.boolean(),
    }),
    z.strictObject({
      type: z.literal("path.reverse"),
      objectId: z.uuid(),
    }),
    z.strictObject({
      type: z.literal("path.simplify"),
      objectId: z.uuid(),
      toleranceMm: positiveNumber,
    }),
    z.strictObject({
      type: z.literal("path.cleanup"),
      objectId: z.uuid(),
      toleranceMm: positiveNumber,
    }),
    z.strictObject({
      type: z.literal("objects.align"),
      objectIds: objectIdsSchema,
      alignment: z.enum([
        "left",
        "center-x",
        "right",
        "bottom",
        "center-y",
        "top",
      ]),
    }),
    z.strictObject({
      type: z.literal("objects.distribute"),
      objectIds: objectIdsSchema,
      distribution: z.enum(["horizontal", "vertical"]),
    }),
    z.strictObject({
      type: z.literal("objects.ungroup"),
      objectIds: objectIdsSchema,
    }),
    z.strictObject({
      type: z.literal("objects.z-order"),
      objectIds: objectIdsSchema,
      action: z.enum([
        "bring-forward",
        "send-backward",
        "bring-front",
        "send-back",
      ]),
    }),
    z.strictObject({
      type: z.literal("layer.create"),
      name: z.string().trim().min(1).max(100),
    }),
    z.strictObject({
      type: z.literal("layer.activate"),
      layerId: z.uuid(),
    }),
    z.strictObject({
      type: z.literal("layer.rename"),
      layerId: z.uuid(),
      name: z.string().trim().min(1).max(100),
    }),
    z.strictObject({
      type: z.literal("layer.set-visibility"),
      layerId: z.uuid(),
      visible: z.boolean(),
    }),
    z.strictObject({
      type: z.literal("layer.set-locked"),
      layerId: z.uuid(),
      locked: z.boolean(),
    }),
    z.strictObject({
      type: z.literal("layer.reorder"),
      layerId: z.uuid(),
      toIndex: z.number().int().nonnegative(),
    }),
    z.strictObject({
      type: z.literal("layer.delete"),
      layerId: z.uuid(),
      fallbackLayerId: z.uuid(),
    }),
    z.strictObject({
      type: z.literal("guide.create"),
      axis: z.enum(["x", "y"]),
      positionMm: finiteNumber,
    }),
    z.strictObject({
      type: z.literal("guide.move"),
      guideId: z.uuid(),
      positionMm: finiteNumber,
    }),
    z.strictObject({
      type: z.literal("guide.delete"),
      guideId: z.uuid(),
    }),
  ]);

export const geometryOperationRequestSchema: z.ZodType<GeometryOperationRequest> =
  z.discriminatedUnion("kind", [
    z.strictObject({
      operationId: z.uuid(),
      kind: z.literal("boolean"),
      operation: z.enum(["union", "subtract", "intersect", "xor"]),
    }),
    z.strictObject({
      operationId: z.uuid(),
      kind: z.literal("offset"),
      distanceMm: finiteNumber.refine((value) => value !== 0),
      join: z.enum(["miter", "round", "square"]),
    }),
  ]);

export const cancelGeometryOperationRequestSchema = z.strictObject({
  operationId: z.uuid(),
});

export const resolveRecoveryRequestSchema = z.strictObject({
  action: z.enum(["recover", "discard"]),
});

export const vectorImportPreviewRequestSchema = z.strictObject({
  unitlessDxfUnit: z.enum(["millimeters", "inches"]).nullable(),
});

export const vectorExportRequestSchema = z.strictObject({
  format: z.enum(["svg", "dxf"]),
});

const interchangeWarningSchema = z.strictObject({
  code: z.string().min(1),
  message: z.string().min(1),
  source: z.string().nullable(),
});

const vectorExportSummarySchema = z.strictObject({
  format: z.enum(["svg", "dxf"]),
  objectCount: z.number().int().nonnegative(),
  warningCount: z.number().int().nonnegative(),
  warnings: z.array(interchangeWarningSchema),
  units: z.literal("millimeters"),
  bounds: boundsSchema.nullable(),
});

export const recentProjectSchema = z.strictObject({
  filePath: z.string(),
  name: z.string(),
});

export const desktopStateSchema = z.strictObject({
  project: z.strictObject({
    id: z.uuid(),
    name: z.string(),
    document: documentSchema,
  }),
  editor: z.strictObject({
    selectionIds: z.array(z.uuid()),
    selectionBounds: boundsSchema.nullable(),
    clipboardHasContent: z.boolean(),
    pathSelection: z
      .strictObject({
        objectId: z.uuid(),
        nodeIndices: z.array(z.number().int().nonnegative()),
        segmentIndices: z.array(z.number().int().nonnegative()),
      })
      .nullable(),
    topologySummary: z
      .strictObject({
        operation: z.string(),
        beforeNodeCount: z.number().int().nonnegative(),
        afterNodeCount: z.number().int().nonnegative(),
        replacedObjectIds: z.array(z.uuid()),
        discardedObjectIds: z.array(z.uuid()),
        warnings: z.array(z.string()),
        message: z.string(),
      })
      .nullable(),
    importPreview: z
      .strictObject({
        sourceName: z.string().min(1),
        format: z.enum(["svg", "dxf"]),
        sourceUnit: z.enum([
          "millimeters",
          "centimeters",
          "inches",
          "pixels",
          "unitless",
        ]),
        dimensionsMm: z
          .strictObject({ widthMm: positiveNumber, heightMm: positiveNumber })
          .nullable(),
        layers: z.array(layerSchema),
        objects: z.array(documentObjectSchema),
        warnings: z.array(interchangeWarningSchema),
        assumptions: z.array(z.string()),
        bounds: boundsSchema.nullable(),
      })
      .nullable(),
    history: z.strictObject({
      undoDepth: z.number().int().nonnegative(),
      redoDepth: z.number().int().nonnegative(),
      limit: z.number().int().positive(),
      transactionActive: z.boolean(),
    }),
  }),
  filePath: z.string().nullable(),
  dirty: z.boolean(),
  recovered: z.boolean(),
  recentProjects: z.array(recentProjectSchema),
  recovery: z
    .strictObject({
      capturedAt: z.iso.datetime(),
      originalPath: z.string().nullable(),
      projectName: z.string(),
    })
    .nullable(),
  interchange: z.strictObject({
    exportSummary: vectorExportSummarySchema.nullable(),
  }),
});

export const commandResultSchema = z.discriminatedUnion("ok", [
  z.strictObject({
    ok: z.literal(true),
    state: desktopStateSchema,
  }),
  z.strictObject({
    ok: z.literal(false),
    error: z.string(),
    state: desktopStateSchema,
  }),
]);

export type DesktopState = z.infer<typeof desktopStateSchema>;
export type CommandResult = z.infer<typeof commandResultSchema>;
export type OpenRecentRequest = z.infer<typeof openRecentRequestSchema>;
export type CreateDocumentRequest = z.infer<
  typeof createDocumentRequestSchema
>;
export type SetDisplayUnitRequest = z.infer<
  typeof setDisplayUnitRequestSchema
>;
export type SetViewportPreferencesRequest = z.infer<
  typeof setViewportPreferencesRequestSchema
>;
export type ResolveRecoveryRequest = z.infer<
  typeof resolveRecoveryRequestSchema
>;
export type TextLayoutRequestDto = z.infer<typeof textLayoutRequestSchema>;
export type TextUpdateRequestDto = z.infer<typeof textUpdateRequestSchema>;
export type GeometryOperationRequestDto = z.infer<
  typeof geometryOperationRequestSchema
>;
export type CancelGeometryOperationRequest = z.infer<
  typeof cancelGeometryOperationRequestSchema
>;
export type VectorImportPreviewRequest = z.infer<
  typeof vectorImportPreviewRequestSchema
>;
export type VectorExportRequest = z.infer<typeof vectorExportRequestSchema>;

export interface LaserxDesktopApi {
  readonly security: Readonly<{
    contextIsolated: boolean;
    sandboxed: boolean;
  }>;
  getState(): Promise<DesktopState>;
  newProject(): Promise<CommandResult>;
  createDocument(request: CreateDocumentRequest): Promise<CommandResult>;
  openProject(): Promise<CommandResult>;
  openRecent(request: OpenRecentRequest): Promise<CommandResult>;
  saveProject(): Promise<CommandResult>;
  saveProjectAs(): Promise<CommandResult>;
  previewVectorImport(request: VectorImportPreviewRequest): Promise<CommandResult>;
  commitVectorImport(): Promise<CommandResult>;
  cancelVectorImport(): Promise<CommandResult>;
  exportVector(request: VectorExportRequest): Promise<CommandResult>;
  setDisplayUnit(request: SetDisplayUnitRequest): Promise<CommandResult>;
  setViewportPreferences(
    request: SetViewportPreferencesRequest,
  ): Promise<CommandResult>;
  editorAction(request: EditorActionRequest): Promise<CommandResult>;
  geometryOperation(
    request: GeometryOperationRequestDto,
  ): Promise<CommandResult>;
  cancelGeometryOperation(
    request: CancelGeometryOperationRequest,
  ): Promise<CommandResult>;
  getFontCatalog(): Promise<FontCatalogEntry[]>;
  createText(request: TextLayoutRequestDto): Promise<CommandResult>;
  updateSelectedText(
    request: TextUpdateRequestDto,
  ): Promise<CommandResult>;
  resolveRecovery(request: ResolveRecoveryRequest): Promise<CommandResult>;
  onStateChanged(listener: (state: DesktopState) => void): () => void;
}
