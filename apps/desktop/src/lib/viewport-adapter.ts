import {
  fromMillimeters,
  getDocumentBounds,
  toMillimeters,
  type DisplayUnit,
  type DocumentObject,
  type LaserxDocument,
  type PointMm,
} from "@laserx/domain";
import {
  domainToScreen,
  fitBoundsToView,
  gridLinesForViewport,
  resetViewport,
  rulerTicks,
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

export type ObjectPrimitive =
  | {
      id: string;
      type: "line";
      start: ScreenPointCssPx;
      end: ScreenPointCssPx;
    }
  | {
      id: string;
      type: "rectangle";
      xCssPx: number;
      yCssPx: number;
      widthCssPx: number;
      heightCssPx: number;
    }
  | {
      id: string;
      type: "ellipse";
      center: ScreenPointCssPx;
      radiusXCssPx: number;
      radiusYCssPx: number;
    }
  | {
      id: string;
      type: "path";
      closed: boolean;
      points: ScreenPointCssPx[];
    };

export interface PositionedRulerTick extends RulerTick {
  screenPositionCssPx: number;
  label: string;
}

export interface ViewportScene {
  stock: StockPrimitive;
  objects: ObjectPrimitive[];
  gridLines: GridLine[];
  horizontalTicks: PositionedRulerTick[];
  verticalTicks: PositionedRulerTick[];
}

const INCH_RULER_STEPS_MM = [
  3.175, 6.35, 12.7, 25.4, 50.8, 127, 254, 508, 1_270,
] as const;

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
  return `${trimNumber(fromMillimeters(document.dimensions.widthMm, unit), decimals)} × ${trimNumber(fromMillimeters(document.dimensions.heightMm, unit), decimals)} ${suffix}`;
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

function objectToPrimitive(
  object: DocumentObject,
  viewport: ViewportTransform,
): ObjectPrimitive {
  switch (object.type) {
    case "line":
      return {
        id: object.id,
        type: "line",
        start: domainToScreen(object.start, viewport),
        end: domainToScreen(object.end, viewport),
      };
    case "rectangle": {
      const topLeft = domainToScreen(
        {
          xMm: object.origin.xMm,
          yMm: object.origin.yMm + object.heightMm,
        },
        viewport,
      );
      return {
        id: object.id,
        type: "rectangle",
        ...topLeft,
        widthCssPx: object.widthMm * viewport.zoomCssPxPerMm,
        heightCssPx: object.heightMm * viewport.zoomCssPxPerMm,
      };
    }
    case "ellipse":
      return {
        id: object.id,
        type: "ellipse",
        center: domainToScreen(object.center, viewport),
        radiusXCssPx: object.radiusXmm * viewport.zoomCssPxPerMm,
        radiusYCssPx: object.radiusYmm * viewport.zoomCssPxPerMm,
      };
    case "path":
      return {
        id: object.id,
        type: "path",
        closed: object.closed,
        points: object.points.map((point) =>
          domainToScreen(point, viewport),
        ),
      };
  }
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

export function createViewportScene(
  document: LaserxDocument,
  viewport: ViewportTransform,
  size: ViewportSizeCssPx,
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
    objects: document.objects.map((object) =>
      objectToPrimitive(object, viewport),
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
