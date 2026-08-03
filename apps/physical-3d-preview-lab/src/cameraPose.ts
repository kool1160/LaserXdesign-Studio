export type PreviewView = "front" | "back" | "edge" | "perspective";

export const PREVIEW_VIEWS: readonly PreviewView[] = ["front", "back", "edge", "perspective"];

export interface CameraPose {
  position: readonly [number, number, number];
  up: readonly [number, number, number];
}

const UP: readonly [number, number, number] = [0, 1, 0];

/** Perspective offset ratios relative to `distance`, chosen for a clear 3/4 angled view. */
const PERSPECTIVE_OFFSET = { x: 0.7, y: 0.55, z: 0.9 } as const;

/**
 * Pure, deterministic camera pose calculation — no React, no Three.js scene
 * graph, no DOM. Kept outside `CameraRig` so pose math is unit-testable
 * without mounting a renderer. Z convention matches
 * `@laserx/physical-preview-3d`'s assembly Z: higher Z is front-most.
 *
 * - `front`: straight on, viewing the +Z (front-most layer) face.
 * - `back`: straight on from the opposite side, viewing the -Z face.
 * - `edge`: from the side (+X), showing the stack thickness/cross-section.
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
