import type {
  EditorActionRequest,
  GeometryOperationRequest,
} from "@laserx/application";
import {
  isInvertibleTransform,
  type AffineTransformMm,
  type DocumentObject,
  type ManufacturingSettings,
  type SavedSignTemplate,
} from "@laserx/domain";
import type { FontCatalogEntry, TextLayoutRequest } from "@laserx/fonts";
import type { SignToolRequest } from "@laserx/sign-tools";
import { z } from "zod";

import {
  isWithinCapturePixelBudget,
  MAX_CAPTURE_BASE64_LENGTH,
} from "./capture-limits.js";

export const IPC_CHANNELS = {
  getState: "laserx:state:get",
  newProject: "laserx:project:new",
  createDocument: "laserx:document:create",
  openProject: "laserx:project:open",
  openRecent: "laserx:project:open-recent",
  saveProject: "laserx:project:save",
  saveProjectAs: "laserx:project:save-as",
  selectImportSource: "laserx:import:select-source",
  previewVectorImport: "laserx:vector:preview-import",
  configureVectorImport: "laserx:vector:configure-import",
  focusVectorImportFinding: "laserx:vector:focus-import-finding",
  commitVectorImport: "laserx:vector:commit-import",
  cancelVectorImport: "laserx:vector:cancel-import",
  exportVector: "laserx:vector:export",
  exportProductionPackage: "laserx:production:export",
  previewRasterTrace: "laserx:raster:preview-trace",
  cancelRasterTrace: "laserx:raster:cancel-trace",
  acceptRasterTrace: "laserx:raster:accept-trace",
  rejectRasterTrace: "laserx:raster:reject-trace",
  previewSignTool: "laserx:sign-tools:preview",
  acceptSignTool: "laserx:sign-tools:accept",
  rejectSignTool: "laserx:sign-tools:reject",
  saveSignTemplate: "laserx:sign-tools:save-template",
  deleteSignTemplate: "laserx:sign-tools:delete-template",
  openAiAccountPage: "laserx:ai:open-account-page",
  connectAi: "laserx:ai:connect",
  cancelAiConnection: "laserx:ai:cancel-connection",
  replaceAiCredential: "laserx:ai:replace-credential",
  testAiConnection: "laserx:ai:test-connection",
  disconnectAi: "laserx:ai:disconnect",
  attachAiReference: "laserx:ai:attach-reference",
  removeAiReference: "laserx:ai:remove-reference",
  generateAiConcepts: "laserx:ai:generate",
  cancelAiGeneration: "laserx:ai:cancel",
  selectAiConcept: "laserx:ai:select-concept",
  correctAiWording: "laserx:ai:correct-wording",
  acceptAiConcept: "laserx:ai:accept-concept",
  discardAiConcepts: "laserx:ai:discard-concepts",
  setDisplayUnit: "laserx:project:set-display-unit",
  setViewportPreferences: "laserx:viewport:set-preferences",
  setManufacturingSettings: "laserx:manufacturing:set-settings",
  runCutabilityAnalysis: "laserx:manufacturing:analyze",
  runManufacturingLayerAnalysis: "laserx:manufacturing:analyze-layer",
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
  runPhysicalPreview: "laserx:physical-preview:build",
  cancelPhysicalPreview: "laserx:physical-preview:cancel",
  savePhysicalPreviewCapture: "laserx:physical-preview:save-capture",
  onboardingAction: "laserx:onboarding:action",
  stateChanged: "laserx:state:changed",
} as const;

export const displayUnitSchema = z.enum(["millimeters", "inches"]);
const finiteNumber = z.number();
const positiveNumber = finiteNumber.positive();
const nonnegativeNumber = finiteNumber.nonnegative();
const guidedGoalSchema = z.enum([
  "create-first-sign",
  "import-own-design",
  "describe-with-ai",
]);
const guidedWorkflowStatusSchema = z.enum([
  "idle",
  "active",
  "completed",
  "dismissed",
  "failed",
]);
const guidedSurfaceSchema = z.enum([
  "create",
  "import",
  "ai",
  "analysis",
  "preview",
  "output",
]);
const onboardingWorkflowSnapshotSchema = z.strictObject({
  goal: guidedGoalSchema,
  definitionVersion: z.number().int().positive(),
  currentStepId: z.string().min(1),
  completedStepIds: z.array(z.string().min(1)),
  skippedStepIds: z.array(z.string().min(1)),
  projectBinding: z.strictObject({
    projectId: z.string().min(1),
    documentId: z.string().min(1),
    fingerprint: z.string().min(1),
  }),
});
const onboardingPreferencesSchema = z.strictObject({
  schemaVersion: z.literal(1),
  completedGoals: z.array(guidedGoalSchema),
  dismissed: z.boolean(),
  activeWorkflow: onboardingWorkflowSnapshotSchema.nullable(),
});
const manufacturingProcessSchema = z.enum(["laser", "plasma", "waterjet", "router"]);
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

const stockThicknessDesignationSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("gauge"),
    label: z.string().trim().min(1).max(50),
    material: z.enum(["mild-steel", "stainless-steel", "aluminum"]),
  }),
  z.strictObject({
    kind: z.enum(["fractional-inch", "millimeter", "custom"]),
    label: z.string().trim().min(1).max(50),
    material: z.null(),
  }),
]);

const manufacturingLayerMetadataSchema = z.strictObject({
    role: z.enum(["face", "backing", "spacer-tab", "drill-reference", "non-cut-preview"]),
    material: z.enum(["mild-steel", "stainless-steel", "aluminum", "wood", "acrylic", "other"]),
    thicknessMm: positiveNumber,
    stockThicknessDesignation: stockThicknessDesignationSchema.nullable().optional(),
    process: z.enum(["laser", "plasma", "waterjet", "router", "drill", "non-cut"]),
    notes: z.string().max(500),
    registrationGroup: z.string().min(1).max(100).nullable(),
    registrationHoleIds: z.array(z.uuid()).max(1_000).default([]),
  }).refine(
    (metadata) =>
      (metadata.role === "non-cut-preview") ===
      (metadata.process === "non-cut"),
  ).refine(
    (metadata) =>
      new Set(metadata.registrationHoleIds).size ===
      metadata.registrationHoleIds.length,
  ).refine(
    (metadata) =>
      metadata.registrationHoleIds.length === 0 ||
      (metadata.role !== "non-cut-preview" && metadata.registrationGroup !== null),
  );
const layerSchema = z.strictObject({
  id: z.uuid(),
  name: z.string().min(1).max(100),
  visible: z.boolean(),
  locked: z.boolean(),
  manufacturing: manufacturingLayerMetadataSchema.optional(),
});
const guideSchema = z.strictObject({
  id: z.uuid(),
  axis: z.enum(["x", "y"]),
  positionMm: finiteNumber,
});

export const manufacturingSettingsSchema: z.ZodType<ManufacturingSettings> =
  z.strictObject({
    presetId: z.string().trim().min(1).max(100),
    process: manufacturingProcessSchema,
    material: z.enum([
      "mild-steel",
      "stainless-steel",
      "aluminum",
      "wood",
      "acrylic",
      "other",
    ]),
    thicknessMm: positiveNumber,
    stockThicknessDesignation: stockThicknessDesignationSchema.nullable().optional(),
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
      "stockThicknessDesignation",
      "kerfWidthMm",
      "minimumFeatureWidthMm",
      "minimumBridgeWidthMm",
      "minimumGapMm",
      "contourSpacingMm",
      "heatDistortionSpacingMm",
      "tolerancePreset",
    ])).refine((fields) => new Set(fields).size === fields.length),
  });

const signTemplateShapeSchema = z.enum(["rectangle", "rounded-rectangle", "circle", "oval", "shield", "badge", "banner"]);

const signTemplateParametersSchema = z.strictObject({
  kind: z.enum(["monogram", "address", "family-name", "badge"]),
  shape: signTemplateShapeSchema,
  widthMm: positiveNumber.max(100_000),
  heightMm: positiveNumber.max(100_000),
  borderWidthMm: positiveNumber.max(10_000),
  holeDiameterMm: nonnegativeNumber.max(10_000),
  holeInsetMm: nonnegativeNumber.max(100_000),
  fontId: z.string().trim().min(1).max(200),
  fontSizeMm: positiveNumber.max(10_000),
  primaryText: z.string().trim().min(1).max(200),
  secondaryText: z.string().max(200),
  arcRadiusMm: positiveNumber.max(100_000).nullable(),
});

const savedSignTemplateSchema: z.ZodType<SavedSignTemplate> = z.strictObject({
  id: z.uuid(),
  name: z.string().trim().min(1).max(100),
  templateVersion: z.literal(1),
  stylePresetId: z.string().trim().min(1).max(100),
  parameters: signTemplateParametersSchema,
});

export const signToolRequestSchema: z.ZodType<SignToolRequest> = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("border"),
    offsetMm: nonnegativeNumber.max(10_000),
    widthMm: positiveNumber.max(10_000),
    join: z.enum(["miter", "round", "square"]),
  }),
  z.strictObject({
    kind: z.literal("backing-plate"),
    shape: signTemplateShapeSchema,
    marginMm: nonnegativeNumber.max(10_000),
    cornerRadiusMm: nonnegativeNumber.max(10_000),
  }),
  z.strictObject({
    kind: z.literal("outer-shape"),
    shape: signTemplateShapeSchema,
    widthMm: positiveNumber.max(100_000),
    heightMm: positiveNumber.max(100_000),
    cornerRadiusMm: nonnegativeNumber.max(10_000),
  }),
  z.strictObject({
    kind: z.literal("mounting-holes"),
    columns: z.number().int().min(1).max(10),
    rows: z.number().int().min(1).max(10),
    diameterMm: positiveNumber.max(10_000),
    insetXmm: nonnegativeNumber.max(100_000),
    insetYmm: nonnegativeNumber.max(100_000),
  }),
  z.strictObject({
    kind: z.literal("assembly"),
    feature: z.enum(["tabs", "slots"]),
    edge: z.enum(["top", "right", "bottom", "left"]),
    count: z.number().int().min(1).max(20),
    widthMm: positiveNumber.max(10_000),
    depthMm: positiveNumber.max(10_000),
  }),
  z.strictObject({
    kind: z.literal("template"),
    stylePresetId: z.string().trim().min(1).max(100),
    parameters: signTemplateParametersSchema,
  }),
]);

export const saveSignTemplateRequestSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
});

export const deleteSignTemplateRequestSchema = z.strictObject({
  templateId: z.uuid(),
});

export const openAiAccountPageRequestSchema = z.strictObject({
  target: z.enum(["keys", "billing"]),
});

export const attachAiReferenceRequestSchema = z.strictObject({
  consent: z.literal(true),
});

export const aiGenerateRequestSchema = z.strictObject({
  operationId: z.uuid(),
  prompt: z.string().trim().min(1).max(2_000),
  wording: z.string().trim().min(1).max(200),
  widthMm: positiveNumber.max(100_000),
  heightMm: positiveNumber.max(100_000),
  style: z.enum(["auto", "motorcycle-badge", "farmhouse", "industrial", "address-sign"]),
  process: manufacturingProcessSchema,
  detailLevel: z.enum(["simple", "balanced", "detailed"]),
  bridgePreference: z.enum(["none", "automatic", "manual"]),
  holes: z.strictObject({
    enabled: z.boolean(),
    diameterMm: nonnegativeNumber.max(10_000),
    insetMm: nonnegativeNumber.max(100_000),
  }),
  layerCount: z.number().int().min(1).max(3),
  backingPlate: z.boolean(),
  conceptCount: z.number().int().min(2).max(4),
  useReferenceImage: z.boolean(),
  referenceConsent: z.boolean(),
});

export const cancelAiGenerationRequestSchema = z.strictObject({
  operationId: z.uuid(),
});

export const selectAiConceptRequestSchema = z.strictObject({
  conceptId: z.string().min(1).max(200),
});

export const correctAiWordingRequestSchema = z.strictObject({
  conceptId: z.string().min(1).max(200),
  primaryText: z.string().trim().min(1).max(200),
  secondaryText: z.string().max(200),
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
  templates: z.array(savedSignTemplateSchema).max(1_000),
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

export const manufacturingLayerAnalysisRequestSchema = z.strictObject({
  operationId: z.uuid(),
  layerId: z.uuid(),
});

export const productionExportRequestSchema = z.strictObject({
  layerIds: z.array(z.uuid()).min(1),
  formats: z.array(z.enum(["svg", "dxf"])).min(1),
  conflictPolicy: z.enum(["fail", "replace"]),
});

export const cancelCutabilityAnalysisRequestSchema = z.strictObject({
  operationId: z.uuid(),
});

export const runPhysicalPreviewRequestSchema = z.strictObject({
  operationId: z.uuid(),
});

export const cancelPhysicalPreviewRequestSchema = z.strictObject({
  operationId: z.uuid(),
});

/**
 * Privileged capture save (G5). The renderer supplies only already-validated
 * bytes and a flat filename; it never supplies a directory or full path, so
 * it cannot steer the write anywhere the user has not chosen through the
 * main-process save dialog.
 *
 * `filename` is constrained here to the same flat, portable `.png` shape the
 * privileged writer enforces, so a malformed name is rejected at the IPC
 * boundary rather than deeper in the filesystem layer.
 */
export const savePhysicalPreviewCaptureRequestSchema = z.strictObject({
  filename: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9 ._-]{0,199}\.png$/u),
  // Derived from the writer's own byte ceiling so the two cannot drift.
  pngBase64: z.string().min(1).max(MAX_CAPTURE_BASE64_LENGTH),
  overwrite: z.boolean(),
  /**
   * The renderer's claimed capture dimensions. The privileged side decodes
   * the PNG's own IHDR and requires exact agreement, so these are a claim to
   * be checked against the bytes -- never a value the main process trusts.
   */
  widthPx: z.number().int().positive().max(65_535),
  heightPx: z.number().int().positive().max(65_535),
  /**
   * Fingerprint of the assembly this capture was taken from. Main rejects a
   * request that is not bound to the currently accepted preview assembly, so
   * a stale or fabricated capture cannot be written as if it depicted the
   * current document.
   */
  assemblyFingerprint: z.string().min(1).max(256),
}).refine(
  (request) => isWithinCapturePixelBudget(request.widthPx, request.heightPx),
  // Per-axis bounds alone still permit ~4.3 billion pixels; the product is
  // what determines the decoder allocation, so it is bounded explicitly.
  { message: "Capture dimensions exceed the supported decoded-pixel budget." },
);

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
      type: z.literal("layers.align-to-reference"),
      sourceLayerId: z.uuid(),
      targetLayerId: z.uuid(),
    }),
    z.strictObject({
      type: z.literal("layers.coordinate-registration"),
      sourceLayerId: z.uuid(),
      targetLayerId: z.uuid(),
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
      type: z.literal("layer.set-manufacturing"),
      layerId: z.uuid(),
      manufacturing: manufacturingLayerMetadataSchema.nullable(),
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

const guidedStepIdentitySchema = {
  expectedStepId: z.string().min(1),
  runToken: z.string().min(1),
};
const resolutionFindingCountsSchema = z.strictObject({
  safeFixableCount: z.number().int().nonnegative(),
  needsDecisionCount: z.number().int().nonnegative(),
  blockingCount: z.number().int().nonnegative(),
});
export const onboardingActionRequestSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("start"), goal: guidedGoalSchema }),
  z.strictObject({ type: z.literal("resume") }),
  z.strictObject({ type: z.literal("back"), ...guidedStepIdentitySchema }),
  z.strictObject({ type: z.literal("skip"), ...guidedStepIdentitySchema }),
  z.strictObject({ type: z.literal("exit"), runToken: z.string().min(1) }),
  z.strictObject({
    type: z.literal("advance"),
    ...guidedStepIdentitySchema,
    completion: z.union([
      z.strictObject({ kind: z.literal("step") }),
      z.strictObject({
        kind: z.literal("resolution"),
        trigger: z.enum(["automatic", "user"]),
        counts: resolutionFindingCountsSchema,
      }),
      z.strictObject({
        kind: z.literal("physical-preview"),
        result: z.literal("rendered"),
        assemblyFingerprint: z.string().min(1),
      }),
      z.strictObject({
        kind: z.literal("physical-preview"),
        result: z.literal("unavailable"),
        reason: z.enum([
          "assembly-unavailable",
          "build-failed",
          "conversion-failed",
          "context-lost",
          "no-renderable-geometry",
          "preview-crashed",
          "webgl-unavailable",
        ]),
        assemblyFingerprint: z.string().min(1).nullable(),
      }),
    ]),
  }),
]);

export const vectorImportPreviewRequestSchema = z.strictObject({
  unitlessDxfUnit: z.enum(["millimeters", "inches"]).nullable(),
});

export const selectImportSourceRequestSchema = vectorImportPreviewRequestSchema;

export const configureVectorImportRequestSchema = z.strictObject({
  fitMode: z.enum(["resize-stock", "scale-artwork", "keep"]),
  marginMm: z.number().min(0).max(1_000),
});

export const focusVectorImportFindingRequestSchema = z.strictObject({
  objectId: z.uuid(),
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

const interchangeFindingSchema = z.strictObject({
  code: z.string().min(1),
  severity: z.enum(["warning", "repair"]),
  message: z.string().min(1),
  source: z.string().nullable(),
  pathIndex: z.number().int().nonnegative().nullable(),
  locationMm: pointSchema.nullable(),
  objectId: z.uuid().nullable(),
  repair: z.strictObject({
    action: z.enum([
      "remove-duplicate-nodes",
      "close-small-gap",
      "snap-endpoint",
      "remove-duplicate-path",
    ]),
    summary: z.string().min(1),
    changeCount: z.number().int().positive(),
    toleranceMm: z.number().min(0).max(1),
    appliedToPreview: z.literal(true),
  }).nullable(),
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

const physicalPreviewContourSchema = z.strictObject({
  points: z.array(pointSchema),
});
const physicalPreviewFindingSchema = z.strictObject({
  code: z.enum([
    "OPEN_CONTOUR",
    "SELF_INTERSECTION",
    "DUPLICATE_SEGMENT",
    "OVERLAPPING_SEGMENT",
    "UNSUPPORTED_GEOMETRY",
    "EMPTY_PHYSICAL_LAYER",
    "ANALYSIS_LIMIT_EXCEEDED",
  ]),
  layerId: z.uuid(),
  objectIds: z.array(z.uuid()),
  message: z.string(),
});
const physicalPreviewZRangeSchema = z.strictObject({
  minZmm: finiteNumber,
  maxZmm: finiteNumber,
});
export const physicalPreviewAssemblySchema = z.strictObject({
  identity: z.strictObject({
    projectId: z.uuid(),
    documentId: z.uuid(),
    projectUpdatedAt: z.string(),
  }),
  stockMm: z.strictObject({ widthMm: positiveNumber, heightMm: positiveNumber }),
  status: z.enum(["complete", "partial", "unavailable"]),
  spacing: z.strictObject({
    assembledGapMm: nonnegativeNumber,
    explodedGapMm: nonnegativeNumber,
  }),
  layers: z.array(
    z.strictObject({
      layerId: z.uuid(),
      name: z.string(),
      role: z.enum(["face", "backing", "spacer-tab", "drill-reference"]),
      thicknessMm: positiveNumber,
      material: z.strictObject({
        material: z.enum(["mild-steel", "stainless-steel", "aluminum", "wood", "acrylic", "other"]),
        stockThicknessDesignation: stockThicknessDesignationSchema.nullable(),
        displayLabel: z.string(),
      }),
      shapes: z.array(
        z.strictObject({
          id: z.string(),
          outerContour: physicalPreviewContourSchema,
          holeContours: z.array(physicalPreviewContourSchema),
          sourceObjectIds: z.array(z.uuid()),
        }),
      ),
      boundsMm: boundsSchema.nullable(),
      order: z.number().int().nonnegative(),
      assembledZRangeMm: physicalPreviewZRangeSchema,
      explodedZRangeMm: physicalPreviewZRangeSchema,
    }),
  ),
  assembledDepthMm: nonnegativeNumber,
  depthStatus: z.enum(["verified", "declared-incomplete", "unavailable"]),
  findings: z.array(physicalPreviewFindingSchema),
  fingerprint: z.string(),
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
        findings: z.array(interchangeFindingSchema),
        skippedEntityCount: z.number().int().nonnegative(),
        partialImport: z.boolean(),
        assumptions: z.array(z.string()),
        bounds: boundsSchema.nullable(),
        fitMode: z.enum(["resize-stock", "scale-artwork", "keep"]),
        marginMm: z.number().min(0).max(1_000),
        proposedDocumentDimensionsMm: z.strictObject({
          widthMm: positiveNumber,
          heightMm: positiveNumber,
        }),
        oversizedAtOriginalScale: z.boolean(),
        artworkScale: positiveNumber,
        focusedObjectId: z.uuid().nullable(),
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
    signToolPreview: z
      .strictObject({
        layers: z.array(layerSchema).min(1),
        objects: z.array(documentObjectSchema).min(1).max(10_000),
        summary: z.strictObject({
          operation: z.enum(["border", "backing-plate", "outer-shape", "mounting-holes", "assembly", "template"]),
          objectCount: z.number().int().positive(),
          layerCount: z.number().int().positive(),
          warnings: z.array(z.string()),
          assumptions: z.array(z.string()),
          provenanceIds: z.array(z.string().min(1)),
        }),
        template: z.strictObject({
          templateVersion: z.literal(1),
          stylePresetId: z.string().trim().min(1).max(100),
          parameters: signTemplateParametersSchema,
        }).nullable(),
      })
      .nullable(),
    aiConceptPreview: z
      .strictObject({
        summary: z.strictObject({
          id: z.string().min(1).max(200),
          title: z.string().min(1).max(100),
          description: z.string().min(1).max(300),
          source: z.enum(["structured-vector", "raster-trace"]),
          requestedWording: z.string().min(1).max(200),
          observedWording: z.string().min(1).max(200),
          wordingMatches: z.boolean(),
          objectCount: z.number().int().positive().max(10_000),
          layerCount: z.number().int().min(1).max(3),
          warnings: z.array(z.string()),
        }),
        layers: z.array(layerSchema).min(1).max(3),
        objects: z.array(documentObjectSchema).min(1).max(10_000),
        providerId: z.string().min(1).max(100),
        model: z.string().min(1).max(200),
        requestId: z.string().max(500).nullable(),
        usage: z.strictObject({
          inputTokens: z.number().int().nonnegative().nullable(),
          outputTokens: z.number().int().nonnegative().nullable(),
          totalTokens: z.number().int().nonnegative().nullable(),
        }),
        analysis: z.strictObject({
          status: z.enum(["complete", "ambiguous"]),
          issueCount: z.number().int().nonnegative(),
          errorCount: z.number().int().nonnegative(),
          warningCount: z.number().int().nonnegative(),
          cutReady: z.literal(false),
          disclaimer: z.string().min(1),
        }),
        provenanceSaved: z.literal(false),
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
  onboarding: z.strictObject({
    preferences: onboardingPreferencesSchema,
    workflow: z.strictObject({
      status: guidedWorkflowStatusSchema,
      goal: guidedGoalSchema.nullable(),
      runToken: z.string().min(1).nullable(),
      currentStepId: z.string().min(1).nullable(),
      surface: guidedSurfaceSchema.nullable(),
      completedStepIds: z.array(z.string().min(1)),
      skippedStepIds: z.array(z.string().min(1)),
      failureReason: z.string().nullable(),
    }),
    resumeEligibility: z.enum([
      "none",
      "available",
      "different-project",
      "stale",
    ]),
    recoveryNotice: z.string().nullable(),
  }),
  interchange: z.strictObject({
    sourceSelection: z
      .discriminatedUnion("kind", [
        z.strictObject({
          kind: z.literal("vector"),
          sourceName: z.string().min(1),
          format: z.enum(["svg", "dxf"]),
        }),
        z.strictObject({
          kind: z.literal("raster"),
          sourceName: z.string().min(1),
          format: z.enum(["png", "jpeg"]),
          widthPx: z.number().int().positive(),
          heightPx: z.number().int().positive(),
          sourceBytes: z.number().int().positive(),
          decodedBytes: z.number().int().positive(),
        }),
      ])
      .nullable(),
    exportSummary: vectorExportSummarySchema.nullable(),
  }),
  production: z.strictObject({
    preview: z.strictObject({
      packageName: z.string().min(1),
      layers: z.array(z.strictObject({
        layerId: z.uuid(),
        name: z.string().min(1),
        role: z.enum(["face", "backing", "spacer-tab", "drill-reference"]),
        offsetMm: z.strictObject({ xMm: finiteNumber, yMm: finiteNumber }),
        boundsMm: boundsSchema.nullable(),
      })),
    }).nullable(),
    exportSummary: z.strictObject({
      status: z.enum(["success", "failed"]),
      packageName: z.string().min(1),
      targetDirectory: z.string(),
      layerCount: z.number().int().positive(),
      fileCount: z.number().int().nonnegative(),
      warnings: z.array(z.string()),
      failedFile: z.string().nullable(),
      error: z.string().nullable(),
    }).nullable(),
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
  ai: z.strictObject({
    connection: z.strictObject({
      providerId: z.string().min(1).max(100),
      providerName: z.string().min(1).max(100),
      status: z.enum([
        "disconnected",
        "connecting",
        "connected",
        "invalid-key",
        "no-credit",
        "rate-limited",
        "offline",
        "unavailable",
      ]),
      model: z.string().min(1).max(200),
      message: z.string().min(1).max(1_000),
      retryAfterMs: z.number().nonnegative().nullable(),
    }),
    credentialPrompt: z.strictObject({
      active: z.boolean(),
      timeoutMs: z.number().positive().max(10 * 60_000),
    }),
    job: z.strictObject({
      operationId: z.uuid(),
      percent: z.number().min(0).max(100),
      stage: z.enum(["requesting", "normalizing"]),
    }).nullable(),
    reference: z.strictObject({
      mimeType: z.enum(["image/png", "image/jpeg"]),
      widthPx: z.number().int().positive(),
      heightPx: z.number().int().positive(),
      byteLength: z.number().int().positive().max(8 * 1024 * 1024),
      previewDataUrl: z.string().max(12 * 1024 * 1024).refine(
        (value) => value.startsWith("data:image/png;base64,") || value.startsWith("data:image/jpeg;base64,"),
      ),
      consent: z.literal(true),
    }).nullable(),
    concepts: z.array(z.strictObject({
      id: z.string().min(1).max(200),
      title: z.string().min(1).max(100),
      description: z.string().min(1).max(300),
      source: z.enum(["structured-vector", "raster-trace"]),
      requestedWording: z.string().min(1).max(200),
      observedWording: z.string().min(1).max(200),
      wordingMatches: z.boolean(),
      objectCount: z.number().int().positive().max(10_000),
      layerCount: z.number().int().min(1).max(3),
      warnings: z.array(z.string()),
    })).max(4),
    selectedConceptId: z.string().min(1).max(200).nullable(),
    usage: z.strictObject({
      inputTokens: z.number().int().nonnegative().nullable(),
      outputTokens: z.number().int().nonnegative().nullable(),
      totalTokens: z.number().int().nonnegative().nullable(),
    }).nullable(),
    estimate: z.strictObject({
      model: z.string().min(1).max(200),
      maxOutputTokens: z.number().int().positive(),
      note: z.string().min(1).max(1_000),
    }),
  }),
  analysis: z.strictObject({
    scope: z.discriminatedUnion("kind", [
      z.strictObject({ kind: z.literal("whole-design"), layerId: z.null(), layerName: z.null() }),
      z.strictObject({
        kind: z.literal("selection"),
        layerId: z.null(),
        layerName: z.null(),
        objectIds: z.array(z.uuid()).min(1),
      }),
      z.strictObject({ kind: z.literal("manufacturing-layer"), layerId: z.uuid(), layerName: z.string().min(1) }),
    ]).nullable(),
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
  physicalPreview: z.strictObject({
    job: z
      .strictObject({
        operationId: z.uuid(),
        percent: z.number().min(0).max(100),
        stage: z.enum(["preparing", "building"]),
      })
      .nullable(),
    assembly: physicalPreviewAssemblySchema.nullable(),
    /**
     * Result of the most recent privileged capture save. Reports success and
     * failure with equal explicitness -- a silent failure here would let a
     * user believe an image was written when it was not.
     */
    capture: z
      .strictObject({
        status: z.enum(["saved", "canceled", "failed"]),
        targetPath: z.string().nullable(),
        byteLength: z.number().int().nonnegative().nullable(),
        error: z.string().nullable(),
        // The physical-content fingerprint this status describes -- read on
        // the main-process side to hide a stale result once the assembly is
        // rebuilt against different content, but still part of the wire
        // shape since the whole state object crosses the IPC boundary.
        assemblyFingerprint: z.string().nullable(),
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
export type ManufacturingLayerAnalysisRequest = z.infer<
  typeof manufacturingLayerAnalysisRequestSchema
>;
export type ProductionExportRequest = z.infer<
  typeof productionExportRequestSchema
>;
export type CancelCutabilityAnalysisRequest = z.infer<
  typeof cancelCutabilityAnalysisRequestSchema
>;
export type RunPhysicalPreviewRequest = z.infer<
  typeof runPhysicalPreviewRequestSchema
>;
export type SavePhysicalPreviewCaptureRequest = z.infer<
  typeof savePhysicalPreviewCaptureRequestSchema
>;
export type CancelPhysicalPreviewRequest = z.infer<
  typeof cancelPhysicalPreviewRequestSchema
>;
export type PhysicalPreviewAssemblyDto = z.infer<
  typeof physicalPreviewAssemblySchema
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
export type OnboardingActionRequest = z.infer<
  typeof onboardingActionRequestSchema
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
export type SelectImportSourceRequest = z.infer<
  typeof selectImportSourceRequestSchema
>;
export type ConfigureVectorImportRequest = z.infer<
  typeof configureVectorImportRequestSchema
>;
export type FocusVectorImportFindingRequest = z.infer<
  typeof focusVectorImportFindingRequestSchema
>;
export type VectorExportRequest = z.infer<typeof vectorExportRequestSchema>;
export type RasterTraceRequest = z.infer<typeof rasterTraceRequestSchema>;
export type CancelRasterTraceRequest = z.infer<
  typeof cancelRasterTraceRequestSchema
>;
export type SignToolRequestDto = z.infer<typeof signToolRequestSchema>;
export type SaveSignTemplateRequest = z.infer<typeof saveSignTemplateRequestSchema>;
export type DeleteSignTemplateRequest = z.infer<typeof deleteSignTemplateRequestSchema>;
export type OpenAiAccountPageRequest = z.infer<typeof openAiAccountPageRequestSchema>;
export type AttachAiReferenceRequest = z.infer<typeof attachAiReferenceRequestSchema>;
export type AiGenerateRequest = z.infer<typeof aiGenerateRequestSchema>;
export type CancelAiGenerationRequest = z.infer<typeof cancelAiGenerationRequestSchema>;
export type SelectAiConceptRequest = z.infer<typeof selectAiConceptRequestSchema>;
export type CorrectAiWordingRequest = z.infer<typeof correctAiWordingRequestSchema>;

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
  selectImportSource(request: SelectImportSourceRequest): Promise<CommandResult>;
  previewVectorImport(request: VectorImportPreviewRequest): Promise<CommandResult>;
  configureVectorImport(request: ConfigureVectorImportRequest): Promise<CommandResult>;
  focusVectorImportFinding(request: FocusVectorImportFindingRequest): Promise<CommandResult>;
  commitVectorImport(): Promise<CommandResult>;
  cancelVectorImport(): Promise<CommandResult>;
  exportVector(request: VectorExportRequest): Promise<CommandResult>;
  exportProductionPackage(request: ProductionExportRequest): Promise<CommandResult>;
  previewRasterTrace(request: RasterTraceRequest): Promise<CommandResult>;
  cancelRasterTrace(request: CancelRasterTraceRequest): Promise<CommandResult>;
  acceptRasterTrace(): Promise<CommandResult>;
  rejectRasterTrace(): Promise<CommandResult>;
  previewSignTool(request: SignToolRequestDto): Promise<CommandResult>;
  acceptSignTool(): Promise<CommandResult>;
  rejectSignTool(): Promise<CommandResult>;
  saveSignTemplate(request: SaveSignTemplateRequest): Promise<CommandResult>;
  deleteSignTemplate(request: DeleteSignTemplateRequest): Promise<CommandResult>;
  openAiAccountPage(request: OpenAiAccountPageRequest): Promise<CommandResult>;
  connectAi(): Promise<CommandResult>;
  cancelAiConnection(): Promise<CommandResult>;
  replaceAiCredential(): Promise<CommandResult>;
  testAiConnection(): Promise<CommandResult>;
  disconnectAi(): Promise<CommandResult>;
  attachAiReference(request: AttachAiReferenceRequest): Promise<CommandResult>;
  removeAiReference(): Promise<CommandResult>;
  generateAiConcepts(request: AiGenerateRequest): Promise<CommandResult>;
  cancelAiGeneration(request: CancelAiGenerationRequest): Promise<CommandResult>;
  selectAiConcept(request: SelectAiConceptRequest): Promise<CommandResult>;
  correctAiWording(request: CorrectAiWordingRequest): Promise<CommandResult>;
  acceptAiConcept(): Promise<CommandResult>;
  discardAiConcepts(): Promise<CommandResult>;
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
  runManufacturingLayerAnalysis(
    request: ManufacturingLayerAnalysisRequest,
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
  onboardingAction(request: OnboardingActionRequest): Promise<CommandResult>;
  runPhysicalPreview(request: RunPhysicalPreviewRequest): Promise<CommandResult>;
  cancelPhysicalPreview(
    request: CancelPhysicalPreviewRequest,
  ): Promise<CommandResult>;
  savePhysicalPreviewCapture(
    request: SavePhysicalPreviewCaptureRequest,
  ): Promise<CommandResult>;
  onStateChanged(listener: (state: DesktopState) => void): () => void;
}
