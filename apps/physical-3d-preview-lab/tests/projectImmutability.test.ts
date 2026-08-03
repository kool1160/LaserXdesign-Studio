import { readFileSync } from "node:fs";

import { buildPhysicalPreviewAssembly } from "@laserx/physical-preview-3d";
import { parseProject } from "@laserx/project-format";
import { describe, expect, it } from "vitest";

import {
  immutabilitySnapshot,
  runWithImmutabilityCheck,
} from "../bench/project-immutability.mjs";
import { buildLayerGeometries } from "../src/sceneToThree";

function readProject(file: string) {
  return parseProject(
    readFileSync(new URL(`../../../fixtures/physical-preview/${file}`, import.meta.url), "utf8"),
  );
}

describe("immutabilitySnapshot", () => {
  it("distinguishes an absent key from one explicitly set to undefined", () => {
    // Plain JSON.stringify omits undefined-valued keys, which would let a
    // converter that overwrote a real value with `undefined` escape
    // detection. The snapshot must not have that blind spot.
    const withKey: Record<string, unknown> = { a: 1, b: undefined };
    const withoutKey: Record<string, unknown> = { a: 1 };
    expect(JSON.stringify(withKey)).toBe(JSON.stringify(withoutKey));
    expect(immutabilitySnapshot(withKey)).not.toBe(immutabilitySnapshot(withoutKey));
  });

  it("is stable for structurally identical projects", () => {
    expect(immutabilitySnapshot(readProject("two-layer-face-backing.laserx"))).toBe(
      immutabilitySnapshot(readProject("two-layer-face-backing.laserx")),
    );
  });
});

describe("runWithImmutabilityCheck", () => {
  it("reports unchanged for the real scene and geometry conversion path", () => {
    const project = readProject("two-layer-face-backing.laserx");
    const { value, unchanged } = runWithImmutabilityCheck(project, (converted) => {
      const assembly = buildPhysicalPreviewAssembly(converted);
      for (const layer of assembly.layers) {
        for (const entry of buildLayerGeometries(layer)) {
          entry.geometry.dispose();
        }
      }
      return assembly;
    });
    expect(unchanged).toBe(true);
    expect(value.status).toBe("complete");
  });

  /**
   * The point of this test: prove the harness's immutability check is
   * capable of failing. A check that can only ever report "unchanged" is
   * not evidence — which is exactly the defect this replaced, where the
   * snapshotted object was never the converted one.
   */
  it("reports changed when a converter mutates the supplied project's manufacturing metadata", () => {
    const project = readProject("two-layer-face-backing.laserx");
    const { unchanged } = runWithImmutabilityCheck(project, (converted) => {
      const assembly = buildPhysicalPreviewAssembly(converted);
      const metadata = converted.document.layers[0]?.manufacturing;
      if (metadata === undefined) throw new Error("Expected manufacturing metadata.");
      metadata.thicknessMm += 1;
      return assembly;
    });
    expect(unchanged).toBe(false);
  });

  it("reports changed when a converter mutates geometry coordinates", () => {
    const project = readProject("two-layer-face-backing.laserx");
    const { unchanged } = runWithImmutabilityCheck(project, (converted) => {
      const object = converted.document.objects[0];
      if (object?.type !== "rectangle") throw new Error("Expected a rectangle object.");
      object.origin.xMm += 0.001;
      return null;
    });
    expect(unchanged).toBe(false);
  });

  it("reports changed when a converter appends or removes an object", () => {
    const added = readProject("two-layer-face-backing.laserx");
    expect(
      runWithImmutabilityCheck(added, (converted) => {
        converted.document.objects.pop();
        return null;
      }).unchanged,
    ).toBe(false);
  });

  it("reports changed when a converter overwrites a value with undefined", () => {
    const project = readProject("two-layer-face-backing.laserx");
    const { unchanged } = runWithImmutabilityCheck(project, (converted) => {
      const metadata = converted.document.layers[0]?.manufacturing;
      if (metadata === undefined) throw new Error("Expected manufacturing metadata.");
      metadata.stockThicknessDesignation = undefined;
      return null;
    });
    expect(unchanged).toBe(false);
  });
});
