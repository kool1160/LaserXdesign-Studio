export const COORDINATE_TOLERANCE_MM = 1e-9;
export const AFFINE_DETERMINANT_TOLERANCE = 1e-12;
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

export interface AffineTransformMm {
  a: number;
  b: number;
  c: number;
  d: number;
  eMm: number;
  fMm: number;
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

function normalizeTransformValue(value: number): number {
  if (Math.abs(value) <= COORDINATE_TOLERANCE_MM) {
    return 0;
  }
  if (Math.abs(value - 1) <= COORDINATE_TOLERANCE_MM) {
    return 1;
  }
  if (Math.abs(value + 1) <= COORDINATE_TOLERANCE_MM) {
    return -1;
  }
  return value;
}

export const IDENTITY_AFFINE_TRANSFORM: Readonly<AffineTransformMm> = {
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  eMm: 0,
  fMm: 0,
};

export function copyAffineTransform(
  transform: AffineTransformMm,
): AffineTransformMm {
  return { ...transform };
}

export function composeAffineTransforms(
  parent: AffineTransformMm,
  child: AffineTransformMm,
): AffineTransformMm {
  return {
    a: normalizeTransformValue(parent.a * child.a + parent.c * child.b),
    b: normalizeTransformValue(parent.b * child.a + parent.d * child.b),
    c: normalizeTransformValue(parent.a * child.c + parent.c * child.d),
    d: normalizeTransformValue(parent.b * child.c + parent.d * child.d),
    eMm: normalizeTransformValue(
      parent.a * child.eMm + parent.c * child.fMm + parent.eMm,
    ),
    fMm: normalizeTransformValue(
      parent.b * child.eMm + parent.d * child.fMm + parent.fMm,
    ),
  };
}

export function translationTransform(
  deltaXmm: number,
  deltaYmm: number,
): AffineTransformMm {
  assertFinite(deltaXmm, "Translation X");
  assertFinite(deltaYmm, "Translation Y");
  return {
    ...IDENTITY_AFFINE_TRANSFORM,
    eMm: deltaXmm,
    fMm: deltaYmm,
  };
}

export function scaleTransformAt(
  scaleX: number,
  scaleY: number,
  pivot: PointMm,
): AffineTransformMm {
  assertFinite(scaleX, "Scale X");
  assertFinite(scaleY, "Scale Y");
  if (scaleX === 0 || scaleY === 0) {
    throw new RangeError("Scale factors cannot be zero.");
  }
  return {
    a: scaleX,
    b: 0,
    c: 0,
    d: scaleY,
    eMm: pivot.xMm - pivot.xMm * scaleX,
    fMm: pivot.yMm - pivot.yMm * scaleY,
  };
}

export function rotationTransformAt(
  angleDeg: number,
  pivot: PointMm,
): AffineTransformMm {
  assertFinite(angleDeg, "Rotation angle");
  const radians = (angleDeg * Math.PI) / 180;
  const cosine = normalizeTransformValue(Math.cos(radians));
  const sine = normalizeTransformValue(Math.sin(radians));
  return {
    a: cosine,
    b: sine,
    c: -sine,
    d: cosine,
    eMm: normalizeTransformValue(
      pivot.xMm - cosine * pivot.xMm + sine * pivot.yMm,
    ),
    fMm: normalizeTransformValue(
      pivot.yMm - sine * pivot.xMm - cosine * pivot.yMm,
    ),
  };
}

export function applyAffineTransform(
  point: PointMm,
  transform: AffineTransformMm,
): PointMm {
  return {
    xMm: normalizeTransformValue(
      transform.a * point.xMm +
        transform.c * point.yMm +
        transform.eMm,
    ),
    yMm: normalizeTransformValue(
      transform.b * point.xMm +
        transform.d * point.yMm +
        transform.fMm,
    ),
  };
}

export function invertAffineTransform(
  transform: AffineTransformMm,
): AffineTransformMm {
  const determinant =
    transform.a * transform.d - transform.b * transform.c;
  if (
    !Number.isFinite(determinant) ||
    Math.abs(determinant) <= AFFINE_DETERMINANT_TOLERANCE
  ) {
    throw new RangeError("Affine transform must be invertible.");
  }
  return {
    a: normalizeTransformValue(transform.d / determinant),
    b: normalizeTransformValue(-transform.b / determinant),
    c: normalizeTransformValue(-transform.c / determinant),
    d: normalizeTransformValue(transform.a / determinant),
    eMm: normalizeTransformValue(
      (transform.c * transform.fMm -
        transform.d * transform.eMm) /
        determinant,
    ),
    fMm: normalizeTransformValue(
      (transform.b * transform.eMm -
        transform.a * transform.fMm) /
        determinant,
    ),
  };
}

export function boundsFromPoints(points: readonly PointMm[]): BoundsMm {
  const first = points[0];
  if (first === undefined) {
    throw new RangeError("Bounds require at least one point.");
  }
  return points.slice(1).reduce<BoundsMm>(
    (bounds, point) => ({
      minXmm: Math.min(bounds.minXmm, point.xMm),
      minYmm: Math.min(bounds.minYmm, point.yMm),
      maxXmm: Math.max(bounds.maxXmm, point.xMm),
      maxYmm: Math.max(bounds.maxYmm, point.yMm),
    }),
    {
      minXmm: first.xMm,
      minYmm: first.yMm,
      maxXmm: first.xMm,
      maxYmm: first.yMm,
    },
  );
}

export function transformBounds(
  bounds: BoundsMm,
  transform: AffineTransformMm,
): BoundsMm {
  const corners = [
    applyAffineTransform(
      { xMm: bounds.minXmm, yMm: bounds.minYmm },
      transform,
    ),
    applyAffineTransform(
      { xMm: bounds.minXmm, yMm: bounds.maxYmm },
      transform,
    ),
    applyAffineTransform(
      { xMm: bounds.maxXmm, yMm: bounds.minYmm },
      transform,
    ),
    applyAffineTransform(
      { xMm: bounds.maxXmm, yMm: bounds.maxYmm },
      transform,
    ),
  ];
  return {
    minXmm: Math.min(...corners.map((point) => point.xMm)),
    minYmm: Math.min(...corners.map((point) => point.yMm)),
    maxXmm: Math.max(...corners.map((point) => point.xMm)),
    maxYmm: Math.max(...corners.map((point) => point.yMm)),
  };
}

export function unionBounds(
  first: BoundsMm,
  second: BoundsMm,
): BoundsMm {
  return {
    minXmm: Math.min(first.minXmm, second.minXmm),
    minYmm: Math.min(first.minYmm, second.minYmm),
    maxXmm: Math.max(first.maxXmm, second.maxXmm),
    maxYmm: Math.max(first.maxYmm, second.maxYmm),
  };
}

export function boundsCenter(bounds: BoundsMm): PointMm {
  return {
    xMm: (bounds.minXmm + bounds.maxXmm) / 2,
    yMm: (bounds.minYmm + bounds.maxYmm) / 2,
  };
}

export function boundsWidth(bounds: BoundsMm): number {
  return bounds.maxXmm - bounds.minXmm;
}

export function boundsHeight(bounds: BoundsMm): number {
  return bounds.maxYmm - bounds.minYmm;
}

export function boundsIntersect(
  first: BoundsMm,
  second: BoundsMm,
): boolean {
  return !(
    first.maxXmm < second.minXmm ||
    first.minXmm > second.maxXmm ||
    first.maxYmm < second.minYmm ||
    first.minYmm > second.maxYmm
  );
}

export function boundsContainPoint(
  bounds: BoundsMm,
  point: PointMm,
  toleranceMm = 0,
): boolean {
  return (
    point.xMm >= bounds.minXmm - toleranceMm &&
    point.xMm <= bounds.maxXmm + toleranceMm &&
    point.yMm >= bounds.minYmm - toleranceMm &&
    point.yMm <= bounds.maxYmm + toleranceMm
  );
}

export function distancePointToSegment(
  point: PointMm,
  start: PointMm,
  end: PointMm,
): number {
  const deltaX = end.xMm - start.xMm;
  const deltaY = end.yMm - start.yMm;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  if (lengthSquared === 0) {
    return Math.hypot(point.xMm - start.xMm, point.yMm - start.yMm);
  }
  const ratio = Math.max(
    0,
    Math.min(
      1,
      ((point.xMm - start.xMm) * deltaX +
        (point.yMm - start.yMm) * deltaY) /
        lengthSquared,
    ),
  );
  return Math.hypot(
    point.xMm - (start.xMm + ratio * deltaX),
    point.yMm - (start.yMm + ratio * deltaY),
  );
}

export function pointInPolygon(
  point: PointMm,
  polygon: readonly PointMm[],
): boolean {
  if (polygon.length < 3) {
    return false;
  }
  let inside = false;
  for (
    let currentIndex = 0, previousIndex = polygon.length - 1;
    currentIndex < polygon.length;
    previousIndex = currentIndex, currentIndex += 1
  ) {
    const current = polygon[currentIndex];
    const previous = polygon[previousIndex];
    if (current === undefined || previous === undefined) {
      continue;
    }
    const crosses =
      current.yMm > point.yMm !== previous.yMm > point.yMm &&
      point.xMm <
        ((previous.xMm - current.xMm) *
          (point.yMm - current.yMm)) /
          (previous.yMm - current.yMm) +
          current.xMm;
    if (crosses) {
      inside = !inside;
    }
  }
  return inside;
}

export function pointInCompoundPolygonEvenOdd(
  point: PointMm,
  contours: readonly (readonly PointMm[])[],
): boolean {
  return contours.reduce(
    (inside, contour) =>
      pointInPolygon(point, contour) ? !inside : inside,
    false,
  );
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
