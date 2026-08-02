import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useRef, type ComponentRef } from "react";

export type PreviewView = "front" | "perspective";

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
    if (view === "front") {
      camera.position.set(tx, ty, tz + distance);
    } else {
      camera.position.set(tx + distance * 0.7, ty + distance * 0.55, tz + distance * 0.9);
    }
    camera.up.set(0, 1, 0);
    camera.lookAt(tx, ty, tz);
    const controls = controlsRef.current;
    if (controls) {
      controls.target.set(tx, ty, tz);
      controls.update();
    }
  }, [view, tx, ty, tz, distance, resetToken, camera]);

  return <OrbitControls ref={controlsRef} makeDefault enableDamping={false} />;
}
