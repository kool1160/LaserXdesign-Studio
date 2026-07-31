import type { EditorActionRequest } from "@laserx/application";
import {
  isInvertibleTransform,
  type AffineTransformMm,
  type DocumentObject,
} from "@laserx/domain";
import { z } from "zod";

export const IPC_CHANNELS = {
  getState: "laserx:state:get",
  newProject: "laserx:project:new",
  createDocument: "laserx:document:create",
  openProject: "laserx:project:open",
  openRecent: "laserx:project:open-recent",
  saveProject: "laserx:project:save",
  saveProjectAs: "laserx:project:save-as",
  setDisplayUnit: "laserx:project:set-display-unit",
  setViewportPreferences: "laserx:viewport:set-preferences",
  editorAction: "laserx:editor:action",
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
    }),
    z.strictObject({
      ...objectBaseShape,
      type: z.literal("group"),
      children: z.array(documentObjectSchema).min(1),
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
    z.strictObject({ type: z.literal("clipboard.copy") }),
    z.strictObject({ type: z.literal("clipboard.paste") }),
    z.strictObject({ type: z.literal("objects.duplicate-selection") }),
    z.strictObject({ type: z.literal("objects.group-selection") }),
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

export const resolveRecoveryRequestSchema = z.strictObject({
  action: z.enum(["recover", "discard"]),
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
  setDisplayUnit(request: SetDisplayUnitRequest): Promise<CommandResult>;
  setViewportPreferences(
    request: SetViewportPreferencesRequest,
  ): Promise<CommandResult>;
  editorAction(request: EditorActionRequest): Promise<CommandResult>;
  resolveRecovery(request: ResolveRecoveryRequest): Promise<CommandResult>;
  onStateChanged(listener: (state: DesktopState) => void): () => void;
}
