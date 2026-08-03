import { describe, expect, it } from "vitest";

import { percentile, runSampled, summarize } from "../bench/stats.mjs";

describe("percentile", () => {
  it("uses nearest-rank, always returning an observed sample", () => {
    const samples = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(percentile(samples, 0.5)).toBe(50);
    expect(percentile(samples, 0.95)).toBe(100);
    expect(percentile(samples, 1)).toBe(100);
    // Never interpolates a value that was not measured.
    expect(samples).toContain(percentile(samples, 0.73));
  });

  it("does not depend on input ordering and does not mutate the input", () => {
    const samples = [5, 1, 4, 2, 3];
    const before = [...samples];
    expect(percentile(samples, 0.5)).toBe(3);
    expect(samples).toEqual(before);
  });

  it("rejects an empty sample set and out-of-range fractions", () => {
    expect(() => percentile([], 0.5)).toThrow("at least one sample");
    expect(() => percentile([1], 0)).toThrow("fraction");
    expect(() => percentile([1], 1.5)).toThrow("fraction");
  });
});

describe("summarize", () => {
  it("reports count, min, median, p95, max, and mean", () => {
    expect(summarize([4, 1, 3, 2])).toEqual({
      sampleCount: 4,
      minMs: 1,
      medianMs: 2,
      p95Ms: 4,
      maxMs: 4,
      meanMs: 2.5,
    });
  });

  it("handles a single sample without inventing spread", () => {
    expect(summarize([7])).toEqual({
      sampleCount: 1,
      minMs: 7,
      medianMs: 7,
      p95Ms: 7,
      maxMs: 7,
      meanMs: 7,
    });
  });
});

describe("runSampled", () => {
  it("discards warmup runs and times only the sampled runs", () => {
    let calls = 0;
    let clock = 0;
    // Each timed run advances the injected clock by 2ms.
    const result = runSampled(
      () => {
        calls += 1;
        clock += 1;
      },
      { warmupRuns: 3, sampleRuns: 4, now: () => clock },
    );

    expect(calls).toBe(7); // 3 warmup + 4 sampled
    expect(result.warmupRuns).toBe(3);
    expect(result.sampleCount).toBe(4);
    expect(result.samples).toHaveLength(4);
    expect(result.minMs).toBe(1);
    expect(result.maxMs).toBe(1);
  });

  it("returns per-sample values alongside the summary for auditability", () => {
    let clock = 0;
    const durations = [5, 1, 3, 9];
    const result = runSampled(
      (index) => {
        clock += durations[index] ?? 0;
      },
      { warmupRuns: 0, sampleRuns: 4, now: () => clock },
    );
    expect(result.samples).toEqual([5, 1, 3, 9]);
    expect(result.minMs).toBe(1);
    expect(result.maxMs).toBe(9);
    expect(result.medianMs).toBe(3);
  });
});
