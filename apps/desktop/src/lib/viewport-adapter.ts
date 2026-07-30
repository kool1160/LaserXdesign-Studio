import type { EditorActionRequest } from "@laserx/application";
import {
  coordinateToMillimeters,
  fromMillimeters,
  getDocumentBounds,
  getObjectsInRenderOrder,
  getSelectionBounds,
  nonnegativeLengthToMillimeters,
  toMillimeters,
  type AffineTransformMm,
  type BoundsMm,
  type DisplayUnit,
  type DocumentObject,
  type LaserxDocument,
  type PointMm,
} from "@laserx/domain";
import {
  IDENTITY_AFFINE_TRANSFORM,
  applyAffineTransform,
  boundsCenter,
  composeAffineTransforms,
  domainToScreen,
  fitBoundsToView,
  gridLinesForViewport,
  resetViewport,
  rulerTicks,
  screenToDomain,
  visibleDomainBounds,
  zoomViewportAt,
  type GridLine,
  type RulerTick,
  type ScreenPointCssPx,
  type ViewportSizeCssPx,
  type ViewportTransform,
} from "@laserx/geometry";

export interface StockPrimitive {
  xCssPx: number;
  yCssPx: number;
  widthCssPx: number;
  heightCssPx: number;
}

export interface ObjectPrimitive {
  key: string;
  objectId: string;
  sourceId: string;
  closed: boolean;
  points: ScreenPointCssPx[];
}

export interface GuidePrimitive {
  id: string;
  axis: "x" | "y";
  screenPositionCssPx: number;
}

export type TransformHandleKind =
  | "north-west"
  | "north"
  | "north-east"
  | "east"
  | "south-east"
  | "south"
  | "south-west"
  | "west"
  | "rotate";

export interface TransformHandlePrimitive {
  kind: TransformHandleKind;
  point: ScreenPointCssPx;
}

export interface SelectionPrimitive {
  bounds: StockPrimitive;
  handles: TransformHandlePrimitive[];
}

export interface PositionedRulerTick extends RulerTick {
  screenPositionCssPx: number;
  label: string;
}

export interface ViewportScene {
  stock: StockPrimitive;
  objects: ObjectPrimitive[];
  guides: GuidePrimitive[];
  selection: SelectionPrimitive | null;
  gridLines: GridLine[];
  horizontalTicks: PositionedRulerTick[];
  verticalTicks: PositionedRulerTick[];
}

const INCH_RULER_STEPS_MM = [
  3.175, 6.35, 12.7, 25.4, 50.8, 127, 254, 508, 1_270,
] as const;
const ELLIPSE_SEGMENTS = 48;

function trimNumber(value: number, decimals: number): string {
  return value
    .toFixed(decimals)
    .replace(/\.0+$/u, "")
    .replace(/(\.\d*?)0+$/u, "$1");
}

export function formatLength(valueMm: number, unit: DisplayUnit): string {
  const value = fromMillimeters(valueMm, unit);
  return `${trimNumber(value, unit === "inches" ? 3 : 2)} ${unit === "inches" ? "in" : "mm"}`;
}

export function formatCoordinate(
  point: PointMm,
  unit: DisplayUnit,
): string {
  const suffix = unit === "inches" ? "in" : "mm";
  const decimals = unit === "inches" ? 3 : 2;
  return `X ${trimNumber(fromMillimeters(point.xMm, unit), decimals)}  Y ${trimNumber(fromMillimeters(point.yMm, unit), decimals)} ${suffix}`;
}

export function formatDimensions(document: LaserxDocument): string {
  const unit = document.settings.displayUnit;
  const decimals = unit === "inches" ? 3 : 2;
  const suffix = unit === "inches" ? "in" : "mm";
  const width = trimNumber(
    fromMillimeters(document.dimensions.widthMm, unit),
    decimals,
  );
  const height = trimNumber(
    fromMillimeters(document.dimensions.heightMm, unit),
    decimals,
  );
  return `${width} × ${height} ${suffix}`;
}

export function gridSpacingForDisplay(document: LaserxDocument): number {
  return fromMillimeters(
    document.settings.viewport.gridSpacingMm,
    document.settings.displayUnit,
  );
}

export function gridSpacingToMillimeters(
  value: number,
  unit: DisplayUnit,
): number {
  return toMillimeters(value, unit);
}

export function displayScalar(
  valueMm: number,
  unit: DisplayUnit,
): string {
  return String(Number(fromMillimeters(valueMm, unit).toFixed(4)));
}

export function selectionBoundsForDisplay(
  bounds: BoundsMm,
  unit: DisplayUnit,
): { x: string; y: string; width: string; height: string } {
  return {
    x: displayScalar(bounds.minXmm, unit),
    y: displayScalar(bounds.minYmm, unit),
    width: displayScalar(bounds.maxXmm - bounds.minXmm, unit),
    height: displayScalar(bounds.maxYmm - bounds.minYmm, unit),
  };
}

export function exactBoundsCommand(
  objectIds: readonly string[],
  values: {
    x: string;
    y: string;
    width: string;
    height: string;
  },
  unit: DisplayUnit,
  lockAspectRatio: boolean,
): EditorActionRequest | null {
  const parsed = Object.fromEntries(
    Object.entries(values).map(([name, value]) => [
      name,
      value.trim().length === 0 ? Number.NaN : Number(value),
    ]),
  ) as Record<keyof typeof values, number>;
  let converted: {
    xMm: number;
    yMm: number;
    widthMm: number;
    heightMm: number;
  };
  try {
    converted = {
      xMm: coordinateToMillimeters(parsed.x, unit),
      yMm: coordinateToMillimeters(parsed.y, unit),
      widthMm: nonnegativeLengthToMillimeters(parsed.width, unit),
      heightMm: nonnegativeLengthToMillimeters(parsed.height, unit),
    };
  } catch {
    return null;
  }
  if (
    objectIds.length === 0 ||
    !Object.values(converted).every(Number.isFinite)
  ) {
    return null;
  }
  return {
    type: "objects.set-bounds",
    objectIds: [...objectIds],
    ...converted,
    lockAspectRatio,
  };
}

export function rotateSelectionCommand(
  objectIds: readonly string[],
  selectionBounds: BoundsMm | null,
  angleText: string,
): EditorActionRequest | null {
  const angleDeg = Number(angleText);
  if (
    objectIds.length === 0 ||
    selectionBounds === null ||
    !Number.isFinite(angleDeg)
  ) {
    return null;
  }
  return {
    type: "objects.rotate",
    objectIds: [...objectIds],
    angleDeg,
    pivot: boundsCenter(selectionBounds),
  };
}

export function mirrorSelectionCommand(
  objectIds: readonly string[],
  selectionBounds: BoundsMm | null,
  axis: "horizontal" | "vertical",
): EditorActionRequest | null {
  if (objectIds.length === 0 || selectionBounds === null) {
    return null;
  }
  return {
    type: "objects.mirror",
    objectIds: [...objectIds],
    axis,
    pivot: boundsCenter(selectionBounds),
  };
}

export function centerGuideCommand(
  document: LaserxDocument,
  axis: "x" | "y",
): EditorActionRequest {
  return {
    type: "guide.create",
    axis,
    positionMm:
      axis === "x"
        ? document.dimensions.widthMm / 2
        : document.dimensions.heightMm / 2,
  };
}

export function fitDocumentToView(
  document: LaserxDocument,
  size: ViewportSizeCssPx,
): ViewportTransform {
  return fitBoundsToView(getDocumentBounds(document), size, 56);
}

export function zoomFromWheel(
  viewport: ViewportTransform,
  pointer: ScreenPointCssPx,
  deltaY: number,
): ViewportTransform {
  const factor = Math.exp(-deltaY * 0.0015);
  return zoomViewportAt(
    viewport,
    pointer,
    viewport.zoomCssPxPerMm * factor,
  );
}

export function zoomAtViewportCenter(
  viewport: ViewportTransform,
  size: ViewportSizeCssPx,
  factor: number,
): ViewportTransform {
  return zoomViewportAt(
    viewport,
    {
      xCssPx: size.widthCssPx / 2,
      yCssPx: size.heightCssPx / 2,
    },
    viewport.zoomCssPxPerMm * factor,
  );
}

export function resetDocumentView(
  document: LaserxDocument,
  size: ViewportSizeCssPx,
): ViewportTransform {
  return resetViewport(getDocumentBounds(document), size);
}

function primitiveDomainPoints(
  object: Exclude<DocumentObject, { type: "group" }>,
): { points: PointMm[]; closed: boolean } {
  switch (object.type) {
    case "line":
      return { points: [object.start, object.end], closed: false };
    case "rectangle":
      return {
        closed: true,
        points: [
          object.origin,
          {
            xMm: object.origin.xMm + object.widthMm,
            yMm: object.origin.yMm,
          },
          {
            xMm: object.origin.xMm + object.widthMm,
            yMm: object.origin.yMm + object.heightMm,
          },
          {
            xMm: object.origin.xMm,
            yMm: object.origin.yMm + object.heightMm,
          },
        ],
      };
    case "ellipse":
      return {
        closed: true,
        points: Array.from({ length: ELLIPSE_SEGMENTS }, (_value, index) => {
          const angle = (index / ELLIPSE_SEGMENTS) * Math.PI * 2;
          return {
            xMm: object.center.xMm + Math.cos(angle) * object.radiusXmm,
            yMm: object.center.yMm + Math.sin(angle) * object.radiusYmm,
          };
        }),
      };
    case "path":
      return { points: object.points, closed: object.closed };
  }
}

function objectPrimitives(
  object: DocumentObject,
  viewport: ViewportTransform,
  parentTransform: AffineTransformMm,
  selectionId: string,
): ObjectPrimitive[] {
  const worldTransform = composeAffineTransforms(
    parentTransform,
    object.transform,
  );
  if (object.type === "group") {
    return object.children.flatMap((child) =>
      objectPrimitives(child, viewport, worldTransform, selectionId),
    );
  }
  const primitive = primitiveDomainPoints(object);
  return [
    {
      key: `${selectionId}:${object.id}`,
      objectId: selectionId,
      sourceId: object.id,
      closed: primitive.closed,
      points: primitive.points.map((point) =>
        domainToScreen(
          applyAffineTransform(point, worldTransform),
          viewport,
        ),
      ),
    },
  ];
}

function positionTicks(
  ticks: RulerTick[],
  axis: "x" | "y",
  viewport: ViewportTransform,
  unit: DisplayUnit,
): PositionedRulerTick[] {
  return ticks.map((tick) => {
    const point = domainToScreen(
      axis === "x"
        ? { xMm: tick.valueMm, yMm: 0 }
        : { xMm: 0, yMm: tick.valueMm },
      viewport,
    );
    return {
      ...tick,
      screenPositionCssPx:
        axis === "x" ? point.xCssPx : point.yCssPx,
      label: trimNumber(
        fromMillimeters(tick.valueMm, unit),
        unit === "inches" ? 2 : 1,
      ),
    };
  });
}

function selectionPrimitive(
  selectionBounds: BoundsMm | null,
  viewport: ViewportTransform,
): SelectionPrimitive | null {
  if (selectionBounds === null) {
    return null;
  }
  const topLeft = domainToScreen(
    { xMm: selectionBounds.minXmm, yMm: selectionBounds.maxYmm },
    viewport,
  );
  const bottomRight = domainToScreen(
    { xMm: selectionBounds.maxXmm, yMm: selectionBounds.minYmm },
    viewport,
  );
  const centerX = (topLeft.xCssPx + bottomRight.xCssPx) / 2;
  const centerY = (topLeft.yCssPx + bottomRight.yCssPx) / 2;
  const handles: TransformHandlePrimitive[] = [
    { kind: "north-west", point: topLeft },
    { kind: "north", point: { xCssPx: centerX, yCssPx: topLeft.yCssPx } },
    {
      kind: "north-east",
      point: { xCssPx: bottomRight.xCssPx, yCssPx: topLeft.yCssPx },
    },
    {
      kind: "east",
      point: { xCssPx: bottomRight.xCssPx, yCssPx: centerY },
    },
    { kind: "south-east", point: bottomRight },
    {
      kind: "south",
      point: { xCssPx: centerX, yCssPx: bottomRight.yCssPx },
    },
    {
      kind: "south-west",
      point: { xCssPx: topLeft.xCssPx, yCssPx: bottomRight.yCssPx },
    },
    {
      kind: "west",
      point: { xCssPx: topLeft.xCssPx, yCssPx: centerY },
    },
    {
      kind: "rotate",
      point: { xCssPx: centerX, yCssPx: topLeft.yCssPx - 28 },
    },
  ];
  return {
    bounds: {
      xCssPx: topLeft.xCssPx,
      yCssPx: topLeft.yCssPx,
      widthCssPx: bottomRight.xCssPx - topLeft.xCssPx,
      heightCssPx: bottomRight.yCssPx - topLeft.yCssPx,
    },
    handles,
  };
}

export function createViewportScene(
  document: LaserxDocument,
  viewport: ViewportTransform,
  size: ViewportSizeCssPx,
  selectionIds: readonly string[] = [],
): ViewportScene {
  const origin = domainToScreen(
    {
      xMm: document.origin.xMm,
      yMm: document.origin.yMm + document.dimensions.heightMm,
    },
    viewport,
  );
  const visible = visibleDomainBounds(viewport, size);
  const xTicks = rulerTicks(
    visible.minXmm,
    visible.maxXmm,
    viewport.zoomCssPxPerMm,
    64,
    document.settings.displayUnit === "inches"
      ? INCH_RULER_STEPS_MM
      : undefined,
  );
  const yTicks = rulerTicks(
    visible.minYmm,
    visible.maxYmm,
    viewport.zoomCssPxPerMm,
    64,
    document.settings.displayUnit === "inches"
      ? INCH_RULER_STEPS_MM
      : undefined,
  );
  return {
    stock: {
      ...origin,
      widthCssPx: document.dimensions.widthMm * viewport.zoomCssPxPerMm,
      heightCssPx:
        document.dimensions.heightMm * viewport.zoomCssPxPerMm,
    },
    objects: getObjectsInRenderOrder(document).flatMap((object) =>
      objectPrimitives(
        object,
        viewport,
        IDENTITY_AFFINE_TRANSFORM,
        object.id,
      ),
    ),
    guides: document.guides.map((guide) => ({
      ...guide,
      screenPositionCssPx:
        guide.axis === "x"
          ? domainToScreen(
              { xMm: guide.positionMm, yMm: 0 },
              viewport,
            ).xCssPx
          : domainToScreen(
              { xMm: 0, yMm: guide.positionMm },
              viewport,
            ).yCssPx,
    })),
    selection: selectionPrimitive(
      getSelectionBounds(document, selectionIds),
      viewport,
    ),
    gridLines: document.settings.viewport.gridVisible
      ? gridLinesForViewport(
          viewport,
          size,
          document.settings.viewport.gridSpacingMm,
        )
      : [],
    horizontalTicks: positionTicks(
      xTicks,
      "x",
      viewport,
      document.settings.displayUnit,
    ),
    verticalTicks: positionTicks(
      yTicks,
      "y",
      viewport,
      document.settings.displayUnit,
    ),
  };
}

export function createMoveCommand(
  objectIds: readonly string[],
  deltaXmm: number,
  deltaYmm: number,
  snapToleranceMm?: number,
): EditorActionRequest {
  return {
    type: "objects.move",
    objectIds: [...objectIds],
    deltaXmm,
    deltaYmm,
    ...(snapToleranceMm === undefined ? {} : { snapToleranceMm }),
  };
}

export function pointerMoveCommand(
  objectIds: readonly string[],
  start: ScreenPointCssPx,
  end: ScreenPointCssPx,
  viewport: ViewportTransform,
  snapToleranceCssPx = 8,
): EditorActionRequest {
  const startDomain = screenToDomain(start, viewport);
  const endDomain = screenToDomain(end, viewport);
  return createMoveCommand(
    objectIds,
    endDomain.xMm - startDomain.xMm,
    endDomain.yMm - startDomain.yMm,
    snapToleranceCssPx / viewport.zoomCssPxPerMm,
  );
}

export function keyboardMoveCommand(
  objectIds: readonly string[],
  deltaXmm: number,
  deltaYmm: number,
): EditorActionRequest {
  return createMoveCommand(objectIds, deltaXmm, deltaYmm);
}

export function marqueeCommand(
  start: ScreenPointCssPx,
  end: ScreenPointCssPx,
  viewport: ViewportTransform,
  mode: "replace" | "add" | "toggle",
): EditorActionRequest {
  const first = screenToDomain(start, viewport);
  const second = screenToDomain(end, viewport);
  return {
    type: "selection.marquee",
    bounds: {
      minXmm: Math.min(first.xMm, second.xMm),
      minYmm: Math.min(first.yMm, second.yMm),
      maxXmm: Math.max(first.xMm, second.xMm),
      maxYmm: Math.max(first.yMm, second.yMm),
    },
    mode,
  };
}

export function scaleCommandForHandle(
  objectIds: readonly string[],
  selectionBounds: BoundsMm,
  handle: TransformHandleKind,
  pointer: PointMm,
  lockAspectRatio: boolean,
): EditorActionRequest | null {
  if (handle === "rotate") {
    return null;
  }
  const center = boundsCenter(selectionBounds);
  const west = handle.includes("west");
  const east = handle.includes("east");
  const north = handle.includes("north");
  const south = handle.includes("south");
  const pivot = {
    xMm: west
      ? selectionBounds.maxXmm
      : east
        ? selectionBounds.minXmm
        : center.xMm,
    yMm: north
      ? selectionBounds.minYmm
      : south
        ? selectionBounds.maxYmm
        : center.yMm,
  };
  const originalX =
    (west ? selectionBounds.minXmm : east ? selectionBounds.maxXmm : center.xMm) -
    pivot.xMm;
  const originalY =
    (north
      ? selectionBounds.maxYmm
      : south
        ? selectionBounds.minYmm
        : center.yMm) - pivot.yMm;
  let scaleX = originalX === 0 ? 1 : (pointer.xMm - pivot.xMm) / originalX;
  let scaleY = originalY === 0 ? 1 : (pointer.yMm - pivot.yMm) / originalY;
  if (lockAspectRatio) {
    const dominant =
      Math.abs(scaleX - 1) >= Math.abs(scaleY - 1) ? scaleX : scaleY;
    if (originalX !== 0) {
      scaleX = dominant;
    }
    if (originalY !== 0) {
      scaleY = dominant;
    }
  }
  if (Math.abs(scaleX) < 0.001 || Math.abs(scaleY) < 0.001) {
    return null;
  }
  return {
    type: "objects.scale",
    objectIds: [...objectIds],
    scaleX,
    scaleY,
    pivot,
  };
}

export function rotateCommandFromPointer(
  objectIds: readonly string[],
  selectionBounds: BoundsMm,
  start: PointMm,
  end: PointMm,
): EditorActionRequest {
  const pivot = boundsCenter(selectionBounds);
  const startAngle = Math.atan2(
    start.yMm - pivot.yMm,
    start.xMm - pivot.xMm,
  );
  const endAngle = Math.atan2(end.yMm - pivot.yMm, end.xMm - pivot.xMm);
  return {
    type: "objects.rotate",
    objectIds: [...objectIds],
    angleDeg: ((endAngle - startAngle) * 180) / Math.PI,
    pivot,
  };
}
