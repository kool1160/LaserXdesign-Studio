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

export function percentile(samples: readonly number[], fraction: number): number;
export function summarize(samples: readonly number[]): SampleSummary;
export function runSampled(
  operation: (index: number) => void,
  options?: RunSampledOptions,
): SampledRun;
