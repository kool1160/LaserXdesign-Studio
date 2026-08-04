/**
 * Exception safety for conversion and resource construction.
 *
 * `ExtrudeGeometry` allocates GPU-backed buffers eagerly. If a later shape or
 * layer throws mid-conversion, the caller never receives the earlier geometries
 * and therefore cannot dispose them — so the failing call must dispose them
 * itself before the error propagates.
 *
 * Disposal is counted by spying on `BufferGeometry.prototype.dispose` and
 * `Material.prototype.dispose`, which observes the real objects the
 * implementation creates internally rather than trusting it to report them.
 */

import type { PhysicalPreviewAssembly, PhysicalPreviewLayer } from "@laserx/physical-preview-3d";
import { BufferGeometry, Material } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildAssemblyGeometries,
  buildLayerGeometries,
  PreviewConversionError,
} from "../src/geometry.js";
import { buildPreviewResources } from "../src/resources.js";

const geometryDispose = vi.spyOn(BufferGeometry.prototype, "dispose");
const materialDispose = vi.spyOn(Material.prototype, "dispose");

afterEach(() => {
  geometryDispose.mockClear();
  materialDispose.mockClear();
});

type Shape = PhysicalPreviewLayer["shapes"][number];

const square = (id: string, sourceObjectIds: string[]): Shape =>
  ({
    id,
    outerContour: {
      points: [
        { xMm: 0, yMm: 0 },
        { xMm: 10, yMm: 0 },
        { xMm: 10, yMm: 10 },
        { xMm: 0, yMm: 10 },
      ],
    },
    holeContours: [],
    sourceObjectIds,
  });

/**
 * A shape whose third contour point throws when read.
 *
 * Not a synthetic failure mode: `Shape` iterates the point array, so a throwing
 * accessor fails at exactly the seam malformed geometry would.
 */
function malformedShape(id: string, sourceObjectIds: string[]): Shape {
  const points: Array<{ xMm: number; yMm: number }> = [
    { xMm: 0, yMm: 0 },
    { xMm: 10, yMm: 0 },
  ];
  Object.defineProperty(points, "2", {
    enumerable: true,
    configurable: true,
    get() {
      throw new Error("malformed contour point");
    },
  });
  points.length = 3;
  return { id, outerContour: { points }, holeContours: [], sourceObjectIds };
}

function layer(layerId: string, shapes: Shape[], name = "Face"): PhysicalPreviewLayer {
  return {
    layerId,
    name,
    role: "face",
    thicknessMm: 3,
    material: { material: "wood", stockThicknessDesignation: null, displayLabel: "" },
    shapes,
    boundsMm: { minXmm: 0, minYmm: 0, maxXmm: 10, maxYmm: 10 },
  } as unknown as PhysicalPreviewLayer;
}

function assemblyOf(layers: PhysicalPreviewLayer[]): PhysicalPreviewAssembly {
  return {
    identity: { projectId: "p", documentId: "d", projectUpdatedAt: "t" },
    stockMm: { widthMm: 100, heightMm: 50 },
    status: "complete",
    spacing: { assembledGapMm: 0, explodedGapMm: 20 },
    layers: layers.map((entry, order) => ({
      ...entry,
      order,
      assembledZRangeMm: { minZmm: order * 3, maxZmm: order * 3 + 3 },
      explodedZRangeMm: { minZmm: order * 23, maxZmm: order * 23 + 3 },
    })),
    assembledDepthMm: layers.length * 3,
    depthStatus: "verified",
    findings: [],
    fingerprint: "fp",
  } as unknown as PhysicalPreviewAssembly;
}

describe("layer conversion exception safety", () => {
  it("disposes earlier geometries exactly once when a later shape throws", () => {
    const supplied = layer("l1", [
      square("ok-1", ["o1"]),
      square("ok-2", ["o2"]),
      malformedShape("bad", ["o3"]),
    ]);

    expect(() => buildLayerGeometries(supplied)).toThrow(PreviewConversionError);

    // Two geometries were built before the third shape failed; both must have
    // been released, and neither disposed twice.
    expect(geometryDispose).toHaveBeenCalledTimes(2);
  });

  it("attributes the failure to its layer, shape, and source objects", () => {
    const supplied = layer("layer-x", [malformedShape("shape-x", ["obj-a", "obj-b"])], "Backing");

    try {
      buildLayerGeometries(supplied);
      throw new Error("expected a conversion failure");
    } catch (error) {
      expect(error).toBeInstanceOf(PreviewConversionError);
      const failure = error as PreviewConversionError;
      expect(failure.layerId).toBe("layer-x");
      expect(failure.shapeId).toBe("shape-x");
      expect(failure.sourceObjectIds).toEqual(["obj-a", "obj-b"]);
      // The original renderer error is preserved for diagnostics.
      expect(failure.cause).toBeInstanceOf(Error);
      expect(failure.message).toContain("Backing");
    }
  });

  it("disposes earlier layers' geometries when a later layer throws", () => {
    const assembly = assemblyOf([
      layer("good", [square("s1", ["o1"]), square("s2", ["o2"])], "Good"),
      layer("bad", [malformedShape("b", ["o3"])], "Bad"),
    ]);

    try {
      buildAssemblyGeometries(assembly);
      throw new Error("expected a conversion failure");
    } catch (error) {
      expect(error).toBeInstanceOf(PreviewConversionError);
      expect((error as PreviewConversionError).layerId).toBe("bad");
    }

    // The good layer's two geometries must not survive the failed build.
    expect(geometryDispose).toHaveBeenCalledTimes(2);
  });

  it("leaks nothing and reports nothing when every layer converts", () => {
    const built = buildAssemblyGeometries(
      assemblyOf([layer("a", [square("a1", ["o1"])]), layer("b", [square("b1", ["o2"])])]),
    );
    expect(geometryDispose).not.toHaveBeenCalled();
    expect(built.flatMap((entry) => entry.geometries)).toHaveLength(2);
  });
});

describe("resource construction exception safety", () => {
  it("disposes all geometries and earlier materials when material allocation throws", () => {
    const assembly = assemblyOf([
      layer("a", [square("a1", ["o1"])], "A"),
      layer("b", [square("b1", ["o2"])], "B"),
    ]);

    // Made to throw *after* the assembly is built, so the failure lands during
    // material allocation rather than while constructing the fixture.
    const second = assembly.layers[1];
    if (second === undefined) throw new Error("expected two layers");
    Object.defineProperty(second, "material", {
      configurable: true,
      get(): never {
        throw new Error("material allocation failed");
      },
    });

    let thrown: unknown;
    try {
      buildPreviewResources(assembly, "assembled");
      throw new Error("expected a material allocation failure");
    } catch (error) {
      thrown = error;
    }

    // Attributed the same way a geometry conversion failure is: G4 must be able
    // to identify which layer's material failed, not just see an anonymous
    // renderer error.
    expect(thrown).toBeInstanceOf(PreviewConversionError);
    const failure = thrown as PreviewConversionError;
    expect(failure.layerId).toBe("b");
    expect(failure.shapeId).toBeNull();
    expect(failure.sourceObjectIds).toEqual(["o2"]);
    expect(failure.cause).toBeInstanceOf(Error);
    expect((failure.cause as Error).message).toBe("material allocation failed");

    // Both layers' geometries were already built before materials were
    // allocated, so both must be released...
    expect(geometryDispose).toHaveBeenCalledTimes(2);
    // ...along with the one material that had been created successfully.
    expect(materialDispose).toHaveBeenCalledTimes(1);
  });

  it("keeps dispose() idempotent on the successful path", () => {
    const resources = buildPreviewResources(
      assemblyOf([layer("a", [square("a1", ["o1"])], "A")]),
      "assembled",
    );

    resources.dispose();
    resources.dispose();
    resources.dispose();

    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(resources.materialsByLayerId.size).toBe(0);
  });
});
