import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { PMREMGenerator } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/**
 * Installs a locally generated image-based environment.
 *
 * Two reasons this is required rather than decorative:
 *
 * 1. A high-metalness surface with no environment renders effectively black,
 *    so mirrored acrylic is unreadable without one.
 * 2. Transmissive acrylic needs something to refract; with no environment,
 *    clear, translucent, and frosted stock look nearly identical.
 *
 * `RoomEnvironment` is procedural geometry and lights built in-process by
 * Three itself — **no texture is downloaded and no network request is made**,
 * which keeps the "no remote texture downloads" constraint intact.
 *
 * Mounted conditionally by the caller: when no visible material needs an
 * environment there is no reason to hold a PMREM render target open, and the
 * pre-catalog rendering path is preserved exactly.
 */
export function PreviewEnvironment() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);

  useEffect(() => {
    const generator = new PMREMGenerator(gl);
    const room = new RoomEnvironment();

    // `fromScene` returns a full WebGLRenderTarget, not just a texture. The
    // target owns a framebuffer and renderbuffer in addition to the texture,
    // so it must be retained and disposed as a whole — disposing only
    // `target.texture` leaks the rest, which is invisible on a fresh page
    // load and only shows up when this component is unmounted and remounted
    // inside one long-lived renderer.
    const target = generator.fromScene(room, 0.04);
    scene.environment = target.texture;

    // The room scene and the generator are only needed to bake the PMREM;
    // release them immediately. Disposing the generator does not invalidate
    // the target it produced.
    room.dispose();
    generator.dispose();

    return () => {
      // Only relinquish the environment slot if it is still ours: another
      // component may legitimately have replaced it since we mounted.
      if (scene.environment === target.texture) scene.environment = null;
      target.dispose();
    };
  }, [gl, scene]);

  return null;
}
