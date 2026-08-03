export interface ImmutabilityCheckedRun<TResult> {
  value: TResult;
  unchanged: boolean;
}

export function immutabilitySnapshot(project: unknown): string;

export function runWithImmutabilityCheck<TProject, TResult>(
  project: TProject,
  convert: (project: TProject) => TResult,
): ImmutabilityCheckedRun<TResult>;
