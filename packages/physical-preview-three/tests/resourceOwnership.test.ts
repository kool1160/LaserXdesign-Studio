import type { PhysicalPreviewAssembly } from "@laserx/physical-preview-3d";
import type { MeshStandardMaterial } from "three";
import { describe, expect, it } from "vitest";

import { buildPreviewResources } from "../src/resources.js";

function assembly(): PhysicalPreviewAssembly {
  return {
    identity: {
      projectId: "project",
      documentId: "document",
      projectUpdatedAt: "2026-08-04T00:00:00.000Z",
    },
    stockMm: { widthMm: 100, heightMm: 50 },
    status: "complete",
    spacing: { assembledGapMm: 0, explodedGapMm: 20 },
    layers: [
      {
        layerId: "face",
        name: "Face",
        role: "face",
        thicknessMm: 3,
        material: {
          material: "mild-steel",
          stockThicknessDesignation: null,
          displayLabel: "3 mm mild steel",
        },
        shapes: [
          {
            id: "shape",
            sourceObjectIds: ["source-object"],
            outerContour: {
              points: [
                { xMm: 0, yMm: 0 },
                { xMm: 20, yMm: 0 },
                { xMm: 20, yMm: 10 },
                { xMm: 0, yMm: 10 },
              ],
            },
            holeContours: [],
          },
        ],
        boundsMm: { minXmm: 0, minYmm: 0, maxXmm: 20, maxYmm: 10 },
        order: 0,
        assembledZRangeMm: { minZmm: 0, maxZmm: 3 },
        explodedZRangeMm: { minZmm: 0, maxZmm: 3 },
      },
    ],
    assembledDepthMm: 3,
    depthStatus: "verified",
    findings: [],
    fingerprint: "fingerprint",
  };
}

describe("preview resource ownership", () => {
  it("exposes immutable collection views while retaining private disposal ownership", () => {
    const resources = buildPreviewResources(assembly(), "assembled");
    const geometry = resources.layers[0]?.geometries[0]?.geometry;
    const material = resources.materialsByLayerId.get("face");
    if (geometry === undefined || material === undefined) {
      throw new Error("Expected one geometry and material.");
    }

    expect(Object.isFrozen(resources)).toBe(true);
    expect(Object.isFrozen(resources.layers)).toBe(true);
    expect(Object.isFrozen(resources.layers[0])).toBe(true);
    expect(Object.isFrozen(resources.layers[0]?.geometries)).toBe(true);
    expect(Object.isFrozen(resources.placements)).toBe(true);
    expect("set" in resources.materialsByLayerId).toBe(false);
    expect("clear" in resources.materialsByLayerId).toBe(false);

    let callbackMap: ReadonlyMap<string, MeshStandardMaterial> | null = null;
    resources.materialsByLayerId.forEach((_value, _key, map) => {
      callbackMap = map;
    });
    expect(callbackMap).toBe(resources.materialsByLayerId);
    expect(callbackMap === null || "set" in callbackMap).toBe(false);
    expect(callbackMap === null || "clear" in callbackMap).toBe(false);

    expect(() => {
      (resources.layers as unknown[]).pop();
    }).toThrow();

    let geometryDisposals = 0;
    let materialDisposals = 0;
    geometry.addEventListener("dispose", () => {
      geometryDisposals += 1;
    });
    material.addEventListener("dispose", () => {
      materialDisposals += 1;
    });

    resources.dispose();
    resources.dispose();

    expect(geometryDisposals).toBe(1);
    expect(materialDisposals).toBe(1);
    expect(resources.materialsByLayerId.size).toBe(0);
  });
});
