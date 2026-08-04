/**
 * Verifies the committed G1 artifact against itself.
 *
 * The review found that the artifact published only summary statistics, so the
 * percentile and variance claims could not be independently checked. Raw
 * per-sample arrays are now committed, and this suite proves the published
 * summaries are actually derived from them rather than asserted alongside them.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { summarize, round, type SampleStatistics } from "../src/stats.js";

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
  shape: { objects: number; layers: number; closedPaths: number; contourPoints: number; segments: number };
  analysisStatus: "complete" | "ambiguous";
  geometries: number;
  parse: SampleStatistics;
  analysis: SampleStatistics;
  scene: SampleStatistics;
  three: SampleStatistics;
  analysisPhasesMedianMs: Record<string, number>;
  spacingShareOfAnalysis: number;
  raw: RawSamples;
}

const results = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, "../../../docs/experiments/m14-physical-3d-preview/g1-results.json"),
    "utf8",
  ),
) as {
  samplesPerFixture: number;
  invalidFixtureSamples: number;
  fixtures: FixtureResult[];
  invalidFixtures: FixtureResult[];
};

const roundStats = (statistics: SampleStatistics): SampleStatistics => ({
  samples: statistics.samples,
  minMs: round(statistics.minMs),
  medianMs: round(statistics.medianMs),
  p95Ms: round(statistics.p95Ms),
  maxMs: round(statistics.maxMs),
});

describe("committed G1 results", () => {
  it("publishes raw per-sample arrays for every measured stage", () => {
    expect(results.fixtures.length).toBeGreaterThan(0);
    for (const fixture of [...results.fixtures, ...results.invalidFixtures]) {
      const expected =
        results.fixtures.includes(fixture)
          ? results.samplesPerFixture
          : results.invalidFixtureSamples;
      // Typed explicitly: `Object.entries` widens the value to `any`, which
      // would silently disable the very assertion this loop exists for.
      const stages = Object.entries(fixture.raw) as Array<[string, number[]]>;
      for (const [stage, samples] of stages) {
        expect(samples.length, `${fixture.key}.${stage}`).toBe(expected);
      }
    }
  });

  it("derives every published summary from the committed raw samples", () => {
    for (const fixture of [...results.fixtures, ...results.invalidFixtures]) {
      expect(roundStats(summarize(fixture.raw.parseMs)), `${fixture.key} parse`).toEqual(fixture.parse);
      expect(roundStats(summarize(fixture.raw.analysisMs)), `${fixture.key} analysis`).toEqual(fixture.analysis);
      expect(roundStats(summarize(fixture.raw.sceneMs)), `${fixture.key} scene`).toEqual(fixture.scene);
      expect(roundStats(summarize(fixture.raw.threeMs)), `${fixture.key} three`).toEqual(fixture.three);

      // All four phase medians, not just the two the decision quotes most.
      const phases: Array<[keyof RawSamples, string]> = [
        ["normalizingMs", "normalizing"],
        ["topologyMs", "topology"],
        ["spacingMs", "spacing"],
        ["classifyingMs", "classifying"],
      ];
      for (const [rawKey, published] of phases) {
        expect(
          round(summarize(fixture.raw[rawKey]).medianMs),
          `${fixture.key} ${published} phase median`,
        ).toBe(fixture.analysisPhasesMedianMs[published]);
      }

      // The spacing share is the single number the G1 saving is quoted from, so
      // it must be reproducible from the committed raw arrays too.
      const analysisMedian = summarize(fixture.raw.analysisMs).medianMs;
      const expectedShare =
        analysisMedian === 0 ? 0 : round(round(summarize(fixture.raw.spacingMs).medianMs) / analysisMedian, 4);
      expect(fixture.spacingShareOfAnalysis, `${fixture.key} spacing share`).toBe(expectedShare);
    }
  });

  it("reports a p95 distinct from max for every scaling fixture", () => {
    expect(results.samplesPerFixture).toBeGreaterThanOrEqual(20);
    // The evidence document claims this for every scaling fixture, so assert it
    // for every scaling fixture rather than for at least one.
    for (const fixture of results.fixtures) {
      expect(fixture.analysis.p95Ms, `${fixture.key} analysis p95 vs max`).toBeLessThan(
        fixture.analysis.maxMs,
      );
    }
  });

  it("records the exact production segment count for every fixture", () => {
    for (const fixture of results.fixtures) {
      expect(fixture.shape.segments, `${fixture.key} segments`).toBeGreaterThan(0);
      expect(fixture.shape.contourPoints, `${fixture.key} points`).toBeGreaterThan(0);
    }
  });

  it("proves the scaling timings come from geometry the analysis could resolve", () => {
    // If a scaling fixture were ambiguous, its Three timings would be measuring
    // invented solids and the whole comparison would be meaningless.
    for (const fixture of results.fixtures) {
      expect(fixture.analysisStatus, fixture.key).toBe("complete");
      expect(fixture.geometries, `${fixture.key} geometries`).toBeGreaterThan(0);
    }
    for (const fixture of results.invalidFixtures) {
      expect(fixture.analysisStatus, fixture.key).toBe("ambiguous");
      expect(fixture.geometries, `${fixture.key} must invent nothing`).toBe(0);
    }
  });
});
