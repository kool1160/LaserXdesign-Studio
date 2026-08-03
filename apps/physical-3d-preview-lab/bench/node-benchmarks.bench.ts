import { cpus, totalmem } from "node:os";
import { readFileSync } from "node:fs";

import { buildPhysicalPreviewAssembly } from "@laserx/physical-preview-3d";
import { parseProject } from "@laserx/project-format";
import { describe, expect, it } from "vitest";

import { FIXTURE_REGISTRY } from "../src/fixtureRegistry";
import { buildLayerGeometries } from "../src/sceneToThree";
import { runWithImmutabilityCheck } from "./project-immutability.mjs";
import { writeResultsSection } from "./results-io.mjs";
import { runSampled } from "./stats.mjs";

const WARMUP_RUNS = 5;
const SAMPLE_RUNS = 30;
/** Determinism is a correctness claim, so it gets its own independent repeat count. */
const DETERMINISM_REPEATS = 12;

function readFixture(file: string): string {
  return readFileSync(
    new URL(`../../../fixtures/physical-preview/${file}`, import.meta.url),
    "utf8",
  );
}

function environment() {
  const cpuList = cpus();
  return {
    capturedAt: new Date().toISOString(),
    runtime: `node ${process.version}`,
    platform: `${process.platform}-${process.arch}`,
    cpuModel: cpuList[0]?.model.trim() ?? "unknown",
    cpuCount: cpuList.length,
    totalMemoryGb: Math.round((totalmem() / 1024 ** 3) * 10) / 10,
    warmupRuns: WARMUP_RUNS,
    sampleRuns: SAMPLE_RUNS,
  };
}

describe("Phase 3 Node benchmarks", () => {
  it(
    "measures parsing, scene conversion, and Three geometry conversion across every reviewed fixture",
    () => {
      const fixtures = FIXTURE_REGISTRY.map((descriptor) => {
        const source = readFixture(descriptor.file);

        // --- project parsing -------------------------------------------
        const parse = runSampled(
          () => {
            parseProject(source);
          },
          { warmupRuns: WARMUP_RUNS, sampleRuns: SAMPLE_RUNS },
        );

        // --- scene conversion ------------------------------------------
        const project = parseProject(source);
        const sceneConversion = runSampled(
          () => {
            buildPhysicalPreviewAssembly(project);
          },
          { warmupRuns: WARMUP_RUNS, sampleRuns: SAMPLE_RUNS },
        );

        // --- Three geometry conversion ---------------------------------
        const assembly = buildPhysicalPreviewAssembly(project);
        const geometryConversion = runSampled(
          () => {
            for (const layer of assembly.layers) {
              for (const entry of buildLayerGeometries(layer)) {
                // Dispose immediately so the benchmark measures construction
                // cost without accumulating retained geometry across samples.
                entry.geometry.dispose();
              }
            }
          },
          { warmupRuns: WARMUP_RUNS, sampleRuns: SAMPLE_RUNS },
        );

        const shapeCount = assembly.layers.reduce(
          (sum, layer) => sum + layer.shapes.length,
          0,
        );
        const holeCount = assembly.layers.reduce(
          (sum, layer) =>
            sum + layer.shapes.reduce((inner, shape) => inner + shape.holeContours.length, 0),
          0,
        );
        const contourPointCount = assembly.layers.reduce(
          (sum, layer) =>
            sum +
            layer.shapes.reduce(
              (inner, shape) =>
                inner +
                shape.outerContour.points.length +
                shape.holeContours.reduce((h, hole) => h + hole.points.length, 0),
              0,
            ),
          0,
        );

        return {
          key: descriptor.key,
          file: descriptor.file,
          purpose: descriptor.purpose,
          sourceBytes: Buffer.byteLength(source, "utf8"),
          documentObjectCount: project.document.objects.length,
          declaredLayerCount: project.document.layers.length,
          physicalLayerCount: assembly.layers.length,
          shapeCount,
          holeCount,
          contourPointCount,
          status: assembly.status,
          depthStatus: assembly.depthStatus,
          findingCodes: assembly.findings.map((finding) => finding.code),
          parseMs: parse,
          sceneConversionMs: sceneConversion,
          geometryConversionMs: geometryConversion,
        };
      });

      writeResultsSection("node", { environment: environment(), fixtures });

      // The harness must actually have exercised every reviewed fixture.
      expect(fixtures).toHaveLength(FIXTURE_REGISTRY.length);
      for (const fixture of fixtures) {
        expect(fixture.parseMs.sampleCount).toBe(SAMPLE_RUNS);
        expect(fixture.sceneConversionMs.sampleCount).toBe(SAMPLE_RUNS);
        expect(fixture.geometryConversionMs.sampleCount).toBe(SAMPLE_RUNS);
      }
    },
    600_000,
  );

  it(
    "proves repeated conversion is deterministic in fingerprint and geometry output",
    () => {
      const determinism = FIXTURE_REGISTRY.map((descriptor) => {
        const source = readFixture(descriptor.file);

        const fingerprints = new Set<string>();
        const geometryDigests = new Set<string>();
        let repeatsUnchanged = 0;

        for (let repeat = 0; repeat < DETERMINISM_REPEATS; repeat += 1) {
          // Re-parse from source each repeat so determinism is proven end to
          // end, not just for a single retained in-memory object.
          const repeatProject = parseProject(source);

          // Both conversions run *inside* the immutability check, so the
          // object verified afterwards is necessarily the object that was
          // passed through scene and Three geometry conversion.
          const { value: positions, unchanged } = runWithImmutabilityCheck(
            repeatProject,
            (converted) => {
              const assembly = buildPhysicalPreviewAssembly(converted);
              fingerprints.add(assembly.fingerprint);

              const vertexFloats: number[] = [];
              for (const layer of assembly.layers) {
                for (const entry of buildLayerGeometries(layer)) {
                  const attribute = entry.geometry.attributes["position"];
                  if (attribute !== undefined) {
                    vertexFloats.push(...Array.from(attribute.array as Float32Array));
                  }
                  entry.geometry.dispose();
                }
              }
              return vertexFloats;
            },
          );

          if (unchanged) repeatsUnchanged += 1;
          // Fixed-precision join: a stable textual digest of the actual
          // emitted vertex data, not just a vertex count.
          geometryDigests.add(positions.map((value) => value.toFixed(6)).join(","));
        }

        expect(fingerprints.size).toBe(1);
        expect(geometryDigests.size).toBe(1);
        expect(repeatsUnchanged).toBe(DETERMINISM_REPEATS);

        const [fingerprint] = [...fingerprints];
        const [geometryDigest] = [...geometryDigests];
        return {
          key: descriptor.key,
          repeats: DETERMINISM_REPEATS,
          distinctFingerprints: fingerprints.size,
          distinctGeometryOutputs: geometryDigests.size,
          fingerprint: fingerprint ?? "",
          geometryVertexFloatCount: (geometryDigest ?? "").split(",").filter(Boolean).length,
          immutabilityCheckedRepeats: DETERMINISM_REPEATS,
          repeatsWithUnchangedSource: repeatsUnchanged,
          // Derived from the per-repeat checks above, never hard-coded.
          sourceProjectUnchanged: repeatsUnchanged === DETERMINISM_REPEATS,
        };
      });

      writeResultsSection("determinism", determinism);
      expect(determinism).toHaveLength(FIXTURE_REGISTRY.length);
    },
    600_000,
  );
});
