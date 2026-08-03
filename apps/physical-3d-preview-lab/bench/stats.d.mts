export interface SampleSummary {
  sampleCount: number;
  minMs: number;
  medianMs: number;
  p95Ms: number;
  maxMs: number;
  meanMs: number;
}

export interface SampledRun extends SampleSummary {
  warmupRuns: number;
  samples: number[];
}

export interface RunSampledOptions {
  warmupRuns?: number;
  sampleRuns?: number;
  now?: () => number;
}

/** Nearest-rank percentile; always returns an actually-observed sample. */
export function percentile(samples: readonly number[], fraction: number): number;
/** Middle value for odd counts, average of the two middle values for even counts. */
export function conventionalMedian(samples: readonly number[]): number;
/** `medianMs` is the conventional median; `p95Ms` remains nearest-rank. */
export function summarize(samples: readonly number[]): SampleSummary;
export function runSampled(
  operation: (index: number) => void,
  options?: RunSampledOptions,
): SampledRun;
