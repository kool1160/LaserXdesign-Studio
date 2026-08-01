import type {
  EditorActionRequest,
  GeometryOperationRequest,
} from "@laserx/application";
import {
  isInvertibleTransform,
  type AffineTransformMm,
  type DocumentObject,
  type ManufacturingSettings,
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
  previewRasterTrace: "laserx:raster:preview-trace",
  cancelRasterTrace: "laserx:raster:cancel-trace",
  acceptRasterTrace: "laserx:raster:accept-trace",
  rejectRasterTrace: "laserx:raster:reject-trace",
  setDisplayUnit: "laserx:project:set-display-unit",
  setViewportPreferences: "laserx:viewport:set-preferences",
  setManufacturingSettings: "laserx:manufacturing:set-settings",
  runCutabilityAnalysis: "laserx:manufacturing:analyze",
  cancelCutabilityAnalysis: "laserx:manufacturing:cancel-analysis",
  focusCutabilityIssue: "laserx:manufacturing:focus-issue",
  previewBridge: "laserx:manufacturing:preview-bridge",
  acceptBridge: "laserx:manufacturing:accept-bridge",
  rejectBridge: "laserx:manufacturing:reject-bridge",
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

export const manufacturingSettingsSchema: z.ZodType<ManufacturingSettings> =
  z.strictObject({
    presetId: z.string().trim().min(1).max(100),
    process: z.enum(["laser", "plasma", "waterjet", "router"]),
    material: z.enum([
      "mild-steel",
      "stainless-steel",
      "aluminum",
      "wood",
      "acrylic",
      "other",
    ]),
    thicknessMm: positiveNumber,
    kerfWidthMm: positiveNumber,
    minimumFeatureWidthMm: positiveNumber,
    minimumBridgeWidthMm: positiveNumber,
    minimumGapMm: positiveNumber,
    contourSpacingMm: positiveNumber,
    heatDistortionSpacingMm: positiveNumber.nullable(),
    tolerancePreset: z.enum(["fine", "balanced", "robust"]),
    customizedFields: z.array(z.enum([
      "process",
      "material",
      "thicknessMm",
      "kerfWidthMm",
      "minimumFeatureWidthMm",
      "minimumBridgeWidthMm",
      "minimumGapMm",
      "contourSpacingMm",
      "heatDistortionSpacingMm",
      "tolerancePreset",
    ])).refine((fields) => new Set(fields).size === fields.length),
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
    manufacturing: manufacturingSettingsSchema,
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

export const setManufacturingSettingsRequestSchema = z.strictObject({
  settings: manufacturingSettingsSchema,
});

export const cutabilityAnalysisRequestSchema = z.strictObject({
  operationId: z.uuid(),
  objectIds: z.array(z.uuid()),
});

export const cancelCutabilityAnalysisRequestSchema = z.strictObject({
  operationId: z.uuid(),
});

export const focusCutabilityIssueRequestSchema = z.strictObject({
  issueId: z.string().min(1).nullable(),
});

export const bridgeProposalRequestSchema = z.strictObject({
  issueId: z.string().min(1),
  widthMm: positiveNumber,
  mode: z.enum(["manual", "automatic"]),
  direction: z.enum(["left", "right", "up", "down"]).optional(),
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

const rasterCropSchema = z.strictObject({
  left: z.number().min(0).lt(1),
  top: z.number().min(0).lt(1),
  right: z.number().min(0).lt(1),
  bottom: z.number().min(0).lt(1),
});

export const rasterTraceSettingsSchema = z.strictObject({
  preset: z.enum(["draft", "balanced", "detailed"]),
  outputWidthMm: z.number().positive().max(10_000),
  crop: rasterCropSchema,
  rotationDeg: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  grayscaleMode: z.enum(["luminance", "average"]),
  contrast: z.number().int().min(-100).max(100),
  threshold: z.number().int().min(0).max(255),
  invert: z.boolean(),
  blurRadiusPx: z.number().int().min(0).max(3),
  denoiseRadiusPx: z.number().int().min(0).max(2),
  background: z.enum(["auto", "white", "black"]),
  speckleAreaPx: z.number().int().min(0).max(100_000),
  smoothingPasses: z.number().int().min(0).max(3),
  simplificationToleranceMm: z.number().positive().max(10),
});

export const rasterTraceRequestSchema = z.strictObject({
  operationId: z.uuid(),
  settings: rasterTraceSettingsSchema,
});

export const cancelRasterTraceRequestSchema = z.strictObject({
  operationId: z.uuid(),
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
    rasterTracePreview: z
      .strictObject({
        sourceName: z.string().min(1),
        source: z.strictObject({
          format: z.enum(["png", "jpeg"]),
          widthPx: z.number().int().positive(),
          heightPx: z.number().int().positive(),
          sourceBytes: z.number().int().positive(),
          decodedBytes: z.number().int().positive(),
        }),
        settings: rasterTraceSettingsSchema,
        layers: z.array(layerSchema),
        objects: z.array(documentObjectSchema),
        warnings: z.array(interchangeWarningSchema),
        assumptions: z.array(z.string()),
        summary: z.strictObject({
          engineId: z.string().min(1),
          engineVersion: z.string().min(1),
          sourceWidthPx: z.number().int().positive(),
          sourceHeightPx: z.number().int().positive(),
          traceWidthPx: z.number().int().positive(),
          traceHeightPx: z.number().int().positive(),
          outputWidthMm: positiveNumber,
          outputHeightMm: positiveNumber,
          pathCount: z.number().int().positive(),
          nodeCount: z.number().int().positive(),
          sourceBoundaryNodeCount: z.number().int().positive(),
          smallestFeatureMm: positiveNumber.nullable(),
          speckleThresholdPx: z.number().int().nonnegative(),
          removedSpeckleCount: z.number().int().nonnegative(),
          removedSpeckleAreaPx: z.number().int().nonnegative(),
          simplificationToleranceMm: positiveNumber,
          bounds: boundsSchema.nullable(),
        }),
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
  raster: z.strictObject({
    job: z
      .strictObject({
        operationId: z.uuid(),
        percent: z.number().min(0).max(100),
        stage: z.enum(["selecting", "reading", "decoding", "preprocessing", "filtering", "tracing", "simplifying", "preview"]),
      })
      .nullable(),
    preview: z
      .strictObject({
        operationId: z.uuid(),
        widthPx: z.number().int().positive(),
        heightPx: z.number().int().positive(),
        original: z.string().startsWith("data:image/png;base64,"),
        blackWhite: z.string().startsWith("data:image/png;base64,"),
        edges: z.string().startsWith("data:image/png;base64,"),
      })
      .nullable(),
  }),
  analysis: z.strictObject({
    job: z
      .strictObject({
        operationId: z.uuid(),
        percent: z.number().min(0).max(100),
        stage: z.enum(["normalizing", "topology", "spacing", "classifying"]),
      })
      .nullable(),
    focusedIssueId: z.string().nullable(),
    bridgeProposal: z
      .strictObject({
        id: z.string().min(1),
        issueId: z.string().min(1),
        mode: z.enum(["manual", "automatic"]),
        direction: z.enum(["left", "right", "up", "down"]),
        sourceObjectIds: z.array(z.uuid()).min(2),
        layerId: z.uuid(),
        widthMm: positiveNumber,
        lengthMm: nonnegativeNumber,
        bridgePolygon: z.array(pointSchema).min(4),
        replacementContours: z.array(z.strictObject({
          closed: z.literal(true),
          points: z.array(pointSchema).min(3),
        })).min(1),
        documentFingerprint: z.string().min(1),
        summary: z.string().min(1),
        warnings: z.array(z.string()),
      })
      .nullable(),
    cutability: z
      .strictObject({
        operationId: z.uuid().nullable(),
        status: z.enum(["complete", "ambiguous"]),
        documentFingerprint: z.string().min(1),
        analyzedObjectIds: z.array(z.uuid()),
        settings: manufacturingSettingsSchema,
        pathCount: z.number().int().nonnegative(),
        closedPathCount: z.number().int().nonnegative(),
        openPathCount: z.number().int().nonnegative(),
        segmentCount: z.number().int().nonnegative(),
        smallestSegmentMm: positiveNumber.nullable(),
        issueCount: z.number().int().nonnegative(),
        errorCount: z.number().int().nonnegative(),
        warningCount: z.number().int().nonnegative(),
        issues: z.array(
          z.strictObject({
            id: z.string().min(1),
            code: z.enum([
              "OPEN_CONTOUR",
              "DUPLICATE_SEGMENT",
              "OVERLAPPING_SEGMENT",
              "SELF_INTERSECTION",
              "DISCONNECTED_ISLAND",
              "ENCLOSED_DROPOUT",
              "BRIDGE_TOO_NARROW",
              "FEATURE_TOO_NARROW",
              "GAP_TOO_SMALL",
              "CONTOURS_TOO_CLOSE",
              "KERF_COLLAPSE_RISK",
              "UNSUPPORTED_GEOMETRY",
            ]),
            severity: z.enum(["warning", "error"]),
            objectIds: z.array(z.uuid()),
            objectId: z.uuid().nullable(),
            segmentIndices: z.array(z.number().int().nonnegative()),
            segmentIndex: z.number().int().nonnegative().nullable(),
            measuredValueMm: z.number().nonnegative(),
            configuredLimitMm: z.number().nonnegative(),
            location: pointSchema,
            message: z.string().min(1),
            suggestion: z.string().min(1),
          }),
        ),
        regions: z.array(z.strictObject({
          id: z.string().min(1),
          objectId: z.uuid(),
          contourIndex: z.number().int().nonnegative(),
          parentRegionId: z.string().nullable(),
          depth: z.number().int().nonnegative(),
          disposition: z.enum(["retained", "removed", "ambiguous"]),
          areaMm2: positiveNumber,
          bounds: boundsSchema,
          points: z.array(pointSchema).min(3),
        })),
        previewAssumption: z.string().min(1),
        disclaimer: z.string().min(1),
        cutReady: z.literal(false),
      })
      .nullable(),
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
export type SetManufacturingSettingsRequest = z.infer<
  typeof setManufacturingSettingsRequestSchema
>;
export type CutabilityAnalysisRequest = z.infer<
  typeof cutabilityAnalysisRequestSchema
>;
export type CancelCutabilityAnalysisRequest = z.infer<
  typeof cancelCutabilityAnalysisRequestSchema
>;
export type FocusCutabilityIssueRequest = z.infer<
  typeof focusCutabilityIssueRequestSchema
>;
export type BridgeProposalRequestDto = z.infer<
  typeof bridgeProposalRequestSchema
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
export type RasterTraceRequest = z.infer<typeof rasterTraceRequestSchema>;
export type CancelRasterTraceRequest = z.infer<
  typeof cancelRasterTraceRequestSchema
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
  previewVectorImport(request: VectorImportPreviewRequest): Promise<CommandResult>;
  commitVectorImport(): Promise<CommandResult>;
  cancelVectorImport(): Promise<CommandResult>;
  exportVector(request: VectorExportRequest): Promise<CommandResult>;
  previewRasterTrace(request: RasterTraceRequest): Promise<CommandResult>;
  cancelRasterTrace(request: CancelRasterTraceRequest): Promise<CommandResult>;
  acceptRasterTrace(): Promise<CommandResult>;
  rejectRasterTrace(): Promise<CommandResult>;
  setDisplayUnit(request: SetDisplayUnitRequest): Promise<CommandResult>;
  setViewportPreferences(
    request: SetViewportPreferencesRequest,
  ): Promise<CommandResult>;
  setManufacturingSettings(
    request: SetManufacturingSettingsRequest,
  ): Promise<CommandResult>;
  runCutabilityAnalysis(
    request: CutabilityAnalysisRequest,
  ): Promise<CommandResult>;
  cancelCutabilityAnalysis(
    request: CancelCutabilityAnalysisRequest,
  ): Promise<CommandResult>;
  focusCutabilityIssue(
    request: FocusCutabilityIssueRequest,
  ): Promise<CommandResult>;
  previewBridge(request: BridgeProposalRequestDto): Promise<CommandResult>;
  acceptBridge(): Promise<CommandResult>;
  rejectBridge(): Promise<CommandResult>;
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
