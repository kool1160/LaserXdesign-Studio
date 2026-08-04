import type { PhysicalPreviewAssembly } from "@laserx/physical-preview-3d";

import { layerZRange, type AssemblyMode } from "./placement.js";

export type PreviewView = "front" | "back" | "edge" | "perspective";

export const PREVIEW_VIEWS: readonly PreviewView[] = [
  "front",
  "back",
  "edge",
  "perspective",
];

export interface CameraPose {
  position: readonly [number, number, number];
  up: readonly [number, number, number];
}

type Vec3 = readonly [number, number, number];

const UP: Vec3 = [0, 1, 0];

/** Perspective offset ratios, normalised below into a unit direction. */
const PERSPECTIVE_OFFSET: Vec3 = [0.7, 0.55, 0.9];

const normalize = (vector: Vec3): Vec3 => {
  const length = Math.hypot(...vector) || 1;
  return [vector[0] / length, vector[1] / length, vector[2] / length];
};

const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/**
 * Unit direction from the target *towards* the camera. Independent of distance,
 * which is what lets the fit solve for distance and then place the camera.
 *
 * Z convention matches the scene contract's assembly Z: higher Z is front-most.
 */
export function viewDirection(view: PreviewView): Vec3 {
  switch (view) {
    case "front":
      return [0, 0, 1];
    case "back":
      return [0, 0, -1];
    case "edge":
      return [1, 0, 0];
    case "perspective":
      return normalize(PERSPECTIVE_OFFSET);
  }
}

export function computeCameraPose(
  view: PreviewView,
  target: Vec3,
  distance: number,
): CameraPose {
  const direction = viewDirection(view);
  return {
    position: [
      target[0] + direction[0] * distance,
      target[1] + direction[1] * distance,
      target[2] + direction[2] * distance,
    ],
    up: UP,
  };
}

/** Axis-aligned world bounds of what the camera must frame. */
export interface PreviewBoundsMm {
  minXmm: number;
  minYmm: number;
  minZmm: number;
  maxXmm: number;
  maxYmm: number;
  maxZmm: number;
}

/**
 * Bounds of the visible physical geometry, falling back to the stock rectangle.
 *
 * Layer `boundsMm` is used rather than the stock alone, because geometry may
 * legitimately extend outside the stock rectangle and must still be framed. When
 * nothing is visible — an empty assembly, or every layer hidden — the stock is a
 * truthful fallback so the camera still shows the work area.
 */
export function visibleBoundsMm(
  assembly: PhysicalPreviewAssembly,
  mode: AssemblyMode,
  visibleLayerIds?: ReadonlySet<string>,
): PreviewBoundsMm {
  const layers = assembly.layers.filter(
    (layer) => visibleLayerIds === undefined || visibleLayerIds.has(layer.layerId),
  );

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  let found = false;

  for (const layer of layers) {
    const zRange = layerZRange(layer, mode);
    // A layer that rendered nothing still occupies declared Z, but contributes
    // no XY geometry — including its null bounds would be inventing extent.
    if (layer.boundsMm !== null) {
      minX = Math.min(minX, layer.boundsMm.minXmm);
      minY = Math.min(minY, layer.boundsMm.minYmm);
      maxX = Math.max(maxX, layer.boundsMm.maxXmm);
      maxY = Math.max(maxY, layer.boundsMm.maxYmm);
      found = true;
    }
    minZ = Math.min(minZ, zRange.minZmm);
    maxZ = Math.max(maxZ, zRange.maxZmm);
  }

  const { widthMm, heightMm } = assembly.stockMm;
  if (!found) {
    minX = 0;
    minY = 0;
    maxX = widthMm;
    maxY = heightMm;
  }
  if (!Number.isFinite(minZ) || !Number.isFinite(maxZ)) {
    minZ = 0;
    maxZ = 0;
  }

  return {
    minXmm: minX,
    minYmm: minY,
    minZmm: minZ,
    maxXmm: maxX,
    maxYmm: maxY,
    maxZmm: maxZ,
  };
}

export interface Viewport {
  widthPx: number;
  heightPx: number;
}

export interface CameraFitOptions {
  view: PreviewView;
  viewport: Viewport;
  /** Vertical field of view in degrees. */
  fovDeg?: number;
  /** Extra clearance in millimetres beyond a tight fit. */
  paddingMm?: number;
  visibleLayerIds?: ReadonlySet<string>;
}

/**
 * A complete, self-describing fit.
 *
 * `fovDeg` and `aspect` are returned rather than assumed, so a consumer cannot
 * silently pair this distance with a different projection and clip the model.
 */
export interface CameraFit {
  view: PreviewView;
  target: Vec3;
  position: Vec3;
  distance: number;
  fovDeg: number;
  aspect: number;
  near: number;
  far: number;
  boundsMm: PreviewBoundsMm;
}

export const DEFAULT_FOV_DEG = 45;
export const DEFAULT_PADDING_MM = 20;
const MINIMUM_EXTENT_MM = 1;

/**
 * Solves for the camera distance that provably frames `boundsMm`.
 *
 * The box's half-extent is projected onto the camera's right/up/forward axes —
 * exact for an axis-aligned box under any view direction — and the distance is
 * the larger of the vertical and horizontal requirements plus the box's own
 * depth along the view axis. Because the horizontal requirement divides by
 * `tan(fov/2) * aspect`, a narrow viewport correctly pushes the camera back
 * instead of clipping.
 */
export function computeCameraFit(
  assembly: PhysicalPreviewAssembly,
  mode: AssemblyMode,
  options: CameraFitOptions,
): CameraFit {
  const {
    view,
    viewport,
    fovDeg = DEFAULT_FOV_DEG,
    paddingMm = DEFAULT_PADDING_MM,
    visibleLayerIds,
  } = options;

  const boundsMm = visibleBoundsMm(assembly, mode, visibleLayerIds);
  const target: Vec3 = [
    (boundsMm.minXmm + boundsMm.maxXmm) / 2,
    (boundsMm.minYmm + boundsMm.maxYmm) / 2,
    (boundsMm.minZmm + boundsMm.maxZmm) / 2,
  ];

  // A degenerate box (zero-sized stock, or a single flat layer seen edge-on)
  // must still yield a usable camera rather than a zero distance.
  const half: Vec3 = [
    Math.max((boundsMm.maxXmm - boundsMm.minXmm) / 2, MINIMUM_EXTENT_MM / 2),
    Math.max((boundsMm.maxYmm - boundsMm.minYmm) / 2, MINIMUM_EXTENT_MM / 2),
    Math.max((boundsMm.maxZmm - boundsMm.minZmm) / 2, MINIMUM_EXTENT_MM / 2),
  ];

  const forward = viewDirection(view);
  // `up` is ±Y for every approved view, so this cross product is always stable.
  const right = normalize(cross(UP, forward));
  const up = normalize(cross(forward, right));

  const project = (axis: Vec3): number =>
    Math.abs(half[0] * axis[0]) + Math.abs(half[1] * axis[1]) + Math.abs(half[2] * axis[2]);

  const halfWidth = project(right);
  const halfHeight = project(up);
  const halfDepth = project(forward);

  const aspect = viewport.widthPx > 0 && viewport.heightPx > 0
    ? viewport.widthPx / viewport.heightPx
    : 1;
  const tanVertical = Math.tan((fovDeg * Math.PI) / 360);
  const tanHorizontal = tanVertical * aspect;

  const distance =
    Math.max(halfHeight / tanVertical, halfWidth / tanHorizontal) + halfDepth + paddingMm;

  const position: Vec3 = [
    target[0] + forward[0] * distance,
    target[1] + forward[1] * distance,
    target[2] + forward[2] * distance,
  ];

  // Near must stay ahead of the box's closest corner without going non-positive.
  const near = Math.max(0.1, Math.min(1, (distance - halfDepth) / 2));
  const far = distance + halfDepth * 2 + paddingMm * 2;

  return { view, target, position, distance, fovDeg, aspect, near, far, boundsMm };
}
