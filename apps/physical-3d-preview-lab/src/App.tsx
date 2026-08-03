import {
  buildPhysicalPreviewAssembly,
  type PhysicalPreviewAssemblyLayer,
} from "@laserx/physical-preview-3d";
import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";

import { CameraRig } from "./CameraRig";
import type { PreviewView } from "./cameraPose";
import { loadFixtureProject } from "./loadFixtureProject";
import { materialAppearance } from "./materialAppearance";
import { buildLayerGeometries, type LayerShapeGeometry } from "./sceneToThree";
import { isWebglAvailable } from "./webgl";

type AssemblyMode = "assembled" | "exploded";
type BoundsMmLike = NonNullable<PhysicalPreviewAssemblyLayer["boundsMm"]>;

const VIEW_LABELS: Record<PreviewView, string> = {
  front: "Front",
  back: "Back",
  edge: "Edge",
  perspective: "Perspective",
};
const VIEWS: readonly PreviewView[] = ["front", "back", "edge", "perspective"];

function formatMm(valueMm: number): string {
  return `${valueMm.toFixed(1)} mm`;
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

export function App() {
  const [webglAvailable] = useState(() => isWebglAvailable());
  const [view, setView] = useState<PreviewView>("perspective");
  const [mode, setMode] = useState<AssemblyMode>("assembled");
  const [resetToken, setResetToken] = useState(0);

  const project = useMemo(() => loadFixtureProject(), []);
  const assembly = useMemo(() => buildPhysicalPreviewAssembly(project), [project]);

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

  const overallBounds = assembly.layers.reduce<BoundsMmLike | null>((current, layer) => {
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
        <span className="lab-readout" data-testid="dimensions">
          {formatMm(widthMm)} &times; {formatMm(heightMm)} &times; {formatMm(assembly.assembledDepthMm)}{" "}
          total assembled depth
        </span>
      </div>
      <ul className="lab-layer-list" data-testid="layer-list">
        {assembly.layers.map((layer) => (
          <li key={layer.layerId} data-testid={`layer-${layer.layerId}`}>
            <strong>{layer.name}</strong> — {layer.material.material} —{" "}
            {formatMm(layer.thicknessMm)}
          </li>
        ))}
      </ul>
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
            gl={{ antialias: true }}
            data-testid="preview-canvas"
          >
            <color attach="background" args={["#2b2b2b"]} />
            <ambientLight intensity={0.6} />
            <directionalLight position={[distance, distance, distance]} intensity={1.1} />
            <directionalLight
              position={[-distance, distance * 0.5, -distance]}
              intensity={0.4}
            />
            {assembly.layers.map((layer) => {
              const zRange =
                mode === "assembled" ? layer.assembledZRangeMm : layer.explodedZRangeMm;
              const appearance = materialAppearance(layer.material.material);
              const entries = geometriesByLayer.get(layer.layerId) ?? [];
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
              view={view}
              target={[centerX, centerY, centerZ]}
              distance={distance}
              resetToken={resetToken}
            />
          </Canvas>
        ) : (
          <WebglUnavailable />
        )}
      </div>
    </div>
  );
}
