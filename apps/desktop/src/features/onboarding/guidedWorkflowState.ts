/**
 * Pure guided-workflow state machine (M15 G0, ADR 0027).
 *
 * Deliberately framework-agnostic: no React, no DOM, no Electron, no `node:`
 * import. Proven mechanically by `scripts/guided-workflow-architecture-audit.mjs`
 * rather than left to convention, so a later gate cannot accidentally couple
 * guided-workflow state to Electron privilege or to a specific UI framework.
 *
 * This module owns no project data. It never receives, reads, or returns a
 * `LaserxProject` or any authoritative editor state -- the non-mutation
 * guarantee for guided workflows holds by construction, not by discipline,
 * because there is nothing here to mutate.
 */

export type GuidedGoal = "create-first-sign" | "import-own-design" | "describe-with-ai";

export type GuidedWorkflowStatus =
  | "idle"
  | "active"
  | "skipped"
  | "completed"
  | "canceled"
  | "failed";

export interface GuidedWorkflowState {
  readonly status: GuidedWorkflowStatus;
  readonly goal: GuidedGoal | null;
  /** Opaque step identifiers in order. Content and meaning belong to G1. */
  readonly steps: readonly string[];
  /** -1 while idle; otherwise an index into `steps`. */
  readonly stepIndex: number;
  readonly visitedStepIds: readonly string[];
  readonly completedStepIds: readonly string[];
  readonly failureReason: string | null;
}

export const initialGuidedWorkflowState: GuidedWorkflowState = {
  status: "idle",
  goal: null,
  steps: [],
  stepIndex: -1,
  visitedStepIds: [],
  completedStepIds: [],
  failureReason: null,
};

export type GuidedWorkflowAction =
  | { type: "start"; goal: GuidedGoal; steps: readonly string[] }
  | { type: "advance" }
  | { type: "back" }
  | { type: "skip" }
  | { type: "resume"; goal: GuidedGoal; steps: readonly string[]; stepIndex: number }
  | { type: "replay" }
  | { type: "cancel" }
  | { type: "fail"; reason: string };

function currentStepId(state: GuidedWorkflowState): string | null {
  return state.stepIndex >= 0 && state.stepIndex < state.steps.length
    ? (state.steps[state.stepIndex] ?? null)
    : null;
}

function withVisited(ids: readonly string[], stepId: string | null): readonly string[] {
  if (stepId === null || ids.includes(stepId)) return ids;
  return [...ids, stepId];
}

/**
 * Total: every (state, action) pair returns a value, never throws. This is
 * the load-bearing property behind "no trapped state" -- a reducer that can
 * throw would let a malformed action strand the caller with no way forward.
 *
 * `cancel` is intentionally handled first and unconditionally: it is always
 * available from every state and always returns exactly
 * `initialGuidedWorkflowState`, which is the "pre-guided state" ADR 0027
 * requires cancel to restore. Every other action is a no-op (returns `state`
 * unchanged, same reference) outside the status it is meaningful in, rather
 * than an error -- so an out-of-sequence action from, say, a stale UI event
 * cannot desynchronize or crash the caller either.
 */
export function reduceGuidedWorkflow(
  state: GuidedWorkflowState,
  action: GuidedWorkflowAction,
): GuidedWorkflowState {
  if (action.type === "cancel") {
    return initialGuidedWorkflowState;
  }

  switch (action.type) {
    case "start": {
      if (action.steps.length === 0) {
        return {
          ...initialGuidedWorkflowState,
          status: "failed",
          goal: action.goal,
          failureReason: "A guided workflow requires at least one step.",
        };
      }
      return {
        status: "active",
        goal: action.goal,
        steps: action.steps,
        stepIndex: 0,
        visitedStepIds: withVisited([], action.steps[0] ?? null),
        completedStepIds: [],
        failureReason: null,
      };
    }

    case "resume": {
      const clampedIndex = Math.min(Math.max(action.stepIndex, 0), action.steps.length - 1);
      if (action.steps.length === 0) {
        return {
          ...initialGuidedWorkflowState,
          status: "failed",
          goal: action.goal,
          failureReason: "A guided workflow requires at least one step.",
        };
      }
      return {
        status: "active",
        goal: action.goal,
        steps: action.steps,
        stepIndex: clampedIndex,
        visitedStepIds: withVisited([], action.steps[clampedIndex] ?? null),
        completedStepIds: [],
        failureReason: null,
      };
    }

    case "replay": {
      if (state.goal === null || state.steps.length === 0) return state;
      return {
        status: "active",
        goal: state.goal,
        steps: state.steps,
        stepIndex: 0,
        visitedStepIds: withVisited([], state.steps[0] ?? null),
        completedStepIds: [],
        failureReason: null,
      };
    }

    case "advance": {
      if (state.status !== "active") return state;
      const finishedStepId = currentStepId(state);
      const completedStepIds = withVisited(state.completedStepIds, finishedStepId);
      const isLastStep = state.stepIndex >= state.steps.length - 1;
      if (isLastStep) {
        return { ...state, status: "completed", completedStepIds };
      }
      const nextIndex = state.stepIndex + 1;
      return {
        ...state,
        stepIndex: nextIndex,
        completedStepIds,
        visitedStepIds: withVisited(state.visitedStepIds, state.steps[nextIndex] ?? null),
      };
    }

    case "back": {
      if (state.status !== "active" || state.stepIndex <= 0) return state;
      return { ...state, stepIndex: state.stepIndex - 1 };
    }

    case "skip": {
      if (state.status !== "active") return state;
      return { ...state, status: "skipped" };
    }

    case "fail": {
      if (state.status !== "active") return state;
      return { ...state, status: "failed", failureReason: action.reason };
    }

    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
