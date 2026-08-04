/**
 * The measured physical-preview pipeline.
 *
 * Scope note, stated plainly: `packages/physical-preview-3d` and
 * `packages/physical-preview-three` do not exist yet — they are promoted in G2
 * and G3. The scene-assembly and Three-conversion steps here are therefore a
 * **measurement harness local to this tool**, written to match the accepted
 * Issue #34 contract at head `9a4a90c6fa891ed0d9baf9bc8c99d41b04d54136`. They
 * are not production code, are not promoted by G1, and are replaced by the real
 * packages in G2/G3.
 *
 * What is *not* reimplemented is the part that matters for the G1 decision: the
 * region topology comes from the production `@laserx/cutability` analysis
 * itself, so the cost being attributed to it is real.
 */

import {
  analyzeDocumentCutability,
  type CutabilityAnalysisSummary,
} from "@laserx/cutability";
import type { LaserxDocument, LaserxProject } from "@laserx/domain";
import { ExtrudeGeometry, Shape } from "three";

/** Wall-clock milliseconds with the highest resolution Node offers. */
const now = (): number => Number(process.hrtime.bigint()) / 1e6;

/**
 * The four phases `analyzeDocumentCutability` reports through `onProgress`.
 *
 * This is how the harness attributes cost without forking or patching the
 * production analysis: the callback is part of its public options contract, so
 * timestamping it observes the real code path rather than a copy of it.
 *
 * - `normalizing` (5)  — path normalization and segment building. The preview needs this.
 * - `topology`    (25) — duplicate/overlapping segment detection. The preview discards this.
 * - `spacing`     (55) — minimum feature width and contour proximity. The preview discards this.
 * - `classifying` (85) — region classification. This is the only analysis output the preview uses.
 */
export interface AnalysisPhaseTimings {
  normalizingMs: number;
  topologyMs: number;
  spacingMs: number;
  classifyingMs: number;
  totalMs: number;
}

export interface AnalysisMeasurement {
  summary: CutabilityAnalysisSummary;
  phases: AnalysisPhaseTimings;
}

export function measureAnalysis(document: LaserxDocument): AnalysisMeasurement {
  const marks: Array<{ percent: number; at: number }> = [];
  const started = now();
  const summary = analyzeDocumentCutability(document, {
    onProgress: (percent: number) => {
      marks.push({ percent, at: now() });
    },
  });
  const finished = now();

  const at = (percent: number): number =>
    marks.find((mark) => mark.percent === percent)?.at ?? started;

  return {
    summary,
    phases: {
      normalizingMs: at(25) - at(5),
      topologyMs: at(55) - at(25),
      spacingMs: at(85) - at(55),
      classifyingMs: finished - at(85),
      totalMs: finished - started,
    },
  };
}

/** A physical layer, using the same predicate `packages/production-export` applies. */
const physicalLayers = (document: LaserxDocument) =>
  document.layers.filter(
    (layer) =>
      layer.manufacturing !== undefined && layer.manufacturing.role !== "non-cut-preview",
  );

export interface PreviewShape {
  outer: ReadonlyArray<{ xMm: number; yMm: number }>;
  holes: Array<ReadonlyArray<{ xMm: number; yMm: number }>>;
}

export interface PreviewLayerScene {
  layerId: string;
  thicknessMm: number;
  shapes: PreviewShape[];
}

/**
 * Builds the renderer-independent scene from an already-computed analysis.
 *
 * Even-depth regions are solid; their direct odd-depth children are holes. This
 * mirrors the accepted contract, including the deliberate inversion: cutability's
 * `disposition` describes what survives cutting, which is not the same question
 * as what is solid in a 3D stack, so only depth/parent/points are reused.
 */
export function buildScene(
  document: LaserxDocument,
  summary: CutabilityAnalysisSummary,
): PreviewLayerScene[] {
  const scenes: PreviewLayerScene[] = [];

  for (const layer of physicalLayers(document)) {
    const layerRegions = summary.regions.filter((region) => {
      const object = document.objects.find((candidate) => candidate.id === region.objectId);
      return object?.layerId === layer.id;
    });

    const shapes: PreviewShape[] = [];
    for (const region of layerRegions) {
      if (region.depth % 2 !== 0) continue;
      const holes = layerRegions
        .filter(
          (candidate) =>
            candidate.parentRegionId === region.id && candidate.depth % 2 === 1,
        )
        .map((candidate) => candidate.points);
      shapes.push({ outer: region.points, holes });
    }

    scenes.push({
      layerId: layer.id,
      thicknessMm: layer.manufacturing?.thicknessMm ?? 0,
      shapes,
    });
  }

  return scenes;
}

export interface ThreeConversionResult {
  geometries: number;
  vertices: number;
}

/** Converts the scene into real Three geometry, exactly as the accepted adapter does. */
export function convertToThree(scenes: readonly PreviewLayerScene[]): ThreeConversionResult {
  let geometries = 0;
  let vertices = 0;

  for (const scene of scenes) {
    for (const previewShape of scene.shapes) {
      const shape = new Shape(
        previewShape.outer.map((point) => ({ x: point.xMm, y: point.yMm })) as never,
      );
      for (const hole of previewShape.holes) {
        shape.holes.push(
          new Shape(hole.map((point) => ({ x: point.xMm, y: point.yMm })) as never),
        );
      }
      const geometry = new ExtrudeGeometry(shape, {
        depth: scene.thicknessMm,
        bevelEnabled: false,
        curveSegments: 1,
      });
      geometries += 1;
      vertices += geometry.getAttribute("position").count;
      geometry.dispose();
    }
  }

  return { geometries, vertices };
}

export interface FixtureShape {
  objects: number;
  layers: number;
  closedPaths: number;
  contourPoints: number;
}

/** Counts the inputs that the research showed cost actually scales with. */
export function describeProject(project: LaserxProject): FixtureShape {
  const document = project.document;
  let closedPaths = 0;
  let contourPoints = 0;
  for (const object of document.objects) {
    if (object.type === "path") {
      if (object.closed) closedPaths += 1;
      contourPoints += object.points.length;
    }
  }
  return {
    objects: document.objects.length,
    layers: document.layers.length,
    closedPaths,
    contourPoints,
  };
}
