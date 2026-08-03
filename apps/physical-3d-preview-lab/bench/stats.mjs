/**
 * Pure sampling/statistics helpers shared by the Node and browser Phase 3
 * benchmark harnesses. Plain `.mjs` (with a sibling `.d.mts`) so the
 * Playwright driver and the Vitest-hosted Node benchmark can both import
 * the identical implementation instead of duplicating it.
 */

/**
 * Nearest-rank percentile. Chosen over interpolation because it always
 * returns an actually-observed sample, which is honest at the small sample
 * counts a local benchmark can afford — an interpolated p95 would invent a
 * value that was never measured.
 */
export function percentile(samples, fraction) {
  if (samples.length === 0) throw new Error("percentile requires at least one sample.");
  if (!(fraction > 0 && fraction <= 1)) throw new Error("fraction must be in (0, 1].");
  const sorted = [...samples].sort((left, right) => left - right);
  const rank = Math.ceil(fraction * sorted.length);
  return sorted[Math.min(rank, sorted.length) - 1];
}

export function summarize(samples) {
  if (samples.length === 0) throw new Error("summarize requires at least one sample.");
  const sorted = [...samples].sort((left, right) => left - right);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  return {
    sampleCount: sorted.length,
    minMs: round(sorted[0]),
    medianMs: round(percentile(sorted, 0.5)),
    p95Ms: round(percentile(sorted, 0.95)),
    maxMs: round(sorted[sorted.length - 1]),
    meanMs: round(total / sorted.length),
  };
}

/** Fixed 4-decimal rounding keeps JSON output stable and avoids implying more precision than measured. */
function round(value) {
  return Math.round(value * 10_000) / 10_000;
}

/**
 * Runs `operation` `warmupRuns` times (discarded, to let the JIT settle and
 * caches fill) then `sampleRuns` times, timing only the sampled runs.
 * `now` is injectable so tests can drive it deterministically.
 */
export function runSampled(operation, { warmupRuns = 5, sampleRuns = 30, now = defaultNow } = {}) {
  for (let index = 0; index < warmupRuns; index += 1) {
    operation(index);
  }
  const samples = [];
  for (let index = 0; index < sampleRuns; index += 1) {
    const start = now();
    operation(index);
    samples.push(now() - start);
  }
  return { ...summarize(samples), warmupRuns, samples: samples.map(round) };
}

function defaultNow() {
  return performance.now();
}
