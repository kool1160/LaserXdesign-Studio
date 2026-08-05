/**
 * Pure guided-workflow state machine (M15 G0, ADR 0027).
 *
 * Deliberately framework-agnostic: no React, no DOM, no Electron, no `node:`
 * import, and no browser global. Proven mechanically by
 * `scripts/guided-workflow-architecture-audit.mjs` rather than left to
 * convention, so a later gate cannot accidentally couple guided-workflow state
 * to Electron privilege, to a specific UI framework, or to the DOM.
 *
 * This module owns no project data. It never receives, reads, or returns a
 * `LaserxProject` or any authoritative editor state -- the non-mutation
 * guarantee for guided workflows holds by construction, not by discipline,
 * because there is nothing here to mutate.
 */

export type GuidedGoal = "create-first-sign" | "import-own-design" | "describe-with-ai";

/**
 * `canceled` is deliberately absent: `cancel` restores the pre-guided state,
 * which is exactly `idle`. A status the reducer can never produce would be a
 * state the rest of the system must handle but can never observe.
 */
export type GuidedWorkflowStatus = "idle" | "active" | "completed" | "dismissed" | "failed";

const TERMINAL_STATUSES = ["completed", "dismissed", "failed"] as const;

export type TerminalGuidedWorkflowStatus = (typeof TERMINAL_STATUSES)[number];

export function isTerminalStatus(status: GuidedWorkflowStatus): status is TerminalGuidedWorkflowStatus {
  return (TERMINAL_STATUSES as readonly GuidedWorkflowStatus[]).includes(status);
}

/**
 * The ordered step set for one goal.
 *
 * `definitionVersion` exists so a persisted snapshot taken against an older
 * step set is detected rather than silently reinterpreted: step *ids* are
 * stable, but their meaning and ordering belong to a specific definition.
 */
export interface GuidedWorkflowDefinition {
  readonly goal: GuidedGoal;
  readonly definitionVersion: number;
  /** Opaque, stable step identifiers in order. Content belongs to G1. */
  readonly stepIds: readonly string[];
}

export interface GuidedWorkflowState {
  readonly status: GuidedWorkflowStatus;
  readonly definition: GuidedWorkflowDefinition | null;
  /**
   * The stable id of the step in progress, not an array index. An index is
   * only meaningful against one exact step set; an id survives a definition
   * gaining or reordering steps, and makes a stale snapshot detectable
   * instead of silently pointing at a different step.
   */
  readonly currentStepId: string | null;
  readonly completedStepIds: readonly string[];
  readonly skippedStepIds: readonly string[];
  readonly failureReason: string | null;
}

export const initialGuidedWorkflowState: GuidedWorkflowState = {
  status: "idle",
  definition: null,
  currentStepId: null,
  completedStepIds: [],
  skippedStepIds: [],
  failureReason: null,
};

/**
 * The persisted record of an interrupted workflow.
 *
 * Carries everything needed to reconstruct the in-progress state truthfully:
 * which goal, against which step-set version, which exact step was open, and
 * which steps were already completed or skipped. Without the version and the
 * step id, a restart could only guess.
 */
export interface OnboardingWorkflowSnapshot {
  readonly goal: GuidedGoal;
  readonly definitionVersion: number;
  readonly currentStepId: string;
  readonly completedStepIds: readonly string[];
  readonly skippedStepIds: readonly string[];
}

/**
 * Shape locked by ADR 0027 for `userData` persistence. The store
 * implementation, its IPC surface, and its wiring are G1 work; only the shape
 * is fixed here so G1 builds against an already-agreed contract.
 */
export interface OnboardingPreferences {
  readonly schemaVersion: 1;
  readonly completedGoals: readonly GuidedGoal[];
  readonly dismissed: boolean;
  readonly activeWorkflow: OnboardingWorkflowSnapshot | null;
}

export const initialOnboardingPreferences: OnboardingPreferences = {
  schemaVersion: 1,
  completedGoals: [],
  dismissed: false,
  activeWorkflow: null,
};

export type GuidedWorkflowAction =
  | { type: "start"; definition: GuidedWorkflowDefinition }
  | { type: "resume"; definition: GuidedWorkflowDefinition; snapshot: OnboardingWorkflowSnapshot }
  | { type: "advance" }
  | { type: "back" }
  | { type: "skip-step" }
  | { type: "dismiss" }
  | { type: "replay" }
  | { type: "cancel" }
  | { type: "fail"; reason: string };

export type GuidedWorkflowActionType = GuidedWorkflowAction["type"];

/**
 * The allowed source statuses for every action.
 *
 * This is the contract that makes a stale or out-of-sequence event safe: an
 * action arriving from a status not listed here is a no-op returning the same
 * state reference, so a late `start` cannot reset a journey in progress and a
 * late `resume` cannot overwrite a terminal record. Leaving a journey or
 * restarting one must be an explicit `dismiss`/`cancel`/`replay` decision.
 */
export const ALLOWED_SOURCE_STATUSES: Readonly<
  Record<GuidedWorkflowActionType, readonly GuidedWorkflowStatus[]>
> = {
  start: ["idle"],
  resume: ["idle"],
  advance: ["active"],
  back: ["active"],
  "skip-step": ["active"],
  dismiss: ["active"],
  replay: ["completed", "dismissed", "failed"],
  // Always available, from every status -- the guaranteed exit that makes
  // "no trapped states" structural rather than per-screen.
  cancel: ["idle", "active", "completed", "dismissed", "failed"],
  fail: ["active"],
};

function stepIndexOf(definition: GuidedWorkflowDefinition, stepId: string | null): number {
  return stepId === null ? -1 : definition.stepIds.indexOf(stepId);
}

function withId(ids: readonly string[], stepId: string | null): readonly string[] {
  if (stepId === null || ids.includes(stepId)) return ids;
  return [...ids, stepId];
}

function withoutId(ids: readonly string[], stepId: string | null): readonly string[] {
  return stepId === null ? ids : ids.filter((id) => id !== stepId);
}

function startedState(definition: GuidedWorkflowDefinition): GuidedWorkflowState {
  const firstStepId = definition.stepIds[0];
  if (firstStepId === undefined) {
    return {
      ...initialGuidedWorkflowState,
      status: "failed",
      definition,
      failureReason: "A guided workflow requires at least one step.",
    };
  }
  return {
    status: "active",
    definition,
    currentStepId: firstStepId,
    completedStepIds: [],
    skippedStepIds: [],
    failureReason: null,
  };
}

/**
 * Whether a persisted snapshot can be trusted against a step definition.
 *
 * Fail-closed by design: a snapshot from a different goal, a different step-set
 * version, or naming a step the definition no longer contains cannot be
 * repaired into "probably this step" without inventing progress the user never
 * made. Callers restart the goal instead.
 */
export function canResumeSnapshot(
  definition: GuidedWorkflowDefinition,
  snapshot: OnboardingWorkflowSnapshot,
): boolean {
  if (snapshot.goal !== definition.goal) return false;
  if (snapshot.definitionVersion !== definition.definitionVersion) return false;
  if (!definition.stepIds.includes(snapshot.currentStepId)) return false;
  const known = (id: string): boolean => definition.stepIds.includes(id);
  return snapshot.completedStepIds.every(known) && snapshot.skippedStepIds.every(known);
}

/**
 * Captures the persistable record of an in-progress workflow, or `null` when
 * there is nothing meaningful to resume (idle, terminal, or no open step).
 */
export function toWorkflowSnapshot(state: GuidedWorkflowState): OnboardingWorkflowSnapshot | null {
  if (state.status !== "active" || state.definition === null || state.currentStepId === null) {
    return null;
  }
  return {
    goal: state.definition.goal,
    definitionVersion: state.definition.definitionVersion,
    currentStepId: state.currentStepId,
    completedStepIds: state.completedStepIds,
    skippedStepIds: state.skippedStepIds,
  };
}

/**
 * Total: every (state, action) pair returns a value and never throws. An
 * action whose source status is not allowed by `ALLOWED_SOURCE_STATUSES`
 * returns the *same state reference*, so an out-of-sequence event from a stale
 * UI cannot desynchronize, clobber, or crash the caller.
 */
export function reduceGuidedWorkflow(
  state: GuidedWorkflowState,
  action: GuidedWorkflowAction,
): GuidedWorkflowState {
  if (!ALLOWED_SOURCE_STATUSES[action.type].includes(state.status)) {
    return state;
  }

  switch (action.type) {
    case "cancel": {
      return initialGuidedWorkflowState;
    }

    case "start": {
      return startedState(action.definition);
    }

    case "resume": {
      if (!canResumeSnapshot(action.definition, action.snapshot)) {
        // Fail closed to idle rather than guessing a step: a wrong guess would
        // silently claim progress the user never made.
        return initialGuidedWorkflowState;
      }
      return {
        status: "active",
        definition: action.definition,
        currentStepId: action.snapshot.currentStepId,
        completedStepIds: action.snapshot.completedStepIds,
        skippedStepIds: action.snapshot.skippedStepIds,
        failureReason: null,
      };
    }

    case "replay": {
      if (state.definition === null) return state;
      return startedState(state.definition);
    }

    case "advance":
    case "skip-step": {
      const definition = state.definition;
      if (definition === null) return state;
      const index = stepIndexOf(definition, state.currentStepId);
      if (index < 0) return state;

      const skipping = action.type === "skip-step";
      // A step is either completed or skipped, never recorded as both -- the
      // summary a user is shown after the journey has to be truthful.
      const completedStepIds = skipping
        ? withoutId(state.completedStepIds, state.currentStepId)
        : withId(state.completedStepIds, state.currentStepId);
      const skippedStepIds = skipping
        ? withId(state.skippedStepIds, state.currentStepId)
        : withoutId(state.skippedStepIds, state.currentStepId);

      const nextStepId = definition.stepIds[index + 1];
      if (nextStepId === undefined) {
        return { ...state, status: "completed", completedStepIds, skippedStepIds };
      }
      return { ...state, currentStepId: nextStepId, completedStepIds, skippedStepIds };
    }

    case "back": {
      const definition = state.definition;
      if (definition === null) return state;
      const index = stepIndexOf(definition, state.currentStepId);
      if (index <= 0) return state;
      const previousStepId = definition.stepIds[index - 1];
      if (previousStepId === undefined) return state;
      return { ...state, currentStepId: previousStepId };
    }

    case "dismiss": {
      return { ...state, status: "dismissed" };
    }

    case "fail": {
      return { ...state, status: "failed", failureReason: action.reason };
    }

    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
