import type { PhysicalPreviewAssembly } from "@laserx/physical-preview-3d";

import { assemblyZExtent, type AssemblyMode } from "./placement.js";

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

const UP: readonly [number, number, number] = [0, 1, 0];

/** Perspective offset ratios relative to `distance`, for a clear 3/4 view. */
const PERSPECTIVE_OFFSET = { x: 0.7, y: 0.55, z: 0.9 } as const;

/**
 * Pure, deterministic camera pose — no Three scene graph, no DOM, no React, so
 * pose math is unit-testable without mounting a renderer. The Z convention
 * matches the scene contract's assembly Z: higher Z is front-most.
 *
 * - `front`: straight on, viewing the +Z (front-most layer) face;
 * - `back`: straight on from the opposite side, viewing the -Z face;
 * - `edge`: from +X, showing stack thickness;
 * - `perspective`: an angled 3/4 view combining all three axes.
 */
export function computeCameraPose(
  view: PreviewView,
  target: readonly [number, number, number],
  distance: number,
): CameraPose {
  const [tx, ty, tz] = target;
  switch (view) {
    case "front":
      return { position: [tx, ty, tz + distance], up: UP };
    case "back":
      return { position: [tx, ty, tz - distance], up: UP };
    case "edge":
      return { position: [tx + distance, ty, tz], up: UP };
    case "perspective":
      return {
        position: [
          tx + distance * PERSPECTIVE_OFFSET.x,
          ty + distance * PERSPECTIVE_OFFSET.y,
          tz + distance * PERSPECTIVE_OFFSET.z,
        ],
        up: UP,
      };
  }
}

/** Framing derived from the assembly's own stock and Z extent. */
export interface CameraFit {
  target: readonly [number, number, number];
  distance: number;
  near: number;
  far: number;
}

const FIT_DIAGONAL_SCALE = 1.6;
const FIT_PADDING_MM = 40;
const NEAR_PLANE = 1;
const FAR_PLANE_SCALE = 20;

/**
 * Deterministic fit for empty, single-layer, and multi-layer assemblies.
 *
 * A document with no physical layers still yields a finite, usable camera: the
 * stock rectangle alone frames it, and the zero Z extent contributes nothing.
 * `Math.hypot(...) || 1` guards the fully degenerate case (zero-sized stock and
 * no layers) so `distance` is never `0` and `far` is never `0`.
 */
export function computeCameraFit(
  assembly: PhysicalPreviewAssembly,
  mode: AssemblyMode,
  visibleLayerIds?: ReadonlySet<string>,
): CameraFit {
  const { widthMm, heightMm } = assembly.stockMm;
  const zExtent = assemblyZExtent(assembly, mode, visibleLayerIds);
  const zSpanMm = zExtent.maxZmm - zExtent.minZmm;

  const diagonal = Math.hypot(widthMm, heightMm, zSpanMm) || 1;
  const distance = diagonal * FIT_DIAGONAL_SCALE + FIT_PADDING_MM;

  return {
    target: [widthMm / 2, heightMm / 2, zExtent.minZmm + zSpanMm / 2],
    distance,
    near: NEAR_PLANE,
    far: distance * FAR_PLANE_SCALE,
  };
}
