import {
  buildPhysicalPreviewAssembly,
  type PhysicalPreviewAssemblyDepthStatus,
  type PhysicalPreviewAssemblyLayer,
} from "@laserx/physical-preview-3d";
import { Canvas, type RootState } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useState } from "react";

import { registerBenchRenderer } from "./benchHook";
import { buildCaptureFilename, type AssemblyMode } from "./captureFilename";
import { capturePreviewPng, downloadCapturedPng } from "./capturePng";
import { CameraRig } from "./CameraRig";
import type { PreviewView } from "./cameraPose";
import { fixtureKeyFromLocation, loadFixtureProject } from "./loadFixtureProject";
import { LayerMaterial } from "./LayerMaterial";
import { resolveAssemblyMaterials, type ResolvedLayerMaterial } from "./materialAdapter";
import {
  catalogMaterialIdsForFixture,
  requestedMaterialFromLocation,
} from "./materialSelection";
import { PreviewEnvironment } from "./PreviewEnvironment";
import { buildLayerGeometries, type LayerShapeGeometry } from "./sceneToThree";
import { isWebglAvailable } from "./webgl";

type BoundsMmLike = NonNullable<PhysicalPreviewAssemblyLayer["boundsMm"]>;

type CaptureStatus =
  | { kind: "idle" }
  | { kind: "success"; filename: string }
  | { kind: "error"; message: string };

const VIEW_LABELS: Record<PreviewView, string> = {
  front: "Front",
  back: "Back",
  edge: "Edge",
  perspective: "Perspective",
};
const VIEWS: readonly PreviewView[] = ["front", "back", "edge", "perspective"];

/** Bounded to [1, 2]: renders crisply on standard/retina displays without
 * paying full native resolution on very-high-DPR devices (e.g. 3x phones). */
const DPR_RANGE: [number, number] = [1, 2];

function formatMm(valueMm: number): string {
  return `${valueMm.toFixed(1)} mm`;
}

/**
 * Never labels a `"declared-incomplete"` depth as exact, real, verified, or
 * total — that phrasing is reserved for `"verified"` (status `"complete"`).
 */
function depthLabel(depthStatus: PhysicalPreviewAssemblyDepthStatus): string {
  return depthStatus === "verified" ? "total assembled depth" : "declared stack depth — incomplete";
}

function unionBoundsMm(a: BoundsMmLike, b: BoundsMmLike): BoundsMmLike {
  return {
    minXmm: Math.min(a.minXmm, b.minXmm),
    minYmm: Math.min(a.minYmm, b.minYmm),
    maxXmm: Math.max(a.maxXmm, b.maxXmm),
    maxYmm: Math.max(a.maxYmm, b.maxYmm),
  };
}

function modeZExtent(
  layers: readonly PhysicalPreviewAssemblyLayer[],
  mode: AssemblyMode,
): { minZmm: number; maxZmm: number } {
  if (layers.length === 0) return { minZmm: 0, maxZmm: 0 };
  const ranges = layers.map((layer) =>
    mode === "assembled" ? layer.assembledZRangeMm : layer.explodedZRangeMm,
  );
  return {
    minZmm: Math.min(...ranges.map((range) => range.minZmm)),
    maxZmm: Math.max(...ranges.map((range) => range.maxZmm)),
  };
}

function WebglUnavailable() {
  return (
    <div className="lab-fallback" role="status" data-testid="webgl-unavailable">
      <h2>3D preview unavailable</h2>
      <p>
        This browser or device does not expose a WebGL rendering context, so the
        physical 3D preview cannot render here. Nothing in the LaserX project was
        changed. Try a different browser, enable hardware acceleration, or update
        your graphics driver.
      </p>
    </div>
  );
}

function ContextLostOverlay() {
  return (
    <div className="lab-context-lost-overlay" role="alert" data-testid="context-lost">
      <h2>3D preview lost its graphics context</h2>
      <p>
        The browser reclaimed the WebGL context, so rendering paused. Nothing in
        the LaserX project was changed, and the readouts above remain accurate.
        The preview will resume automatically if the browser restores the
        context.
      </p>
    </div>
  );
}

export function App() {
  const [webglAvailable] = useState(() => isWebglAvailable());
  const [view, setView] = useState<PreviewView>("perspective");
  const [mode, setMode] = useState<AssemblyMode>("assembled");
  const [resetToken, setResetToken] = useState(0);
  const [hiddenLayerIds, setHiddenLayerIds] = useState<ReadonlySet<string>>(() => new Set());
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [captureStatus, setCaptureStatus] = useState<CaptureStatus>({ kind: "idle" });

  const fixtureKey = useMemo(() => fixtureKeyFromLocation(window.location.search), []);
  const requestedMaterialId = useMemo(
    () => requestedMaterialFromLocation(window.location.search),
    [],
  );
  const project = useMemo(() => loadFixtureProject(fixtureKey), [fixtureKey]);

  // Built in two passes: the first establishes physical layer order so the
  // ephemeral catalog assignment can be made by order rather than by
  // hard-coded layer IDs, the second carries those identifiers.
  const assembly = useMemo(() => {
    const ordered = buildPhysicalPreviewAssembly(project);
    const catalogMaterialIds = catalogMaterialIdsForFixture(
      fixtureKey,
      ordered.layers,
      requestedMaterialId,
    );
    return Object.keys(catalogMaterialIds).length === 0
      ? ordered
      : buildPhysicalPreviewAssembly(project, { catalogMaterialIds });
  }, [project, fixtureKey, requestedMaterialId]);

  // All catalog knowledge is resolved here, once, outside the render tree.
  const materials = useMemo(() => resolveAssemblyMaterials(assembly.layers), [assembly]);
  const materialByLayerId = useMemo(() => {
    const map = new Map<string, ResolvedLayerMaterial>();
    for (const resolved of materials.layers) map.set(resolved.layerId, resolved);
    return map;
  }, [materials]);

  // Geometry is built outside React (sceneToThree.ts) and attached via the
  // `geometry` prop, so R3F does not auto-manage its lifecycle the way it
  // does for JSX-declared geometries/materials — dispose explicitly
  // whenever the fixture/assembly changes or this component unmounts.
  const geometriesByLayer = useMemo(() => {
    const map = new Map<string, LayerShapeGeometry[]>();
    for (const layer of assembly.layers) {
      map.set(layer.layerId, buildLayerGeometries(layer));
    }
    return map;
  }, [assembly]);

  useEffect(
    () => () => {
      for (const entries of geometriesByLayer.values()) {
        for (const entry of entries) {
          entry.geometry.dispose();
        }
      }
    },
    [geometriesByLayer],
  );

  const handleCreated = useCallback((state: RootState) => {
    setCanvasElement(state.gl.domElement);
    registerBenchRenderer(state.gl);
  }, []);

  // Runtime WebGL context-loss handling: preventDefault() signals the
  // browser we want restoration attempted; state drives a readout-
  // preserving overlay instead of an uncaught render-loop failure.
  useEffect(() => {
    if (canvasElement === null) return;
    const handleLost = (event: Event) => {
      event.preventDefault();
      setContextLost(true);
    };
    const handleRestored = () => {
      setContextLost(false);
    };
    canvasElement.addEventListener("webglcontextlost", handleLost);
    canvasElement.addEventListener("webglcontextrestored", handleRestored);
    return () => {
      canvasElement.removeEventListener("webglcontextlost", handleLost);
      canvasElement.removeEventListener("webglcontextrestored", handleRestored);
    };
  }, [canvasElement]);

  const toggleLayerVisibility = (layerId: string) => {
    setHiddenLayerIds((current) => {
      const next = new Set(current);
      if (next.has(layerId)) next.delete(layerId);
      else next.add(layerId);
      return next;
    });
  };

  const handleCapture = () => {
    if (canvasElement === null) {
      setCaptureStatus({ kind: "error", message: "The preview canvas is not ready yet." });
      return;
    }
    const filename = buildCaptureFilename({ projectName: project.project.name, view, mode });
    const result = capturePreviewPng(canvasElement, filename);
    if (!result.ok) {
      setCaptureStatus({
        kind: "error",
        message: result.errorMessage ?? "PNG capture failed.",
      });
      return;
    }
    downloadCapturedPng(document, result);
    setCaptureStatus({ kind: "success", filename: result.filename });
  };

  if (assembly.status === "unavailable") {
    return (
      <div className="lab-app">
        <div className="lab-fallback" role="alert">
          <h2>No physical layers to preview</h2>
          <p>The fixture declares no physical manufacturing layers.</p>
        </div>
      </div>
    );
  }

  const visibleLayers = assembly.layers.filter((layer) => !hiddenLayerIds.has(layer.layerId));

  // Mount the PMREM environment only while something visible actually needs
  // it. When nothing does, the pre-catalog rendering path is preserved
  // exactly and no render target is held open.
  const needsEnvironment = visibleLayers.some(
    (layer) => materialByLayerId.get(layer.layerId)?.params.needsEnvironment === true,
  );

  const overallBounds = visibleLayers.reduce<BoundsMmLike | null>((current, layer) => {
    if (layer.boundsMm === null) return current;
    return current === null ? layer.boundsMm : unionBoundsMm(current, layer.boundsMm);
  }, null);
  const widthMm = overallBounds === null ? 0 : overallBounds.maxXmm - overallBounds.minXmm;
  const heightMm = overallBounds === null ? 0 : overallBounds.maxYmm - overallBounds.minYmm;
  const centerX = overallBounds === null ? 0 : (overallBounds.minXmm + overallBounds.maxXmm) / 2;
  const centerY = overallBounds === null ? 0 : (overallBounds.minYmm + overallBounds.maxYmm) / 2;

  const zExtent = modeZExtent(assembly.layers, mode);
  const centerZ = (zExtent.minZmm + zExtent.maxZmm) / 2;
  const zSpanMm = zExtent.maxZmm - zExtent.minZmm;
  const diagonal = Math.hypot(widthMm, heightMm, zSpanMm) || 1;
  const distance = diagonal * 1.6 + 40;

  const handleReset = () => {
    setView("perspective");
    setResetToken((token) => token + 1);
  };

  return (
    <div className="lab-app">
      <div className="lab-toolbar" role="toolbar" aria-label="Preview view controls">
        {VIEWS.map((candidate) => (
          <button
            key={candidate}
            type="button"
            aria-pressed={view === candidate}
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
        <div className="lab-mode-toggle" role="group" aria-label="Assembly mode">
          <button
            type="button"
            aria-pressed={mode === "assembled"}
            data-testid="mode-assembled"
            onClick={() => {
              setMode("assembled");
            }}
          >
            Assembled
          </button>
          <button
            type="button"
            aria-pressed={mode === "exploded"}
            data-testid="mode-exploded"
            onClick={() => {
              setMode("exploded");
            }}
          >
            Exploded
          </button>
        </div>
        <button type="button" data-testid="capture-png" onClick={handleCapture}>
          Capture PNG
        </button>
        <span className="lab-readout" data-testid="dimensions">
          {formatMm(widthMm)} &times; {formatMm(heightMm)} &times;{" "}
          {formatMm(assembly.assembledDepthMm)} {depthLabel(assembly.depthStatus)}
        </span>
      </div>
      {captureStatus.kind !== "idle" && (
        <div
          className={
            captureStatus.kind === "success" ? "lab-status-banner" : "lab-warning-banner"
          }
          role="status"
          data-testid="capture-status"
        >
          {captureStatus.kind === "success"
            ? `Saved ${captureStatus.filename}`
            : captureStatus.message}
        </div>
      )}
      <ul className="lab-layer-list" data-testid="layer-list">
        {assembly.layers.map((layer) => {
          const resolved = materialByLayerId.get(layer.layerId);
          return (
            <li key={layer.layerId} data-testid={`layer-${layer.layerId}`}>
              <label>
                <input
                  type="checkbox"
                  checked={!hiddenLayerIds.has(layer.layerId)}
                  data-testid={`layer-visibility-${layer.layerId}`}
                  onChange={() => {
                    toggleLayerVisibility(layer.layerId);
                  }}
                />
                <strong>{layer.name}</strong> —{" "}
                <span data-testid={`layer-material-${layer.layerId}`}>
                  {resolved?.displayLabel ?? layer.material.material}
                </span>{" "}
                — {formatMm(layer.thicknessMm)}
                {/* Only a genuine resolution failure is marked. A layer that
                    never claimed a catalog material has not failed, so it
                    keeps its normal legacy/domain presentation — otherwise
                    the fallback marker stops meaning anything. */}
                {resolved?.status === "fallback-unknown-id" && (
                  <span className="lab-material-fallback"> (fallback)</span>
                )}
              </label>
            </li>
          );
        })}
      </ul>
      {materials.findings.length > 0 && (
        <div className="lab-warning-banner" role="alert" data-testid="material-findings-banner">
          {materials.findings.length} material finding(s) —{" "}
          {materials.findings.map((finding) => finding.message).join(" ")}
        </div>
      )}
      {assembly.status === "partial" && (
        <div className="lab-warning-banner" role="alert" data-testid="findings-banner">
          {assembly.findings.length} preview finding(s) — at least one declared physical layer
          has no renderable geometry or ambiguous geometry and could not be rendered. Its
          name/material/thickness are still shown above. Not a manufacturing certification.
        </div>
      )}
      <div className="lab-canvas-area" data-testid="canvas-area">
        {webglAvailable ? (
          <Canvas
            camera={{ fov: 45, near: 1, far: distance * 20 }}
            gl={{ antialias: true, preserveDrawingBuffer: true }}
            dpr={DPR_RANGE}
            onCreated={handleCreated}
            data-testid="preview-canvas"
          >
            <color attach="background" args={["#2b2b2b"]} />
            <ambientLight intensity={0.6} />
            <directionalLight position={[distance, distance, distance]} intensity={1.1} />
            <directionalLight
              position={[-distance, distance * 0.5, -distance]}
              intensity={0.4}
            />
            {needsEnvironment && <PreviewEnvironment />}
            {visibleLayers.map((layer) => {
              const zRange =
                mode === "assembled" ? layer.assembledZRangeMm : layer.explodedZRangeMm;
              const resolved = materialByLayerId.get(layer.layerId);
              const entries = geometriesByLayer.get(layer.layerId) ?? [];
              if (resolved === undefined) return null;
              return (
                <group key={layer.layerId} position={[0, 0, zRange.minZmm]}>
                  {entries.map((entry) => (
                    <mesh key={entry.shapeId} geometry={entry.geometry}>
                      <LayerMaterial params={resolved.params} />
                    </mesh>
                  ))}
                </group>
              );
            })}
            <CameraRig
              view={view}
              target={[centerX, centerY, centerZ]}
              distance={distance}
              resetToken={resetToken}
            />
          </Canvas>
        ) : (
          <WebglUnavailable />
        )}
        {contextLost && <ContextLostOverlay />}
      </div>
    </div>
  );
}
