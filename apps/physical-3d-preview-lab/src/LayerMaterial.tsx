import type { ThreeMaterialParams } from "./materialAdapter";

/**
 * Renders the Three material for one layer purely from a resolved
 * descriptor.
 *
 * This component has no knowledge of material identity — no catalog IDs, no
 * material names, no per-material branching beyond the descriptor's own
 * `materialClass`. All catalog knowledge lives in `materialAdapter.ts`, so a
 * new catalog entry needs no change here.
 *
 * Both branches are declared in JSX, so React Three Fiber owns their
 * lifecycle and disposes them when the mesh unmounts or the material class
 * changes.
 */
export function LayerMaterial({ params }: { params: ThreeMaterialParams }) {
  if (params.materialClass === "physical") {
    return (
      <meshPhysicalMaterial
        color={params.color}
        roughness={params.roughness}
        metalness={params.metalness}
        opacity={params.opacity}
        transparent={params.transparent}
        transmission={params.transmission}
        thickness={params.thicknessMm}
        ior={params.ior}
        depthWrite={params.depthWrite}
        side={params.doubleSided ? 2 : 0}
      />
    );
  }

  return (
    <meshStandardMaterial
      color={params.color}
      roughness={params.roughness}
      metalness={params.metalness}
      opacity={params.opacity}
      transparent={params.transparent}
      depthWrite={params.depthWrite}
      side={params.doubleSided ? 2 : 0}
    />
  );
}
