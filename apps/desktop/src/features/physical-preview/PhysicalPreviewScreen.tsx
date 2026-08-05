import type { PhysicalPreviewAssembly } from "@laserx/physical-preview-3d";
import {
  buildAssemblyGeometries,
  buildCaptureFilename,
  computeCameraFit,
  disposeAssemblyGeometries,
  layerAppearance,
  PREVIEW_VIEWS,
  PREVIEW_CAPTURE_BACKGROUND,
  PREVIEW_CAPTURE_BACKGROUND_HEX,
  PreviewConversionError,
  validatePngCapture,
  type AssemblyLayerGeometry,
  type AssemblyMode,
  type PreviewView,
} from "@laserx/physical-preview-three";
import { Canvas, useThree } from "@react-three/fiber";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type Ref,
} from "react";

import { CameraRig, type CameraRigHandle } from "./CameraRig.js";
import { CaptureRig, type CaptureRigHandle } from "./CaptureRig.js";
import { decodeCaptureDataUrl, type SameFrameCapture } from "./sameFrameCapture.js";
import { useWebglContextLossState } from "./useWebglContextLossState.js";
import { isWebglAvailable } from "./webgl.js";

const VIEW_LABELS: Record<PreviewView, string> = {
  front: "Front",
  back: "Back",
  edge: "Edge",
  perspective: "Perspective",
};

/** Bounded to [1, 2]: crisp on standard/retina displays without paying full
 * native resolution on very-high-DPR devices. */
const DPR_RANGE: [number, number] = [1, 2];

const KEYBOARD_ROTATE_STEP_RAD = (5 * Math.PI) / 180;
const KEYBOARD_PAN_STEP_PX = 20;
/**
 * Passed directly to `OrbitControls.dollyIn`/`dollyOut`. Despite the method
 * names reading like a direction, the scale factor itself must be *below* 1
 * for `dollyIn` to move the camera closer (matching the real mouse-wheel
 * handler's own `_getZoomScale`, which always returns `Math.pow(0.95, ...)`,
 * a fraction). A factor above 1 inverts both methods: `dollyIn(1.1)` moves
 * the camera farther away, not closer. Exported so the regression test
 * exercises this exact constant against real OrbitControls math rather than
 * a value that could silently drift out of sync.
 */
export const KEYBOARD_ZOOM_SCALE = 0.9;

export interface PhysicalPreviewScreenProps {
  assembly: PhysicalPreviewAssembly;
  onClose: () => void;
  /**
   * Hands validated capture bytes to the privileged save path (G5). The
   * screen itself never writes a file and never learns the destination.
   */
  onCapture: (capture: {
    filename: string;
    pngBase64: string;
    widthPx: number;
    heightPx: number;
    assemblyFingerprint: string;
  }) => void;
  captureStatus: PhysicalPreviewCaptureStatus | null;
  projectName: string;
}

export interface PhysicalPreviewCaptureStatus {
  status: "saved" | "canceled" | "failed";
  targetPath: string | null;
  error: string | null;
}

function formatMm(valueMm: number): string {
  return `${valueMm.toFixed(1)} mm`;
}

/**
 * Never labels a `"declared-incomplete"` depth as exact, real, verified, or
 * total -- that phrasing is reserved for `"verified"` (status `"complete"`).
 */
function depthLabel(depthStatus: PhysicalPreviewAssembly["depthStatus"]): string {
  return depthStatus === "verified" ? "total assembled depth" : "declared stack depth — incomplete";
}

function captureMessage(status: PhysicalPreviewCaptureStatus | null): string {
  if (status === null) return "";
  if (status.status === "saved") {
    return `Saved ${status.targetPath ?? "the capture"}`;
  }
  if (status.status === "canceled") {
    return "Capture canceled. Nothing was written.";
  }
  return status.error ?? "The capture could not be saved.";
}

function WebglUnavailable() {
  return (
    <div className="physical-preview-fallback" role="status" data-testid="physical-preview-webgl-unavailable">
      <h2>3D preview unavailable</h2>
      <p>
        This computer does not expose a WebGL rendering context, so the
        physical 3D preview cannot render. Nothing in the project was
        changed. Try updating your graphics driver, or continue editing in
        2D — 3D preview is optional.
      </p>
    </div>
  );
}

function ConversionFailed({ message }: { message: string }) {
  return (
    <div className="physical-preview-fallback" role="alert" data-testid="physical-preview-conversion-failed">
      <h2>3D preview could not render this document</h2>
      <p>{message} Nothing in the project was changed.</p>
    </div>
  );
}

function ContextLostOverlay({ failedToRestore }: { failedToRestore: boolean }) {
  return (
    <div className="physical-preview-context-lost-overlay" role="alert" data-testid="physical-preview-context-lost">
      <h2>3D preview lost its graphics context</h2>
      <p>
        {failedToRestore
          ? "The graphics context could not be restored automatically. Close and reopen the preview to try again. Nothing in the project was changed."
          : "The browser reclaimed the WebGL context, so rendering paused. Nothing in the project was changed. The preview will resume automatically if the context is restored."}
      </p>
    </div>
  );
}

interface SceneContentProps {
  assembly: PhysicalPreviewAssembly;
  mode: AssemblyMode;
  view: PreviewView;
  resetToken: number;
  visibleLayerIds: ReadonlySet<string>;
  geometriesByLayer: ReadonlyMap<string, AssemblyLayerGeometry>;
  cameraRigRef: Ref<CameraRigHandle>;
  onCaptureReady: (handle: CaptureRigHandle | null) => void;
}

/** Lives inside `<Canvas>` so `computeCameraFit` can use the real pixel viewport. */
function SceneContent({
  assembly,
  mode,
  view,
  resetToken,
  visibleLayerIds,
  geometriesByLayer,
  cameraRigRef,
  onCaptureReady,
}: SceneContentProps) {
  const { size } = useThree();
  const fit = useMemo(
    () =>
      computeCameraFit(assembly, mode, {
        view,
        viewport: { widthPx: size.width, heightPx: size.height },
        visibleLayerIds,
      }),
    [assembly, mode, view, size.width, size.height, visibleLayerIds],
  );

  return (
    <>
      <color attach="background" args={[PREVIEW_CAPTURE_BACKGROUND_HEX]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[fit.distance, fit.distance, fit.distance]} intensity={1.1} />
      <directionalLight
        position={[-fit.distance, fit.distance * 0.5, -fit.distance]}
        intensity={0.4}
      />
      {assembly.layers
        .filter((layer) => visibleLayerIds.has(layer.layerId))
        .map((layer) => {
          const zRange = mode === "assembled" ? layer.assembledZRangeMm : layer.explodedZRangeMm;
          const appearance = layerAppearance(layer);
          const entries = geometriesByLayer.get(layer.layerId)?.geometries ?? [];
          return (
            <group key={layer.layerId} position={[0, 0, zRange.minZmm]}>
              {entries.map((entry) => (
                <mesh key={entry.shapeId} geometry={entry.geometry}>
                  <meshStandardMaterial
                    color={appearance.color}
                    metalness={appearance.metalness}
                    roughness={appearance.roughness}
                    opacity={appearance.opacity}
                    transparent={appearance.transparent}
                  />
                </mesh>
              ))}
            </group>
          );
        })}
      <CameraRig
        ref={cameraRigRef}
        position={fit.position}
        target={fit.target}
        fovDeg={fit.fovDeg}
        near={fit.near}
        far={fit.far}
        resetToken={resetToken}
      />
      <CaptureRig onReady={onCaptureReady} />
    </>
  );
}

/**
 * Read-only physical 3D preview of the currently open document's authoritative
 * physical layers (G4B foundation; G4C interaction/fallback/cleanup
 * completion). Never mutates geometry, dirty state, history, selection,
 * analysis, SVG/DXF output, or production packages -- purely a derived view
 * over the accepted G4A assembly (ADR 0024 section 7). Layer visibility is
 * presentation-only client state; it never recomputes topology or reaches
 * the authoritative project.
 *
 * Deliberately excluded from this slice: PNG capture (G5, privileged IPC).
 */
export default function PhysicalPreviewScreen({
  assembly,
  onClose,
  onCapture,
  captureStatus,
  projectName,
}: PhysicalPreviewScreenProps) {
  const [webglAvailable] = useState(() => isWebglAvailable());
  const [view, setView] = useState<PreviewView>("perspective");
  const [mode, setMode] = useState<AssemblyMode>("assembled");
  const [resetToken, setResetToken] = useState(0);
  const [hiddenLayerIds, setHiddenLayerIds] = useState<ReadonlySet<string>>(() => new Set());
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);
  const cameraRigRef = useRef<CameraRigHandle>(null);
  const [captureHandle, setCaptureHandle] = useState<CaptureRigHandle | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const { lost: contextLost, failedToRestore } = useWebglContextLossState(canvasElement);

  // A pure computation (no state writes): building geometry can throw, and
  // the resulting map and any conversion failure must be derived together
  // from the same attempt, rather than writing an error into state as a side
  // effect of useMemo -- which React does not guarantee runs only once.
  const { geometriesByLayer, conversionError } = useMemo((): {
    geometriesByLayer: ReadonlyMap<string, AssemblyLayerGeometry>;
    conversionError: string | null;
  } => {
    if (!webglAvailable) {
      return { geometriesByLayer: new Map(), conversionError: null };
    }
    try {
      const built = buildAssemblyGeometries(assembly);
      return {
        geometriesByLayer: new Map(built.map((entry) => [entry.layerId, entry])),
        conversionError: null,
      };
    } catch (error) {
      return {
        geometriesByLayer: new Map(),
        conversionError:
          error instanceof PreviewConversionError
            ? error.message
            : "The physical preview geometry could not be converted for rendering.",
      };
    }
  }, [assembly, webglAvailable]);

  useEffect(
    () => () => {
      disposeAssemblyGeometries([...geometriesByLayer.values()]);
    },
    [geometriesByLayer],
  );

  const visibleLayerIds = useMemo(
    () =>
      new Set(
        assembly.layers
          .map((layer) => layer.layerId)
          .filter((layerId) => !hiddenLayerIds.has(layerId)),
      ),
    [assembly, hiddenLayerIds],
  );

  const toggleLayerVisibility = useCallback((layerId: string) => {
    setHiddenLayerIds((current) => {
      const next = new Set(current);
      if (next.has(layerId)) next.delete(layerId);
      else next.add(layerId);
      return next;
    });
  }, []);

  /**
   * Captures the current frame and hands the validated bytes to the
   * privileged save path. Everything here is derived and read-only: the
   * project is never touched, and a rejected capture surfaces an explicit
   * message rather than silently producing a blank or corrupt image.
   */
  const handleCapture = useCallback(() => {
    setCaptureError(null);
    const rig = captureHandle;
    if (rig === null) {
      setCaptureError("The preview canvas is not ready to capture yet.");
      return;
    }

    let frame: SameFrameCapture;
    try {
      frame = rig.capture();
    } catch (error) {
      setCaptureError(
        error instanceof Error ? error.message : "The preview capture failed.",
      );
      return;
    }

    // Decoded here so the filename can bind to the exact bytes about to be
    // written. Built only after the capture exists -- a name derived before
    // the frame could not describe what was actually rendered.
    let pngBytes: Uint8Array;
    try {
      pngBytes = decodeCaptureDataUrl(frame.dataUrl);
    } catch (error) {
      setCaptureError(
        error instanceof Error ? error.message : "The preview capture produced no image data.",
      );
      return;
    }
    const filename = buildCaptureFilename({
      projectName,
      view,
      mode,
      widthPx: frame.widthPx,
      heightPx: frame.heightPx,
      pngBytes,
    });
    // Validated against the SAME frame the pixels came from, so a blank or
    // wrong-sized readback is rejected before anything reaches the disk.
    const result = validatePngCapture(
      {
        width: frame.widthPx,
        height: frame.heightPx,
        toDataURL: () => frame.dataUrl,
      },
      filename,
      {
        rgba: frame.rgba,
        widthPx: frame.widthPx,
        heightPx: frame.heightPx,
        background: PREVIEW_CAPTURE_BACKGROUND,
      },
    );
    if (!result.ok) {
      setCaptureError(result.errorMessage);
      return;
    }

    const pngBase64 = result.dataUrl.split(",")[1];
    if (pngBase64 === undefined || pngBase64.length === 0) {
      setCaptureError("The preview capture produced no image data.");
      return;
    }
    onCapture({
      filename,
      pngBase64,
      // Taken from the validated capture itself, not from any separate
      // source, so main can re-derive and cross-check them from the bytes.
      widthPx: result.widthPx,
      heightPx: result.heightPx,
      assemblyFingerprint: assembly.fingerprint,
    });
  }, [projectName, view, mode, onCapture, captureHandle, assembly.fingerprint]);

  const handleReset = useCallback(() => {
    setView("perspective");
    setResetToken((token) => token + 1);
  }, []);

  // Keyboard access to every action already available by mouse: orbit, pan,
  // zoom, reset, canonical views, and assembled/exploded mode. Scoped to
  // this focusable container (not the window) and stops propagation for
  // every key it handles, so it never reaches the global 2D-editor keyboard
  // handler in App.tsx -- arrow keys in particular would otherwise also
  // move selected path nodes still selected underneath this overlay.
  const handleContainerKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      switch (event.key) {
        case "ArrowLeft":
          if (event.shiftKey) cameraRigRef.current?.pan(-KEYBOARD_PAN_STEP_PX, 0);
          else cameraRigRef.current?.rotateLeft(-KEYBOARD_ROTATE_STEP_RAD);
          break;
        case "ArrowRight":
          if (event.shiftKey) cameraRigRef.current?.pan(KEYBOARD_PAN_STEP_PX, 0);
          else cameraRigRef.current?.rotateLeft(KEYBOARD_ROTATE_STEP_RAD);
          break;
        case "ArrowUp":
          if (event.shiftKey) cameraRigRef.current?.pan(0, KEYBOARD_PAN_STEP_PX);
          else cameraRigRef.current?.rotateUp(KEYBOARD_ROTATE_STEP_RAD);
          break;
        case "ArrowDown":
          if (event.shiftKey) cameraRigRef.current?.pan(0, -KEYBOARD_PAN_STEP_PX);
          else cameraRigRef.current?.rotateUp(-KEYBOARD_ROTATE_STEP_RAD);
          break;
        case "+":
        case "=":
          cameraRigRef.current?.dollyIn(KEYBOARD_ZOOM_SCALE);
          break;
        case "-":
        case "_":
          cameraRigRef.current?.dollyOut(KEYBOARD_ZOOM_SCALE);
          break;
        case "1":
          setView("front");
          break;
        case "2":
          setView("back");
          break;
        case "3":
          setView("edge");
          break;
        case "4":
          setView("perspective");
          break;
        case "0":
          handleReset();
          break;
        case "m":
        case "M":
          setMode((current) => (current === "assembled" ? "exploded" : "assembled"));
          break;
        default:
          return;
      }
      event.preventDefault();
      event.stopPropagation();
    },
    [handleReset],
  );

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  return (
    <div
      className="physical-preview-screen"
      data-testid="physical-preview-screen"
      ref={containerRef}
      tabIndex={0}
      role="application"
      aria-label="Physical 3D preview. Arrow keys orbit, shift plus arrow keys pan, plus and minus zoom, 1 through 4 select a view, 0 resets, M toggles assembled and exploded mode."
      onKeyDown={handleContainerKeyDown}
    >
      <div className="physical-preview-toolbar" role="toolbar" aria-label="Physical preview view controls">
        {PREVIEW_VIEWS.map((candidate) => (
          <button
            key={candidate}
            type="button"
            aria-pressed={view === candidate}
            data-testid={`physical-preview-view-${candidate}`}
            onClick={() => {
              setView(candidate);
            }}
          >
            {VIEW_LABELS[candidate]}
          </button>
        ))}
        <button type="button" onClick={handleReset}>
          Reset view
        </button>
        <div className="physical-preview-mode-toggle" role="group" aria-label="Assembly mode">
          <button
            type="button"
            aria-pressed={mode === "assembled"}
            data-testid="physical-preview-mode-assembled"
            onClick={() => {
              setMode("assembled");
            }}
          >
            Assembled
          </button>
          <button
            type="button"
            aria-pressed={mode === "exploded"}
            data-testid="physical-preview-mode-exploded"
            onClick={() => {
              setMode("exploded");
            }}
          >
            Exploded
          </button>
        </div>
        <span className="physical-preview-readout" data-testid="physical-preview-dimensions">
          {formatMm(assembly.stockMm.widthMm)} &times; {formatMm(assembly.stockMm.heightMm)} &times;{" "}
          {formatMm(assembly.assembledDepthMm)} {depthLabel(assembly.depthStatus)}
        </span>
        <span className="physical-preview-shortcuts-hint" data-testid="physical-preview-shortcuts-hint">
          Keyboard: arrows orbit &middot; shift+arrows pan &middot; +/- zoom &middot; 1–4 views &middot; 0 reset &middot; M mode
        </span>
        <button
          type="button"
          data-testid="physical-preview-capture"
          disabled={captureHandle === null}
          onClick={handleCapture}
        >
          Capture PNG
        </button>
        <button type="button" data-testid="physical-preview-close" onClick={onClose}>
          Close preview
        </button>
      </div>
      {(captureError !== null || captureStatus !== null) && (
        <div
          className={
            captureError === null && captureStatus?.status === "saved"
              ? "physical-preview-status-banner"
              : "physical-preview-warning-banner"
          }
          role="status"
          data-testid="physical-preview-capture-status"
        >
          {captureError ?? captureMessage(captureStatus)}
        </div>
      )}
      {assembly.status === "partial" && (
        <div className="physical-preview-warning-banner" role="alert" data-testid="physical-preview-findings-banner">
          {assembly.findings.length} preview finding(s) — at least one declared physical layer has
          no renderable geometry or ambiguous geometry and could not be rendered. Not a
          manufacturing certification; see the manufacturing analysis panel for cut-readiness.
        </div>
      )}
      {assembly.status === "unavailable" && (
        <div className="physical-preview-warning-banner" role="alert" data-testid="physical-preview-unavailable-banner">
          This document declares no physical manufacturing layers, so there is nothing to preview
          in 3D.
        </div>
      )}
      {assembly.layers.length > 0 && (
        <ul className="physical-preview-layer-list" data-testid="physical-preview-layer-list">
          {assembly.layers.map((layer) => (
            <li key={layer.layerId} data-testid={`physical-preview-layer-${layer.layerId}`}>
              <label>
                <input
                  type="checkbox"
                  checked={!hiddenLayerIds.has(layer.layerId)}
                  data-testid={`physical-preview-layer-visibility-${layer.layerId}`}
                  onChange={() => {
                    toggleLayerVisibility(layer.layerId);
                  }}
                />
                <strong>{layer.name}</strong> — {layer.material.material} — {formatMm(layer.thicknessMm)}
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="physical-preview-canvas-area" data-testid="physical-preview-canvas-area">
        {!webglAvailable ? (
          <WebglUnavailable />
        ) : conversionError !== null ? (
          <ConversionFailed message={conversionError} />
        ) : (
          <Canvas
            camera={{ fov: 45, near: 1, far: 10_000 }}
            // preserveDrawingBuffer is required for reliable capture readback
            // and is a deliberate, documented cost (ADR 0024 section 6): without
            // it the buffer may be cleared right after compositing, so the
            // encoded PNG could not come from the same frame as the pixels.
            gl={{ antialias: true, preserveDrawingBuffer: true }}
            dpr={DPR_RANGE}
            data-testid="physical-preview-canvas"
            onCreated={(state) => {
              setCanvasElement(state.gl.domElement);
            }}
          >
            <SceneContent
              assembly={assembly}
              mode={mode}
              view={view}
              resetToken={resetToken}
              visibleLayerIds={visibleLayerIds}
              geometriesByLayer={geometriesByLayer}
              cameraRigRef={cameraRigRef}
              onCaptureReady={setCaptureHandle}
            />
          </Canvas>
        )}
        {contextLost && <ContextLostOverlay failedToRestore={failedToRestore} />}
      </div>
    </div>
  );
}
