/**
 * M14 G1 scaling benchmark.
 *
 * Usage: pnpm --filter @laserx/tool-m14-preview-bench bench
 *
 * Runs under Vitest because the workspace packages use `.js`-suffixed TypeScript
 * imports that plain Node type-stripping cannot resolve; Vitest is the resolver
 * the rest of the repository already uses.
 *
 * Writes raw and summarized measurements to
 * docs/experiments/m14-physical-3d-preview/g1-results.json.
 */

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { parseProject, serializeProject } from "@laserx/project-format";
import { it } from "vitest";

import { benchFixtures } from "../src/fixtures.js";
import {
  buildScene,
  convertToThree,
  describeProject,
  measureAnalysis,
} from "../src/pipeline.js";
import { round, summarize, type SampleStatistics } from "../src/stats.js";

const WARMUP = 3;
const SAMPLES = 12;

const now = (): number => Number(process.hrtime.bigint()) / 1e6;

interface FixtureResult {
  key: string;
  description: string;
  shape: ReturnType<typeof describeProject>;
  geometries: number;
  vertices: number;
  issues: number;
  regions: number;
  parse: SampleStatistics;
  analysis: SampleStatistics;
  scene: SampleStatistics;
  three: SampleStatistics;
  analysisPhasesMedianMs: {
    normalizing: number;
    topology: number;
    spacing: number;
    classifying: number;
  };
  previewRequiredShareOfAnalysis: number;
  heapDeltaBytes: number;
}

async function main(): Promise<void> {
  const fixtures = await benchFixtures();
  const results: FixtureResult[] = [];

  for (const fixture of fixtures) {
    const serialized = serializeProject(fixture.project);
    const shape = describeProject(fixture.project);

    // Warm up so JIT compilation is not attributed to the first sample.
    for (let run = 0; run < WARMUP; run += 1) {
      const warm = parseProject(serialized);
      const analysis = measureAnalysis(warm.document);
      convertToThree(buildScene(warm.document, analysis.summary));
    }

    globalThis.gc?.();
    const heapBefore = process.memoryUsage().heapUsed;

    const parseMs: number[] = [];
    const analysisMs: number[] = [];
    const sceneMs: number[] = [];
    const threeMs: number[] = [];
    const phases = { normalizing: [] as number[], topology: [] as number[], spacing: [] as number[], classifying: [] as number[] };
    let geometries = 0;
    let vertices = 0;
    let issues = 0;
    let regions = 0;

    for (let run = 0; run < SAMPLES; run += 1) {
      const parseStart = now();
      const project = parseProject(serialized);
      parseMs.push(now() - parseStart);

      const analysis = measureAnalysis(project.document);
      analysisMs.push(analysis.phases.totalMs);
      phases.normalizing.push(analysis.phases.normalizingMs);
      phases.topology.push(analysis.phases.topologyMs);
      phases.spacing.push(analysis.phases.spacingMs);
      phases.classifying.push(analysis.phases.classifyingMs);

      const sceneStart = now();
      const scene = buildScene(project.document, analysis.summary);
      sceneMs.push(now() - sceneStart);

      const threeStart = now();
      const converted = convertToThree(scene);
      threeMs.push(now() - threeStart);

      geometries = converted.geometries;
      vertices = converted.vertices;
      issues = analysis.summary.issues.length;
      regions = analysis.summary.regions.length;
    }

    globalThis.gc?.();
    const heapAfter = process.memoryUsage().heapUsed;

    const medianOf = (values: number[]): number => round(summarize(values).medianMs);
    const normalizing = medianOf(phases.normalizing);
    const classifying = medianOf(phases.classifying);
    const analysisMedian = summarize(analysisMs).medianMs;

    results.push({
      key: fixture.key,
      description: fixture.description,
      shape,
      geometries,
      vertices,
      issues,
      regions,
      parse: roundStats(summarize(parseMs)),
      analysis: roundStats(summarize(analysisMs)),
      scene: roundStats(summarize(sceneMs)),
      three: roundStats(summarize(threeMs)),
      analysisPhasesMedianMs: {
        normalizing,
        topology: medianOf(phases.topology),
        spacing: medianOf(phases.spacing),
        classifying,
      },
      // The share of analysis time the preview actually consumes. The rest is
      // computed and discarded, and is what a topology-only entry point saves.
      previewRequiredShareOfAnalysis:
        analysisMedian === 0 ? 1 : round((normalizing + classifying) / analysisMedian, 4),
      heapDeltaBytes: heapAfter - heapBefore,
    });

    process.stdout.write(
      `${fixture.key.padEnd(24)} objects=${String(shape.objects).padStart(4)} points=${String(shape.contourPoints).padStart(6)} analysis=${summarize(analysisMs).medianMs.toFixed(3)}ms three=${summarize(threeMs).medianMs.toFixed(3)}ms\n`,
    );
  }

  const output = {
    generatedBy: "tools/m14-preview-bench",
    gate: "M14 G1",
    warmupRuns: WARMUP,
    samplesPerFixture: SAMPLES,
    environment: {
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
      cpus: cpuModel(),
    },
    notes:
      "Scene assembly and Three conversion are measured through a tool-local harness matching the accepted Issue #34 contract; region topology comes from the production @laserx/cutability analysis.",
    fixtures: results,
  };

  const target = resolve(
    import.meta.dirname,
    "../../../docs/experiments/m14-physical-3d-preview/g1-results.json",
  );
  await writeFile(target, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  process.stdout.write(`\nWrote ${target}\n`);
}

function roundStats(statistics: SampleStatistics): SampleStatistics {
  return {
    samples: statistics.samples,
    minMs: round(statistics.minMs),
    medianMs: round(statistics.medianMs),
    p95Ms: round(statistics.p95Ms),
    maxMs: round(statistics.maxMs),
  };
}

function cpuModel(): string {
  return process.env["PROCESSOR_IDENTIFIER"] ?? "unknown";
}

it("measures M14 G1 physical-preview scaling", async () => {
  await main();
});
