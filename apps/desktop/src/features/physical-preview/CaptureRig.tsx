import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

import { captureSameFrame, type SameFrameCapture } from "./sameFrameCapture.js";

/**
 * Performs the G5 capture readback from inside the `<Canvas>`, where the
 * live renderer, scene, and camera are available.
 *
 * Kept separate from `CameraRig` because it is a different concern with a
 * different failure surface: camera control is presentation, capture is the
 * privileged evidence path. The actual transaction ordering lives in
 * `sameFrameCapture.ts` so it stays unit-testable without WebGL; this
 * component only adapts the real Three renderer to that interface.
 *
 * Publishes its handle through `onReady` rather than a forwarded ref
 * because React Three Fiber mounts the scene tree through its own
 * reconciler, *after* the canvas element itself is in the DOM. A ref would
 * therefore still be null in the window between "canvas is visible" and
 * "scene is mounted" -- so the capture control must be driven by an
 * explicit readiness signal, not by the canvas's presence.
 */
export interface CaptureRigHandle {
  capture(): SameFrameCapture;
}

export interface CaptureRigProps {
  onReady: (handle: CaptureRigHandle | null) => void;
}

export function CaptureRig({ onReady }: CaptureRigProps) {
  const { gl, scene, camera } = useThree();

  useEffect(() => {
    const handle: CaptureRigHandle = {
      capture() {
        const context = gl.getContext();
        const canvas = gl.domElement;
        // The drawing buffer's own pixel dimensions, not CSS size: on a
        // high-DPI display these differ, and reading the wrong one would
        // produce a byte count that disagrees with the encoded PNG.
        const widthPx = canvas.width;
        const heightPx = canvas.height;

        return captureSameFrame({
          widthPx,
          heightPx,
          renderFrame: () => {
            gl.render(scene, camera);
          },
          readPixels: () => {
            const pixels = new Uint8Array(widthPx * heightPx * 4);
            context.readPixels(
              0,
              0,
              widthPx,
              heightPx,
              context.RGBA,
              context.UNSIGNED_BYTE,
              pixels,
            );
            return pixels;
          },
          toDataURL: () => canvas.toDataURL("image/png"),
        });
      },
    };
    onReady(handle);
    return () => {
      onReady(null);
    };
  }, [gl, scene, camera, onReady]);

  return null;
}
