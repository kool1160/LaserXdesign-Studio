export const COORDINATE_TOLERANCE_MM = 1e-9;
export const MIN_ZOOM_CSS_PX_PER_MM = 0.01;
export const MAX_ZOOM_CSS_PX_PER_MM = 100;

export interface PointMm {
  xMm: number;
  yMm: number;
}

export interface BoundsMm {
  minXmm: number;
  minYmm: number;
  maxXmm: number;
  maxYmm: number;
}

export interface ScreenPointCssPx {
  xCssPx: number;
  yCssPx: number;
}

export interface ViewportSizeCssPx {
  widthCssPx: number;
  heightCssPx: number;
  devicePixelRatio: number;
}

export interface ViewportTransform {
  originScreenXCssPx: number;
  originScreenYCssPx: number;
  zoomCssPxPerMm: number;
}

export interface GridLine {
  axis: "x" | "y";
  valueMm: number;
  screenPositionCssPx: number;
}

export interface RulerTick {
  valueMm: number;
  major: boolean;
}

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite.`);
  }
}

function clampZoom(zoomCssPxPerMm: number): number {
  return Math.min(
    MAX_ZOOM_CSS_PX_PER_MM,
    Math.max(MIN_ZOOM_CSS_PX_PER_MM, zoomCssPxPerMm),
  );
}

export function domainToScreen(
  point: PointMm,
  viewport: ViewportTransform,
): ScreenPointCssPx {
  return {
    xCssPx:
      viewport.originScreenXCssPx + point.xMm * viewport.zoomCssPxPerMm,
    yCssPx:
      viewport.originScreenYCssPx - point.yMm * viewport.zoomCssPxPerMm,
  };
}

export function screenToDomain(
  point: ScreenPointCssPx,
  viewport: ViewportTransform,
): PointMm {
  return {
    xMm:
      (point.xCssPx - viewport.originScreenXCssPx) /
      viewport.zoomCssPxPerMm,
    yMm:
      (viewport.originScreenYCssPx - point.yCssPx) /
      viewport.zoomCssPxPerMm,
  };
}

export function panViewport(
  viewport: ViewportTransform,
  deltaScreen: ScreenPointCssPx,
): ViewportTransform {
  assertFinite(deltaScreen.xCssPx, "Pan X");
  assertFinite(deltaScreen.yCssPx, "Pan Y");
  return {
    ...viewport,
    originScreenXCssPx:
      viewport.originScreenXCssPx + deltaScreen.xCssPx,
    originScreenYCssPx:
      viewport.originScreenYCssPx + deltaScreen.yCssPx,
  };
}

export function zoomViewportAt(
  viewport: ViewportTransform,
  pointer: ScreenPointCssPx,
  requestedZoomCssPxPerMm: number,
): ViewportTransform {
  const domainUnderPointer = screenToDomain(pointer, viewport);
  const zoomCssPxPerMm = clampZoom(requestedZoomCssPxPerMm);
  return {
    originScreenXCssPx:
      pointer.xCssPx - domainUnderPointer.xMm * zoomCssPxPerMm,
    originScreenYCssPx:
      pointer.yCssPx + domainUnderPointer.yMm * zoomCssPxPerMm,
    zoomCssPxPerMm,
  };
}

export function fitBoundsToView(
  bounds: BoundsMm,
  viewportSize: ViewportSizeCssPx,
  paddingCssPx = 36,
): ViewportTransform {
  const boundsWidthMm = bounds.maxXmm - bounds.minXmm;
  const boundsHeightMm = bounds.maxYmm - bounds.minYmm;
  if (boundsWidthMm <= 0 || boundsHeightMm <= 0) {
    throw new RangeError("Fit bounds must have positive width and height.");
  }
  const availableWidth = Math.max(
    1,
    viewportSize.widthCssPx - paddingCssPx * 2,
  );
  const availableHeight = Math.max(
    1,
    viewportSize.heightCssPx - paddingCssPx * 2,
  );
  const zoomCssPxPerMm = clampZoom(
    Math.min(
      availableWidth / boundsWidthMm,
      availableHeight / boundsHeightMm,
    ),
  );
  const centerXmm = (bounds.minXmm + bounds.maxXmm) / 2;
  const centerYmm = (bounds.minYmm + bounds.maxYmm) / 2;
  return {
    originScreenXCssPx:
      viewportSize.widthCssPx / 2 - centerXmm * zoomCssPxPerMm,
    originScreenYCssPx:
      viewportSize.heightCssPx / 2 + centerYmm * zoomCssPxPerMm,
    zoomCssPxPerMm,
  };
}

export function resetViewport(
  bounds: BoundsMm,
  viewportSize: ViewportSizeCssPx,
): ViewportTransform {
  const centerXmm = (bounds.minXmm + bounds.maxXmm) / 2;
  const centerYmm = (bounds.minYmm + bounds.maxYmm) / 2;
  return {
    originScreenXCssPx: viewportSize.widthCssPx / 2 - centerXmm,
    originScreenYCssPx: viewportSize.heightCssPx / 2 + centerYmm,
    zoomCssPxPerMm: 1,
  };
}

export function visibleDomainBounds(
  viewport: ViewportTransform,
  viewportSize: ViewportSizeCssPx,
): BoundsMm {
  const topLeft = screenToDomain({ xCssPx: 0, yCssPx: 0 }, viewport);
  const bottomRight = screenToDomain(
    {
      xCssPx: viewportSize.widthCssPx,
      yCssPx: viewportSize.heightCssPx,
    },
    viewport,
  );
  return {
    minXmm: Math.min(topLeft.xMm, bottomRight.xMm),
    minYmm: Math.min(topLeft.yMm, bottomRight.yMm),
    maxXmm: Math.max(topLeft.xMm, bottomRight.xMm),
    maxYmm: Math.max(topLeft.yMm, bottomRight.yMm),
  };
}

export function gridLinesForViewport(
  viewport: ViewportTransform,
  viewportSize: ViewportSizeCssPx,
  spacingMm: number,
  maximumLines = 2_000,
): GridLine[] {
  if (!Number.isFinite(spacingMm) || spacingMm <= 0) {
    throw new RangeError("Grid spacing must be positive and finite.");
  }
  const visible = visibleDomainBounds(viewport, viewportSize);
  const startX = Math.ceil(visible.minXmm / spacingMm);
  const endX = Math.floor(visible.maxXmm / spacingMm);
  const startY = Math.ceil(visible.minYmm / spacingMm);
  const endY = Math.floor(visible.maxYmm / spacingMm);
  const count = endX - startX + 1 + (endY - startY + 1);
  if (count > maximumLines) {
    return [];
  }

  const lines: GridLine[] = [];
  for (let index = startX; index <= endX; index += 1) {
    const valueMm = index * spacingMm;
    lines.push({
      axis: "x",
      valueMm,
      screenPositionCssPx: domainToScreen(
        { xMm: valueMm, yMm: 0 },
        viewport,
      ).xCssPx,
    });
  }
  for (let index = startY; index <= endY; index += 1) {
    const valueMm = index * spacingMm;
    lines.push({
      axis: "y",
      valueMm,
      screenPositionCssPx: domainToScreen(
        { xMm: 0, yMm: valueMm },
        viewport,
      ).yCssPx,
    });
  }
  return lines;
}

export function snapPointToGrid(
  point: PointMm,
  spacingMm: number,
): PointMm {
  if (!Number.isFinite(spacingMm) || spacingMm <= 0) {
    throw new RangeError("Snap spacing must be positive and finite.");
  }
  return {
    xMm: Math.round(point.xMm / spacingMm) * spacingMm,
    yMm: Math.round(point.yMm / spacingMm) * spacingMm,
  };
}

const NICE_STEPS_MM = [
  0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1_000,
] as const;

export function rulerTicks(
  minimumMm: number,
  maximumMm: number,
  zoomCssPxPerMm: number,
  minimumMajorSpacingCssPx = 64,
  majorStepsMm: readonly number[] = NICE_STEPS_MM,
): RulerTick[] {
  const majorStepMm =
    majorStepsMm.find(
      (candidate) => candidate * zoomCssPxPerMm >= minimumMajorSpacingCssPx,
    ) ?? majorStepsMm[majorStepsMm.length - 1] ?? 1_000;
  const minorStepMm = majorStepMm / 5;
  const firstIndex = Math.ceil(minimumMm / minorStepMm);
  const finalIndex = Math.floor(maximumMm / minorStepMm);
  const ticks: RulerTick[] = [];
  for (let index = firstIndex; index <= finalIndex; index += 1) {
    const valueMm = index * minorStepMm;
    const majorRatio = valueMm / majorStepMm;
    ticks.push({
      valueMm,
      major: Math.abs(majorRatio - Math.round(majorRatio)) < 1e-9,
    });
  }
  return ticks;
}
