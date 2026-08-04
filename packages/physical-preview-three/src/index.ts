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
  PreviewConversionError,
  RENDERED_MM_TOLERANCE,
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
  DEFAULT_FOV_DEG,
  DEFAULT_PADDING_MM,
  PREVIEW_VIEWS,
  viewDirection,
  visibleBoundsMm,
  type CameraFit,
  type CameraFitOptions,
  type CameraPose,
  type PreviewBoundsMm,
  type PreviewView,
  type Viewport,
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
  analyzePixelContent,
  buildCaptureFilename,
  DEFAULT_BACKGROUND_TOLERANCE,
  readPngHeader,
  validatePngCapture,
  type BackgroundColor,
  type CaptureContentInput,
  type CaptureFailure,
  type CaptureFilenameInput,
  type CaptureResult,
  type CaptureStructureOnly,
  type CaptureVerified,
  type CapturableCanvas,
  type PixelContentEvidence,
  type PngHeader,
} from "./capture.js";

export { buildPreviewResources, type PreviewResources } from "./resources.js";
