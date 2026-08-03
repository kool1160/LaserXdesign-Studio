import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { PMREMGenerator, type Texture } from "three";
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
 * The generated PMREM texture and the generator both own GPU resources and
 * are disposed on unmount or renderer change.
 */
export function PreviewEnvironment() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);

  useEffect(() => {
    const generator = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    let generated: Texture | null = null;

    try {
      generated = generator.fromScene(room, 0.04).texture;
      scene.environment = generated;
    } finally {
      // The source room scene is only needed to bake the PMREM; release its
      // geometries and materials immediately rather than holding them for
      // the lifetime of the preview.
      room.dispose();
      generator.dispose();
    }

    return () => {
      if (scene.environment === generated) scene.environment = null;
      generated.dispose();
    };
  }, [gl, scene]);

  return null;
}
