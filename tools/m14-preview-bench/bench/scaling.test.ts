/**
 * M14 G1 scaling benchmark.
 *
 * Usage: pnpm --filter @laserx/tool-m14-preview-bench bench
 *
 * Runs under Vitest because the workspace packages use `.js`-suffixed TypeScript
 * imports that plain Node type-stripping cannot resolve; Vitest is the resolver
 * the rest of the repository already uses.
 *
 * Writes raw per-sample and summarized measurements to
 * docs/experiments/m14-physical-3d-preview/g1-results.json.
 */

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { parseProject, serializeProject } from "@laserx/project-format";
import { it } from "vitest";

import { benchFixtures, invalidFixtures, type BenchFixture } from "../src/fixtures.js";
import {
  buildScene,
  convertToThree,
  describeProject,
  measureAnalysis,
} from "../src/pipeline.js";
import { round, summarize, type SampleStatistics } from "../src/stats.js";

const WARMUP = 3;
/**
 * Nearest-rank p95 needs enough samples to be distinct from the maximum:
 * `ceil(0.95 * 20) = 19`, so p95 is the 19th of 20 rather than the 20th. At 12
 * samples `ceil(0.95 * 12) = 12` and every reported p95 silently duplicated max.
 */
const SAMPLES = 20;
const INVALID_SAMPLES = 5;

const now = (): number => Number(process.hrtime.bigint()) / 1e6;

interface RawSamples {
  parseMs: number[];
  analysisMs: number[];
  normalizingMs: number[];
  topologyMs: number[];
  spacingMs: number[];
  classifyingMs: number[];
  sceneMs: number[];
  threeMs: number[];
}

interface FixtureResult {
  key: string;
  description: string;
  shape: ReturnType<typeof describeProject>;
  analysisStatus: "complete" | "ambiguous";
  issueCodes: string[];
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
  spacingShareOfAnalysis: number;
  raw: RawSamples;
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

function measureFixture(fixture: BenchFixture, samples: number): FixtureResult {
  const serialized = serializeProject(fixture.project);

  for (let run = 0; run < WARMUP; run += 1) {
    const warm = parseProject(serialized);
    const analysis = measureAnalysis(warm.document);
    convertToThree(buildScene(warm.document, analysis.summary));
  }

  const raw: RawSamples = {
    parseMs: [],
    analysisMs: [],
    normalizingMs: [],
    topologyMs: [],
    spacingMs: [],
    classifyingMs: [],
    sceneMs: [],
    threeMs: [],
  };
  let geometries = 0;
  let vertices = 0;
  let issues = 0;
  let regions = 0;
  let analysisStatus: "complete" | "ambiguous" = "complete";
  let issueCodes: string[] = [];
  let shape = describeProject(
    fixture.project,
    measureAnalysis(fixture.project.document).summary,
  );

  for (let run = 0; run < samples; run += 1) {
    const parseStart = now();
    const project = parseProject(serialized);
    raw.parseMs.push(now() - parseStart);

    const analysis = measureAnalysis(project.document);
    raw.analysisMs.push(analysis.phases.totalMs);
    raw.normalizingMs.push(analysis.phases.normalizingMs);
    raw.topologyMs.push(analysis.phases.topologyMs);
    raw.spacingMs.push(analysis.phases.spacingMs);
    raw.classifyingMs.push(analysis.phases.classifyingMs);

    const sceneStart = now();
    const scene = buildScene(project.document, analysis.summary);
    raw.sceneMs.push(now() - sceneStart);

    const threeStart = now();
    const converted = convertToThree(scene);
    raw.threeMs.push(now() - threeStart);

    geometries = converted.geometries;
    vertices = converted.vertices;
    issues = analysis.summary.issues.length;
    regions = analysis.summary.regions.length;
    analysisStatus = analysis.summary.status;
    issueCodes = [...new Set(analysis.summary.issues.map((issue) => issue.code))].sort();
    shape = describeProject(project, analysis.summary);
  }

  // Round once, then derive every published statistic from the rounded arrays.
  // Summarizing the unrounded values and publishing rounded raw would make the
  // artifact internally inconsistent — a median of rounded samples is not always
  // the rounded median — and the whole point of committing raw data is that a
  // reviewer can recompute the summary from it.
  const roundAll = (values: number[]): number[] => values.map((value) => round(value));
  const rounded: RawSamples = {
    parseMs: roundAll(raw.parseMs),
    analysisMs: roundAll(raw.analysisMs),
    normalizingMs: roundAll(raw.normalizingMs),
    topologyMs: roundAll(raw.topologyMs),
    spacingMs: roundAll(raw.spacingMs),
    classifyingMs: roundAll(raw.classifyingMs),
    sceneMs: roundAll(raw.sceneMs),
    threeMs: roundAll(raw.threeMs),
  };
  const medianOf = (values: number[]): number => round(summarize(values).medianMs);
  const analysisMedian = summarize(rounded.analysisMs).medianMs;
  const spacing = medianOf(rounded.spacingMs);

  return {
    key: fixture.key,
    description: fixture.description,
    shape,
    analysisStatus,
    issueCodes,
    geometries,
    vertices,
    issues,
    regions,
    parse: roundStats(summarize(rounded.parseMs)),
    analysis: roundStats(summarize(rounded.analysisMs)),
    scene: roundStats(summarize(rounded.sceneMs)),
    three: roundStats(summarize(rounded.threeMs)),
    analysisPhasesMedianMs: {
      normalizing: medianOf(rounded.normalizingMs),
      topology: medianOf(rounded.topologyMs),
      spacing,
      classifying: medianOf(rounded.classifyingMs),
    },
    // The only measured saving that preserves every ambiguity check: the
    // manufacturing-advisory spacing phase. Every check in the topology phase
    // feeds the ambiguity flag that region classification depends on, so
    // topology is not discardable and no larger saving is claimed.
    spacingShareOfAnalysis: analysisMedian === 0 ? 0 : round(spacing / analysisMedian, 4),
    raw: rounded,
  };
}

async function main(): Promise<void> {
  const scaling = (await benchFixtures()).map((fixture) => measureFixture(fixture, SAMPLES));
  // The invalid fixtures are cheap and are recorded alongside the timings so the
  // scaling numbers are provably taken from geometry the analysis could resolve.
  const invalid = invalidFixtures().map((fixture) => measureFixture(fixture, INVALID_SAMPLES));

  for (const result of [...scaling, ...invalid]) {
    process.stdout.write(
      [
        result.key.padEnd(28),
        `status=${result.analysisStatus.padEnd(9)}`,
        `objects=${String(result.shape.objects).padStart(4)}`,
        `points=${String(result.shape.contourPoints).padStart(6)}`,
        `segments=${String(result.shape.segments).padStart(6)}`,
        `analysis=${result.analysis.medianMs.toFixed(3)}ms`,
        `three=${result.three.medianMs.toFixed(3)}ms`,
        `shapes=${String(result.geometries)}`,
      ].join(" ") + "\n",
    );
  }

  const output = {
    generatedBy: "tools/m14-preview-bench",
    gate: "M14 G1",
    warmupRuns: WARMUP,
    samplesPerFixture: SAMPLES,
    invalidFixtureSamples: INVALID_SAMPLES,
    environment: {
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
      cpus: process.env["PROCESSOR_IDENTIFIER"] ?? "unknown",
    },
    notes:
      "Scene assembly and Three conversion run through a tool-local harness matching the accepted Issue #34 contract; region topology and its ambiguity flag come from the production @laserx/cutability analysis. Every summary statistic is derived from the committed raw arrays.",
    fixtures: scaling,
    invalidFixtures: invalid,
  };

  const target = resolve(
    import.meta.dirname,
    "../../../docs/experiments/m14-physical-3d-preview/g1-results.json",
  );
  await writeFile(target, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  process.stdout.write(`\nWrote ${target}\n`);
}

it("measures M14 G1 physical-preview scaling", async () => {
  await main();
});
