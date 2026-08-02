import { buildPhysicalPreviewScene } from "@laserx/physical-preview-3d";
import { Canvas } from "@react-three/fiber";
import { useMemo, useState } from "react";

import { CameraRig, type PreviewView } from "./CameraRig";
import { FIXTURE_LAYER_ID, loadFixtureProject } from "./loadFixtureProject";
import { buildLayerGeometries } from "./sceneToThree";
import { isWebglAvailable } from "./webgl";

function formatMm(valueMm: number): string {
  return `${valueMm.toFixed(1)} mm`;
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
  const [resetToken, setResetToken] = useState(0);

  const project = useMemo(() => loadFixtureProject(), []);
  const scene = useMemo(
    () => buildPhysicalPreviewScene(project, { layerId: FIXTURE_LAYER_ID }),
    [project],
  );
  const layer = scene.layers[0];
  const geometries = useMemo(
    () => (layer === undefined ? [] : buildLayerGeometries(layer)),
    [layer],
  );

  if (layer === undefined) {
    return (
      <div className="lab-app">
        <div className="lab-fallback" role="alert">
          <h2>No physical layer available</h2>
          <p>The fixture produced no renderable physical layer.</p>
        </div>
      </div>
    );
  }

  const bounds = layer.boundsMm;
  const widthMm = bounds === null ? 0 : bounds.maxXmm - bounds.minXmm;
  const heightMm = bounds === null ? 0 : bounds.maxYmm - bounds.minYmm;
  const centerX = bounds === null ? 0 : (bounds.minXmm + bounds.maxXmm) / 2;
  const centerY = bounds === null ? 0 : (bounds.minYmm + bounds.maxYmm) / 2;
  const centerZ = layer.thicknessMm / 2;
  const diagonal = Math.hypot(widthMm, heightMm, layer.thicknessMm) || 1;
  const distance = diagonal * 1.8;

  const handleReset = () => {
    setView("perspective");
    setResetToken((token) => token + 1);
  };

  return (
    <div className="lab-app">
      <div className="lab-toolbar" role="toolbar" aria-label="Preview view controls">
        <button
          type="button"
          aria-pressed={view === "front"}
          onClick={() => {
            setView("front");
          }}
        >
          Front
        </button>
        <button
          type="button"
          aria-pressed={view === "perspective"}
          onClick={() => {
            setView("perspective");
          }}
        >
          Perspective
        </button>
        <button type="button" onClick={handleReset}>
          Reset view
        </button>
        <span className="lab-readout" data-testid="dimensions">
          {formatMm(widthMm)} &times; {formatMm(heightMm)} &times; {formatMm(layer.thicknessMm)}
        </span>
      </div>
      {scene.findings.length > 0 && (
        <div className="lab-warning-banner" role="alert" data-testid="findings-banner">
          {scene.findings.length} unsupported-geometry finding(s) on this layer — see
          the research log for details, not a manufacturing certification.
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
            {geometries.map((entry) => (
              <mesh key={entry.shapeId} geometry={entry.geometry}>
                <meshStandardMaterial color="#b7bdc4" metalness={0.35} roughness={0.55} />
              </mesh>
            ))}
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
