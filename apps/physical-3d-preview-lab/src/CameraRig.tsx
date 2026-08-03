import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useRef, type ComponentRef } from "react";

import { computeCameraPose, type PreviewView } from "./cameraPose";

export type { PreviewView } from "./cameraPose";

export interface CameraRigProps {
  view: PreviewView;
  target: readonly [number, number, number];
  distance: number;
  resetToken: number;
}

export function CameraRig({ view, target, distance, resetToken }: CameraRigProps) {
  const { camera } = useThree();
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);
  const [tx, ty, tz] = target;

  useEffect(() => {
    const pose = computeCameraPose(view, [tx, ty, tz], distance);
    camera.position.set(...pose.position);
    camera.up.set(...pose.up);
    camera.lookAt(tx, ty, tz);
    const controls = controlsRef.current;
    if (controls) {
      controls.target.set(tx, ty, tz);
      controls.update();
    }
  }, [view, tx, ty, tz, distance, resetToken, camera]);

  return <OrbitControls ref={controlsRef} makeDefault enableDamping={false} />;
}
