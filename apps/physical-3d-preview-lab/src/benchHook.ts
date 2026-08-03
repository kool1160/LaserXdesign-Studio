import type { WebGLRenderer } from "three";

import { FIXTURE_REGISTRY, type FixtureDescriptor } from "./fixtureRegistry";

/**
 * A deliberately small, documented research hook used only by the Phase 3
 * benchmark harness (`bench/browser-benchmarks.mjs`) to read renderer
 * resource counts and drive real WebGL context loss. It exposes read
 * access to already-rendered state; it does not mutate the project, the
 * scene contract, or any manufacturing data, and nothing in the app's own
 * behavior depends on it.
 *
 * This exists because trustworthy GPU-resource-growth evidence cannot be
 * obtained from outside the page.
 */
export interface PreviewLabBenchHook {
  fixtures: readonly FixtureDescriptor[];
  renderer: WebGLRenderer | null;
  /** Renderer-reported resource counts, the primary resource-growth metric. */
  rendererInfo: () => {
    geometries: number;
    textures: number;
    programs: number;
    calls: number;
    triangles: number;
  } | null;
}

declare global {
  interface Window {
    __laserxPreviewLab?: PreviewLabBenchHook;
  }
}

function currentHook(): PreviewLabBenchHook {
  window.__laserxPreviewLab ??= {
    fixtures: FIXTURE_REGISTRY,
    renderer: null,
    rendererInfo: () => {
      const renderer = window.__laserxPreviewLab?.renderer ?? null;
      if (renderer === null) return null;
      return {
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        programs: renderer.info.programs?.length ?? 0,
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
      };
    },
  };
  return window.__laserxPreviewLab;
}

export function installBenchHook(): void {
  currentHook();
}

export function registerBenchRenderer(renderer: WebGLRenderer): void {
  currentHook().renderer = renderer;
}
