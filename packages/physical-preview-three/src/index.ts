/**
 * `@laserx/physical-preview-three`
 *
 * Pure, deterministic Three.js adapter over the accepted
 * `@laserx/physical-preview-3d` scene contract.
 *
 * Boundary (ADR 0024 §2): depends only on `three` and the pure scene package.
 * No React, no React Three Fiber, no Electron, no DOM orchestration, no
 * filesystem access, and no material catalog. Every module here is unit-testable
 * in Node without a WebGL context.
 */

export {
  buildAssemblyGeometries,
  buildLayerGeometries,
  disposeAssemblyGeometries,
  disposeLayerGeometries,
  type AssemblyLayerGeometry,
  type LayerShapeGeometry,
} from "./geometry.js";

export {
  assemblyPlacements,
  assemblyZExtent,
  layerZRange,
  type AssemblyMode,
  type LayerPlacement,
} from "./placement.js";

export {
  computeCameraFit,
  computeCameraPose,
  PREVIEW_VIEWS,
  type CameraFit,
  type CameraPose,
  type PreviewView,
} from "./camera.js";

export {
  createLayerMaterial,
  disposeMaterials,
  layerAppearance,
  materialAppearance,
  NEUTRAL_FALLBACK_APPEARANCE,
  type MaterialAppearance,
} from "./material.js";

export {
  buildCaptureFilename,
  readPngHeader,
  validatePngCapture,
  type CaptureFailure,
  type CaptureFilenameInput,
  type CaptureResult,
  type CaptureSuccess,
  type CapturableCanvas,
  type PngHeader,
} from "./capture.js";

export { buildPreviewResources, type PreviewResources } from "./resources.js";
