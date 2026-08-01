import { normalizeCutPaths } from "@laserx/cutability";
import {
  getSelectionBounds,
  identityTransform,
  type BoundsMm,
  type DocumentObject,
  type EllipseObject,
  type LaserxDocument,
  type Layer,
  type PathObject,
  type PointMm,
  type RectangleObject,
  type SavedSignTemplate,
  type SignTemplateKind,
  type SignTemplateParameters,
  type SignTemplateShape,
  type TextObject,
} from "@laserx/domain";
import {
  boundsHeight,
  boundsWidth,
  defaultGeometryEngine,
  type EngineContour,
  type OffsetJoin,
} from "@laserx/geometry";

export * from "./presets.js";
import { signStylePreset } from "./presets.js";

export interface SignTextLayoutRequest {
  fontId: string;
  content: string;
  sizeMm: number;
  trackingMm: number;
  wordSpacingMm: number;
  lineSpacing: number;
  alignment: "left" | "center" | "right";
  arc: {
    radiusMm: number;
    startAngleDeg: number;
    clockwise: boolean;
  } | null;
}

export interface SignTextLayoutResult {
  font: {
    id: string;
    family: string;
    style: string;
    fingerprint: string;
  };
  contours: Array<{
    compoundIndex: number;
    closed: boolean;
    points: PointMm[];
  }>;
  bounds: BoundsMm;
  missingCodePoints: number[];
}

export interface SignGenerationContext {
  document: LaserxDocument;
  selectedObjectIds: readonly string[];
  createId(): string;
  layoutText(request: SignTextLayoutRequest): SignTextLayoutResult;
}

export type SignToolRequest =
  | {
      kind: "border";
      offsetMm: number;
      widthMm: number;
      join: OffsetJoin;
    }
  | {
      kind: "backing-plate";
      shape: SignTemplateShape;
      marginMm: number;
      cornerRadiusMm: number;
    }
  | {
      kind: "outer-shape";
      shape: SignTemplateShape;
      widthMm: number;
      heightMm: number;
      cornerRadiusMm: number;
    }
  | {
      kind: "mounting-holes";
      columns: number;
      rows: number;
      diameterMm: number;
      insetXmm: number;
      insetYmm: number;
    }
  | {
      kind: "assembly";
      feature: "tabs" | "slots";
      edge: "top" | "right" | "bottom" | "left";
      count: number;
      widthMm: number;
      depthMm: number;
    }
  | {
      kind: "template";
      stylePresetId: string;
      parameters: SignTemplateParameters;
    };

export interface SignGenerationSummary {
  operation: SignToolRequest["kind"];
  objectCount: number;
  layerCount: number;
  warnings: string[];
  assumptions: string[];
  provenanceIds: string[];
}

export interface SignGenerationCandidate {
  layers: Layer[];
  objects: DocumentObject[];
  summary: SignGenerationSummary;
  template: Omit<SavedSignTemplate, "id" | "name"> | null;
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite.`);
  return value;
}

function positive(value: number, label: string): number {
  finite(value, label);
  if (value <= 0) throw new RangeError(`${label} must be positive.`);
  return value;
}

function nonnegative(value: number, label: string): number {
  finite(value, label);
  if (value < 0) throw new RangeError(`${label} must be nonnegative.`);
  return value;
}

function exactCount(value: number, label: string, maximum = 20): number {
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new RangeError(`${label} must be an integer from 1 to ${String(maximum)}.`);
  }
  return value;
}

function expanded(bounds: BoundsMm, marginMm: number): BoundsMm {
  nonnegative(marginMm, "Margin");
  return {
    minXmm: bounds.minXmm - marginMm,
    minYmm: bounds.minYmm - marginMm,
    maxXmm: bounds.maxXmm + marginMm,
    maxYmm: bounds.maxYmm + marginMm,
  };
}

function centeredBounds(document: LaserxDocument, widthMm: number, heightMm: number): BoundsMm {
  positive(widthMm, "Width");
  positive(heightMm, "Height");
  const centerX = document.origin.xMm + document.dimensions.widthMm / 2;
  const centerY = document.origin.yMm + document.dimensions.heightMm / 2;
  return {
    minXmm: centerX - widthMm / 2,
    minYmm: centerY - heightMm / 2,
    maxXmm: centerX + widthMm / 2,
    maxYmm: centerY + heightMm / 2,
  };
}

function roundedRectanglePoints(bounds: BoundsMm, radiusMm: number): PointMm[] {
  const radius = Math.min(
    nonnegative(radiusMm, "Corner radius"),
    boundsWidth(bounds) / 2,
    boundsHeight(bounds) / 2,
  );
  if (radius === 0) {
    return [
      { xMm: bounds.minXmm, yMm: bounds.minYmm },
      { xMm: bounds.maxXmm, yMm: bounds.minYmm },
      { xMm: bounds.maxXmm, yMm: bounds.maxYmm },
      { xMm: bounds.minXmm, yMm: bounds.maxYmm },
    ];
  }
  const points: PointMm[] = [];
  const corners = [
    { x: bounds.maxXmm - radius, y: bounds.minYmm + radius, start: -90 },
    { x: bounds.maxXmm - radius, y: bounds.maxYmm - radius, start: 0 },
    { x: bounds.minXmm + radius, y: bounds.maxYmm - radius, start: 90 },
    { x: bounds.minXmm + radius, y: bounds.minYmm + radius, start: 180 },
  ];
  for (const corner of corners) {
    for (let step = 0; step < 6; step += 1) {
      const angle = ((corner.start + step * 15) * Math.PI) / 180;
      points.push({
        xMm: corner.x + Math.cos(angle) * radius,
        yMm: corner.y + Math.sin(angle) * radius,
      });
    }
  }
  return points;
}

function shapeObject(
  shape: SignTemplateShape,
  bounds: BoundsMm,
  cornerRadiusMm: number,
  id: string,
  layerId: string,
): RectangleObject | EllipseObject | PathObject {
  const widthMm = boundsWidth(bounds);
  const heightMm = boundsHeight(bounds);
  positive(widthMm, "Shape width");
  positive(heightMm, "Shape height");
  const base = { id, layerId, transform: identityTransform() };
  if (shape === "rectangle") {
    return {
      ...base,
      type: "rectangle",
      origin: { xMm: bounds.minXmm, yMm: bounds.minYmm },
      widthMm,
      heightMm,
    };
  }
  if (shape === "circle" || shape === "oval") {
    const radius = shape === "circle" ? Math.min(widthMm, heightMm) / 2 : null;
    return {
      ...base,
      type: "ellipse",
      center: {
        xMm: (bounds.minXmm + bounds.maxXmm) / 2,
        yMm: (bounds.minYmm + bounds.maxYmm) / 2,
      },
      radiusXmm: radius ?? widthMm / 2,
      radiusYmm: radius ?? heightMm / 2,
    };
  }
  let points: PointMm[];
  if (shape === "rounded-rectangle") {
    points = roundedRectanglePoints(bounds, cornerRadiusMm);
  } else if (shape === "shield") {
    points = [
      { xMm: bounds.minXmm, yMm: bounds.maxYmm },
      { xMm: bounds.maxXmm, yMm: bounds.maxYmm },
      { xMm: bounds.maxXmm * 0.9 + bounds.minXmm * 0.1, yMm: bounds.minYmm + heightMm * 0.35 },
      { xMm: (bounds.minXmm + bounds.maxXmm) / 2, yMm: bounds.minYmm },
      { xMm: bounds.minXmm * 0.9 + bounds.maxXmm * 0.1, yMm: bounds.minYmm + heightMm * 0.35 },
    ];
  } else if (shape === "badge") {
    points = Array.from({ length: 12 }, (_, index) => {
      const angle = (index / 12) * Math.PI * 2;
      const modulation = index % 2 === 0 ? 1 : 0.88;
      return {
        xMm: (bounds.minXmm + bounds.maxXmm) / 2 + Math.cos(angle) * widthMm / 2 * modulation,
        yMm: (bounds.minYmm + bounds.maxYmm) / 2 + Math.sin(angle) * heightMm / 2 * modulation,
      };
    });
  } else {
    const notch = Math.min(widthMm * 0.1, heightMm * 0.3);
    points = [
      { xMm: bounds.minXmm, yMm: bounds.minYmm },
      { xMm: bounds.minXmm + notch, yMm: (bounds.minYmm + bounds.maxYmm) / 2 },
      { xMm: bounds.minXmm, yMm: bounds.maxYmm },
      { xMm: bounds.maxXmm, yMm: bounds.maxYmm },
      { xMm: bounds.maxXmm - notch, yMm: (bounds.minYmm + bounds.maxYmm) / 2 },
      { xMm: bounds.maxXmm, yMm: bounds.minYmm },
    ];
  }
  return { ...base, type: "path", closed: true, points };
}

function layer(context: SignGenerationContext, name: string): Layer {
  return { id: context.createId(), name, visible: true, locked: false };
}

function contoursToPaths(
  contours: readonly EngineContour[],
  layerId: string,
  createId: () => string,
): PathObject[] {
  return contours.map((contour) => ({
    id: createId(),
    type: "path",
    layerId,
    transform: identityTransform(),
    closed: true,
    points: contour.points.map((point) => ({ ...point })),
  }));
}

export function baselineTextRequest(
  parameters: SignTemplateParameters,
  content = parameters.primaryText,
): SignTextLayoutRequest {
  return {
    fontId: parameters.fontId,
    content,
    sizeMm: parameters.fontSizeMm,
    trackingMm: 0,
    wordSpacingMm: 0,
    lineSpacing: 1.2,
    alignment: "center",
    arc: null,
  };
}

export function arcTextRequest(
  parameters: SignTemplateParameters,
  content = parameters.primaryText,
  clockwise = false,
): SignTextLayoutRequest {
  return {
    ...baselineTextRequest(parameters, content),
    arc: {
      radiusMm: positive(parameters.arcRadiusMm ?? parameters.widthMm * 0.34, "Arc radius"),
      startAngleDeg: 0,
      clockwise,
    },
  };
}

function materializeText(
  context: SignGenerationContext,
  parameters: SignTemplateParameters,
  content: string,
  origin: PointMm,
  layerId: string,
  arc: boolean,
): TextObject | null {
  if (content.trim().length === 0) return null;
  const request = arc
    ? arcTextRequest(parameters, content)
    : baselineTextRequest(parameters, content);
  const layout = context.layoutText(request);
  const cleanContours = layout.contours.flatMap((contour) => {
    const points = contour.points.filter((point, index, all) => {
      const previous = all[index - 1];
      return previous === undefined || Math.hypot(
        point.xMm - previous.xMm,
        point.yMm - previous.yMm,
      ) > 1e-9;
    });
    const first = points[0];
    const last = points.at(-1);
    if (
      contour.closed &&
      first !== undefined &&
      last !== undefined &&
      Math.hypot(first.xMm - last.xMm, first.yMm - last.yMm) <= 1e-9
    ) {
      points.pop();
    }
    return contour.closed && points.length >= 3
      ? [{ ...contour, points }]
      : [];
  });
  const union = cleanContours.length === 0
    ? { contours: [] }
    : defaultGeometryEngine.boolean(
        "union",
        cleanContours.map((contour) => ({
          closed: true,
          points: contour.points,
        })),
      );
  const contours = union.contours.map((contour) => ({
    compoundIndex: 0,
    closed: true,
    points: contour.points,
  }));
  if (contours.length === 0) {
    throw new RangeError("Template text must contain at least one visible glyph.");
  }
  return {
    id: context.createId(),
    type: "text",
    layerId,
    transform: identityTransform(),
    content,
    origin,
    style: {
      fontId: layout.font.id,
      fontFamily: layout.font.family,
      fontStyle: layout.font.style,
      fontFingerprint: layout.font.fingerprint,
      sizeMm: request.sizeMm,
      trackingMm: request.trackingMm,
      wordSpacingMm: request.wordSpacingMm,
      lineSpacing: request.lineSpacing,
      alignment: request.alignment,
    },
    arc: request.arc === null ? null : { ...request.arc },
    contours: contours.map((contour) => ({
      ...contour,
      points: contour.points.map((point) => ({ ...point })),
    })),
    missingFont: layout.missingCodePoints.length > 0,
  };
}

function selectionBounds(context: SignGenerationContext): BoundsMm {
  const bounds = getSelectionBounds(context.document, context.selectedObjectIds);
  if (bounds === null) {
    throw new RangeError("Select editable sign geometry before using this tool.");
  }
  return bounds;
}

function mountingHoles(
  bounds: BoundsMm,
  columns: number,
  rows: number,
  diameterMm: number,
  insetXmm: number,
  insetYmm: number,
  layerId: string,
  createId: () => string,
): EllipseObject[] {
  exactCount(columns, "Hole columns", 10);
  exactCount(rows, "Hole rows", 10);
  positive(diameterMm, "Hole diameter");
  nonnegative(insetXmm, "Horizontal hole inset");
  nonnegative(insetYmm, "Vertical hole inset");
  if (
    insetXmm < diameterMm / 2 ||
    insetYmm < diameterMm / 2 ||
    insetXmm * 2 > boundsWidth(bounds) ||
    insetYmm * 2 > boundsHeight(bounds)
  ) {
    throw new RangeError("Mounting-hole insets do not fit within the target bounds.");
  }
  const xs = Array.from({ length: columns }, (_, index) =>
    columns === 1
      ? (bounds.minXmm + bounds.maxXmm) / 2
      : bounds.minXmm + insetXmm + index * ((boundsWidth(bounds) - insetXmm * 2) / (columns - 1)),
  );
  const ys = Array.from({ length: rows }, (_, index) =>
    rows === 1
      ? (bounds.minYmm + bounds.maxYmm) / 2
      : bounds.minYmm + insetYmm + index * ((boundsHeight(bounds) - insetYmm * 2) / (rows - 1)),
  );
  return ys.flatMap((yMm) => xs.map((xMm) => ({
    id: createId(),
    type: "ellipse" as const,
    layerId,
    transform: identityTransform(),
    center: { xMm, yMm },
    radiusXmm: diameterMm / 2,
    radiusYmm: diameterMm / 2,
  })));
}

function generateTemplate(
  request: Extract<SignToolRequest, { kind: "template" }>,
  context: SignGenerationContext,
): SignGenerationCandidate {
  const preset = signStylePreset(request.stylePresetId);
  const parameters = {
    ...request.parameters,
    shape: preset.shape,
    fontId: preset.fontId,
  };
  if (!preset.templateKinds.includes(parameters.kind)) {
    throw new RangeError("The selected style does not support this template kind.");
  }
  positive(parameters.borderWidthMm, "Border width");
  const bounds = centeredBounds(context.document, parameters.widthMm, parameters.heightMm);
  const backing = layer(context, "Sign Backing");
  const detail = layer(context, "Sign Detail");
  const holes = layer(context, "Mounting Holes");
  const outer = shapeObject(parameters.shape, bounds, parameters.heightMm * 0.12, context.createId(), backing.id);
  const inset = parameters.borderWidthMm;
  const innerBounds = {
    minXmm: bounds.minXmm + inset,
    minYmm: bounds.minYmm + inset,
    maxXmm: bounds.maxXmm - inset,
    maxYmm: bounds.maxYmm - inset,
  };
  if (boundsWidth(innerBounds) <= 0 || boundsHeight(innerBounds) <= 0) {
    throw new RangeError("Border width leaves no interior sign area.");
  }
  const innerObjects = parameters.shape === "badge" && outer.type === "path"
    ? contoursToPaths(
        defaultGeometryEngine.offset(
          [{ closed: true, points: outer.points }],
          -inset,
          "round",
        ).contours,
        detail.id,
        () => context.createId(),
      )
    : [shapeObject(
        parameters.shape,
        innerBounds,
        Math.max(0, parameters.heightMm * 0.12 - inset),
        context.createId(),
        detail.id,
      )];
  if (innerObjects.length === 0) {
    throw new RangeError("Border width leaves no valid interior contour.");
  }
  const objects: DocumentObject[] = [outer, ...innerObjects];
  const center = {
    xMm: (bounds.minXmm + bounds.maxXmm) / 2,
    yMm: (bounds.minYmm + bounds.maxYmm) / 2,
  };
  const primary = materializeText(
    context,
    parameters,
    parameters.primaryText,
    { xMm: center.xMm, yMm: center.yMm + (parameters.secondaryText.trim() === "" ? 0 : parameters.fontSizeMm * 0.35) },
    detail.id,
    parameters.arcRadiusMm !== null,
  );
  if (primary !== null) objects.push(primary);
  const secondary = materializeText(
    context,
    { ...parameters, fontSizeMm: parameters.fontSizeMm * 0.55, arcRadiusMm: null },
    parameters.secondaryText,
    { xMm: center.xMm, yMm: center.yMm - parameters.fontSizeMm * 0.7 },
    detail.id,
    false,
  );
  if (secondary !== null) objects.push(secondary);
  if (parameters.holeDiameterMm > 0) {
    objects.push(...mountingHoles(
      bounds,
      2,
      1,
      parameters.holeDiameterMm,
      parameters.holeInsetMm,
      parameters.heightMm / 2,
      holes.id,
      () => context.createId(),
    ));
  }
  return {
    layers: [backing, detail, holes],
    objects,
    summary: {
      operation: "template",
      objectCount: objects.length,
      layerCount: 3,
      warnings: objects.some((object) => object.type === "text" && object.missingFont)
        ? ["One or more template characters are unavailable in the selected font."]
        : [],
      assumptions: [
        "Template dimensions and mounting-hole positions are stored in millimeters.",
        "Each material layer must be reviewed and exported for the intended fabrication stack.",
      ],
      provenanceIds: [...preset.provenanceIds],
    },
    template: {
      templateVersion: 1,
      stylePresetId: preset.id,
      parameters,
    },
  };
}

export function generateSignToolCandidate(
  request: SignToolRequest,
  context: SignGenerationContext,
): SignGenerationCandidate {
  if (request.kind === "template") return generateTemplate(request, context);
  const generated = layer(context, request.kind === "mounting-holes" ? "Mounting Holes" : "Sign Tools");
  let objects: DocumentObject[];
  const warnings: string[] = [];
  if (request.kind === "border") {
    nonnegative(request.offsetMm, "Border offset");
    positive(request.widthMm, "Border width");
    const normalized = normalizeCutPaths(context.document, context.selectedObjectIds)
      .filter((path) => path.closed)
      .map<EngineContour>((path) => ({ closed: true, points: path.points }));
    if (normalized.length === 0) throw new RangeError("Border generation requires selected closed geometry.");
    const union = defaultGeometryEngine.boolean("union", normalized);
    const inner = request.offsetMm === 0
      ? union
      : defaultGeometryEngine.offset(union.contours, request.offsetMm, request.join);
    const outer = defaultGeometryEngine.offset(
      union.contours,
      request.offsetMm + request.widthMm,
      request.join,
    );
    objects = contoursToPaths(
      [...outer.contours, ...inner.contours],
      generated.id,
      () => context.createId(),
    );
    warnings.push(...union.warnings, ...inner.warnings, ...outer.warnings);
  } else if (request.kind === "backing-plate") {
    const bounds = expanded(selectionBounds(context), request.marginMm);
    objects = [shapeObject(request.shape, bounds, request.cornerRadiusMm, context.createId(), generated.id)];
  } else if (request.kind === "outer-shape") {
    const bounds = centeredBounds(context.document, request.widthMm, request.heightMm);
    objects = [shapeObject(request.shape, bounds, request.cornerRadiusMm, context.createId(), generated.id)];
  } else if (request.kind === "mounting-holes") {
    const bounds = context.selectedObjectIds.length === 0
      ? centeredBounds(context.document, context.document.dimensions.widthMm, context.document.dimensions.heightMm)
      : selectionBounds(context);
    objects = mountingHoles(
      bounds,
      request.columns,
      request.rows,
      request.diameterMm,
      request.insetXmm,
      request.insetYmm,
      generated.id,
      () => context.createId(),
    );
  } else {
    const bounds = selectionBounds(context);
    exactCount(request.count, "Assembly feature count", 20);
    positive(request.widthMm, "Assembly feature width");
    positive(request.depthMm, "Assembly feature depth");
    const horizontal = request.edge === "top" || request.edge === "bottom";
    const span = horizontal ? boundsWidth(bounds) : boundsHeight(bounds);
    if (request.widthMm * request.count > span) {
      throw new RangeError("Assembly features do not fit along the selected edge.");
    }
    objects = Array.from({ length: request.count }, (_, index): RectangleObject => {
      const center = (index + 1) * span / (request.count + 1);
      const outside = request.feature === "tabs";
      const widthMm = horizontal ? request.widthMm : request.depthMm;
      const heightMm = horizontal ? request.depthMm : request.widthMm;
      const xMm = horizontal
        ? bounds.minXmm + center - widthMm / 2
        : request.edge === "right"
          ? bounds.maxXmm - (outside ? 0 : widthMm)
          : bounds.minXmm - (outside ? widthMm : 0);
      const yMm = horizontal
        ? request.edge === "top"
          ? bounds.maxYmm - (outside ? 0 : heightMm)
          : bounds.minYmm - (outside ? heightMm : 0)
        : bounds.minYmm + center - heightMm / 2;
      return {
        id: context.createId(),
        type: "rectangle",
        layerId: generated.id,
        transform: identityTransform(),
        origin: { xMm, yMm },
        widthMm,
        heightMm,
      };
    });
  }
  return {
    layers: [generated],
    objects,
    summary: {
      operation: request.kind,
      objectCount: objects.length,
      layerCount: 1,
      warnings: [...new Set(warnings)],
      assumptions: ["Generated geometry uses document millimeters and remains fully editable."],
      provenanceIds: ["laserx:algorithmic-sign-primitives-v1"],
    },
    template: null,
  };
}

export type { SavedSignTemplate, SignTemplateKind, SignTemplateParameters, SignTemplateShape };
