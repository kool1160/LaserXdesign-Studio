import { useThree } from "@react-three/fiber";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/**
 * Wires `OrbitControls` directly from `three` rather than adopting
 * `@react-three/drei` (ADR 0024 section 3): drei was used in the accepted
 * research for exactly this one import, and `three` already ships the same
 * control under the same license.
 */
export interface CameraRigProps {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  fovDeg: number;
  near: number;
  far: number;
  resetToken: number;
}

/**
 * Imperative keyboard-driven camera actions, using `OrbitControls`' own
 * public `rotateLeft`/`rotateUp`/`pan`/`dollyIn`/`dollyOut` methods rather
 * than reimplementing camera math -- each call already includes the
 * `controls.update()` needed to apply it.
 */
export interface CameraRigHandle {
  rotateLeft(angleRad: number): void;
  rotateUp(angleRad: number): void;
  pan(deltaXPx: number, deltaYPx: number): void;
  dollyIn(scale: number): void;
  dollyOut(scale: number): void;
}

export const CameraRig = forwardRef<CameraRigHandle, CameraRigProps>(function CameraRig(
  { position, target, fovDeg, near, far, resetToken },
  ref,
) {
  const { camera, gl, size } = useThree();
  const controlsRef = useRef<OrbitControls | null>(null);
  const [px, py, pz] = position;
  const [tx, ty, tz] = target;

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enableDamping = false;
    controlsRef.current = controls;
    return () => {
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, gl]);

  useImperativeHandle(
    ref,
    () => ({
      rotateLeft(angleRad) {
        controlsRef.current?.rotateLeft(angleRad);
        controlsRef.current?.update();
      },
      rotateUp(angleRad) {
        controlsRef.current?.rotateUp(angleRad);
        controlsRef.current?.update();
      },
      pan(deltaXPx, deltaYPx) {
        controlsRef.current?.pan(deltaXPx, deltaYPx);
        controlsRef.current?.update();
      },
      dollyIn(scale) {
        controlsRef.current?.dollyIn(scale);
        controlsRef.current?.update();
      },
      dollyOut(scale) {
        controlsRef.current?.dollyOut(scale);
        controlsRef.current?.update();
      },
    }),
    [],
  );

  useEffect(() => {
    if (camera.type === "PerspectiveCamera" && "fov" in camera) {
      const perspective = camera as unknown as {
        fov: number;
        near: number;
        far: number;
        aspect: number;
        updateProjectionMatrix: () => void;
      };
      perspective.fov = fovDeg;
      perspective.near = near;
      perspective.far = far;
      perspective.aspect = size.width / Math.max(size.height, 1);
      perspective.updateProjectionMatrix();
    }
    camera.position.set(px, py, pz);
    camera.up.set(0, 1, 0);
    camera.lookAt(tx, ty, tz);
    const controls = controlsRef.current;
    if (controls) {
      controls.target.set(tx, ty, tz);
      controls.update();
    }
    // resetToken is otherwise unused: including it forces this effect to
    // reapply the same pose on demand (e.g. a "reset view" action) even when
    // every other dependency is unchanged.
  }, [px, py, pz, tx, ty, tz, fovDeg, near, far, size.width, size.height, resetToken, camera]);

  return null;
});
