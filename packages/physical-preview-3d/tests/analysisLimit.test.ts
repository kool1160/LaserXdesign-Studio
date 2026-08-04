/**
 * Analysis-capacity and parse/build determinism coverage (M14 G2 repair).
 *
 * `@laserx/cutability` supports at most `MAX_CUTABILITY_SEGMENTS` flattened
 * segments and reports the ceiling by *throwing*. The project-format schema
 * imposes no matching point-count limit, so a perfectly valid `.laserx` project
 * can reach it. An unhandled throw would abort the whole preview and take every
 * other valid physical layer with it — neither a truthful partial assembly nor a
 * fail-visible unsupported layer.
 *
 * Fixtures here are serialized and parsed through `@laserx/project-format`
 * rather than hand-built in memory, so the over-limit case is proven reachable
 * from a project the parser actually accepts.
 */

import { MAX_CUTABILITY_SEGMENTS } from "@laserx/cutability";
import {
  createBlankProject,
  identityTransform,
  type LaserxProject,
  type Layer,
  type PathObject,
} from "@laserx/domain";
import { parseProject, serializeProject } from "@laserx/project-format";
import { describe, expect, it } from "vitest";

import { buildPhysicalPreviewAssembly, buildPhysicalPreviewScene } from "../src/index.js";

const BIG_LAYER_ID = "f0000001-0000-4000-8000-000000000001";
const SMALL_LAYER_ID = "f0000002-0000-4000-8000-000000000002";
const NOW = "2026-08-04T00:00:00.000Z";

const objectId = (index: number): string =>
  `f1000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;

function physicalLayer(id: string, name: string, thicknessMm: number): Layer {
  return {
    id,
    name,
    visible: true,
    locked: false,
    manufacturing: {
      role: name === "Backing" ? "backing" : "face",
      material: "acrylic",
      thicknessMm,
      stockThicknessDesignation: {
        kind: "millimeter",
        label: `${String(thicknessMm)} mm`,
        material: null,
      },
      process: "laser",
      notes: "",
      registrationGroup: null,
      registrationHoleIds: [],
    },
  };
}

/**
 * Many small closed squares rather than one enormous contour.
 *
 * The ceiling is on *total* flattened segments, and both shapes cross it. This
 * one is deliberately chosen because it is cheap: `normalizeCutPaths` checks the
 * total immediately after collecting paths, so it throws in ~160 ms. A single
 * 50,000-point contour instead spends superlinear time inside per-path
 * flattening *before* the check is reached, which makes it useless as a test
 * fixture — measured at over four minutes without returning.
 */
const OVER_LIMIT_OBJECTS = Math.ceil((MAX_CUTABILITY_SEGMENTS + 40) / 4);

function overLimitObjects(layerId: string): PathObject[] {
  return Array.from({ length: OVER_LIMIT_OBJECTS }, (_, index) => {
    const x = (index % 100) * 2;
    const y = Math.floor(index / 100) * 2;
    return square(index + 1, layerId, x, y, 1);
  });
}

function square(index: number, layerId: string, x: number, y: number, size: number): PathObject {
  return {
    id: objectId(index),
    type: "path",
    layerId,
    transform: identityTransform(),
    closed: true,
    points: [
      { xMm: x, yMm: y },
      { xMm: x + size, yMm: y },
      { xMm: x + size, yMm: y + size },
      { xMm: x, yMm: y + size },
    ],
  };
}

/** Round-trips through the real parser so the fixture is provably schema-valid. */
function parsed(project: LaserxProject): LaserxProject {
  return parseProject(serializeProject(project));
}

function overLimitOnlyProject(): LaserxProject {
  return parsed(
    createBlankProject({
      id: "f2000000-0000-4000-8000-000000000001",
      now: NOW,
      documentId: "f2000000-0000-4000-8000-000000000002",
      width: 300,
      height: 300,
      layers: [physicalLayer(BIG_LAYER_ID, "Face", 6)],
      activeLayerId: BIG_LAYER_ID,
      objects: overLimitObjects(BIG_LAYER_ID),
    }),
  );
}

function mixedProject(): LaserxProject {
  return parsed(
    createBlankProject({
      id: "f3000000-0000-4000-8000-000000000001",
      now: NOW,
      documentId: "f3000000-0000-4000-8000-000000000002",
      width: 300,
      height: 300,
      layers: [
        physicalLayer(BIG_LAYER_ID, "Face", 6),
        physicalLayer(SMALL_LAYER_ID, "Backing", 4),
      ],
      activeLayerId: BIG_LAYER_ID,
      objects: [
        ...overLimitObjects(BIG_LAYER_ID),
        square(900_001, SMALL_LAYER_ID, 20, 20, 60),
      ],
    }),
  );
}

describe("analysis capacity fails visibly instead of aborting", () => {
  it("accepts the over-limit fixture through the real schema parser", () => {
    // If the parser rejected this, the whole finding would be unreachable and
    // the regression below would prove nothing.
    const project = overLimitOnlyProject();
    const segments = project.document.objects.reduce(
      (total, object) => total + (object.type === "path" ? object.points.length : 0),
      0,
    );
    // Closed paths contribute one segment per point, so this is the exact
    // quantity the cutability ceiling is measured against.
    expect(segments).toBeGreaterThan(MAX_CUTABILITY_SEGMENTS);
  });

  it("returns the layer with a finding instead of throwing", () => {
    const project = overLimitOnlyProject();

    const scene = buildPhysicalPreviewScene(project, { layerId: BIG_LAYER_ID });
    const layer = scene.layers[0];
    if (layer === undefined) throw new Error("expected the over-limit layer");

    // Declared identity survives: the layer must not silently vanish.
    expect(layer.layerId).toBe(BIG_LAYER_ID);
    expect(layer.name).toBe("Face");
    expect(layer.thicknessMm).toBe(6);
    expect(layer.material.material).toBe("acrylic");

    // Nothing is rendered and nothing is invented.
    expect(layer.shapes).toHaveLength(0);
    expect(layer.boundsMm).toBeNull();

    const finding = scene.findings.find((candidate) => candidate.code === "ANALYSIS_LIMIT_EXCEEDED");
    expect(finding).toBeDefined();
    expect(finding?.layerId).toBe(BIG_LAYER_ID);
    // Every object on the failed layer is attributed, so the user can find it.
    expect(finding?.objectIds).toHaveLength(OVER_LIMIT_OBJECTS);
    expect(finding?.objectIds).toContain(objectId(1));
    expect(finding?.message).toContain(String(MAX_CUTABILITY_SEGMENTS));
  });

  it("keeps the valid layer rendered in a mixed assembly and reports partial", () => {
    const assembly = buildPhysicalPreviewAssembly(mixedProject());

    expect(assembly.status).toBe("partial");
    expect(assembly.depthStatus).toBe("declared-incomplete");
    // Declared depth still sums both layers; it is simply not verified.
    expect(assembly.assembledDepthMm).toBe(10);

    const big = assembly.layers.find((layer) => layer.layerId === BIG_LAYER_ID);
    const small = assembly.layers.find((layer) => layer.layerId === SMALL_LAYER_ID);
    if (big === undefined || small === undefined) throw new Error("expected both layers");

    // The over-limit layer contributes nothing...
    expect(big.shapes).toHaveLength(0);
    // ...but the valid layer is NOT taken down with it.
    expect(small.shapes.length).toBeGreaterThan(0);
    expect(small.thicknessMm).toBe(4);

    expect(
      assembly.findings.filter((finding) => finding.code === "ANALYSIS_LIMIT_EXCEEDED"),
    ).toHaveLength(1);
  });

  it("is deterministic and leaves the parsed source project unchanged", () => {
    const project = mixedProject();
    const before = JSON.stringify(project);

    const first = buildPhysicalPreviewAssembly(project);
    const second = buildPhysicalPreviewAssembly(project);

    expect(second.fingerprint).toBe(first.fingerprint);
    expect(JSON.stringify(second.layers)).toBe(JSON.stringify(first.layers));
    expect(JSON.stringify(project)).toBe(before);
  });

  it("still throws for failures that are not the documented capacity ceiling", () => {
    // The catch must be narrow: an unknown layer id is a programmer error and
    // must not be laundered into a user-facing finding.
    expect(() =>
      buildPhysicalPreviewScene(overLimitOnlyProject(), { layerId: "not-a-layer" }),
    ).toThrow(RangeError);
  });
});

describe("deterministic across repeated parse and build", () => {
  it("produces identical output from repeated parses of the same exact bytes", () => {
    const serialized = serializeProject(
      createBlankProject({
        id: "f4000000-0000-4000-8000-000000000001",
        now: NOW,
        documentId: "f4000000-0000-4000-8000-000000000002",
        width: 300,
        height: 300,
        layers: [
          physicalLayer(BIG_LAYER_ID, "Face", 3),
          physicalLayer(SMALL_LAYER_ID, "Backing", 6),
        ],
        activeLayerId: BIG_LAYER_ID,
        objects: [
          square(1, BIG_LAYER_ID, 20, 20, 80),
          square(2, BIG_LAYER_ID, 40, 40, 20),
          square(3, SMALL_LAYER_ID, 10, 10, 120),
        ],
      }),
    );

    const fingerprints = new Set<string>();
    const geometry = new Set<string>();
    const sceneFingerprints = new Set<string>();

    for (let run = 0; run < 6; run += 1) {
      // Re-parsed from the same exact bytes every iteration, which is the path
      // the desktop app actually takes when opening a project.
      const project = parseProject(serialized);
      const untouched = JSON.stringify(project);

      const assembly = buildPhysicalPreviewAssembly(project);
      fingerprints.add(assembly.fingerprint);
      geometry.add(JSON.stringify(assembly.layers));

      const scene = buildPhysicalPreviewScene(project, { layerId: BIG_LAYER_ID });
      sceneFingerprints.add(scene.fingerprint);

      // Each independently parsed source object is left unchanged.
      expect(JSON.stringify(project)).toBe(untouched);
    }

    expect(fingerprints.size).toBe(1);
    expect(geometry.size).toBe(1);
    expect(sceneFingerprints.size).toBe(1);
  });
});
