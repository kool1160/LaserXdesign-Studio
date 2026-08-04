/**
 * Sample statistics for the M14 G1 measurements.
 *
 * Conventions are deliberately the same as the accepted Issue #34 research so
 * the two evidence sets can be compared directly: conventional median (average
 * of the two middle values for an even count) and nearest-rank p95.
 */

export interface SampleStatistics {
  samples: number;
  minMs: number;
  medianMs: number;
  p95Ms: number;
  maxMs: number;
}

export function median(values: readonly number[]): number {
  if (values.length === 0) throw new Error("median requires at least one sample");
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/** Nearest-rank p95: the smallest value at or above the 95th percentile position. */
export function p95(values: readonly number[]): number {
  if (values.length === 0) throw new Error("p95 requires at least one sample");
  const sorted = [...values].sort((left, right) => left - right);
  const rank = Math.ceil(0.95 * sorted.length);
  return sorted[Math.min(rank, sorted.length) - 1] ?? 0;
}

export function summarize(values: readonly number[]): SampleStatistics {
  if (values.length === 0) throw new Error("summarize requires at least one sample");
  return {
    samples: values.length,
    minMs: Math.min(...values),
    medianMs: median(values),
    p95Ms: p95(values),
    maxMs: Math.max(...values),
  };
}

export const round = (value: number, digits = 4): number =>
  Number.parseFloat(value.toFixed(digits));
