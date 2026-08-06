/**
 * Pure guided-workflow state machine (M15 G0, ADR 0027).
 *
 * Deliberately framework-agnostic: no React, no DOM, no Electron, no `node:`
 * import, and no browser global. Both halves are mechanically enforced rather
 * than left to convention, so a later gate cannot accidentally couple
 * guided-workflow state to Electron privilege, to a UI framework, or to the
 * DOM:
 *
 * - DOM and browser globals -- `apps/desktop/tsconfig.onboarding-pure.json`
 *   compiles this file alone against ES libraries with no ambient types, so
 *   any such reference fails to resolve (`pnpm audit:guided-workflow-types`);
 * - React/Electron/`node:` imports -- rejected by
 *   `scripts/guided-workflow-architecture-audit.mjs`, which a typecheck cannot
 *   do because those packages ship real type declarations.
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
   * Opaque identity for this run of a workflow, supplied by the caller and
   * replaced on every `start`, `resume`, and `replay`.
   *
   * A step id alone cannot make a stale event safe: cancelling and restarting,
   * or replaying, puts a new run on the same step id, so a delayed event from
   * the abandoned run would still match. The token is what distinguishes
   * "this step, this run" from "this step, some earlier run".
   */
  readonly runToken: string | null;
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
  runToken: null,
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

/**
 * Identity every step-scoped action must carry.
 *
 * `expectedStepId` is the step the user was actually looking at when the
 * action was produced; `runToken` is the run it belonged to. Both must match
 * live state or the action is ignored, so a duplicated Next cannot confirm the
 * *following* step, and a delayed Skip cannot skip a step the user never saw.
 */
export interface StepScopedAction {
  readonly expectedStepId: string;
  readonly runToken: string;
}

export type GuidedWorkflowAction =
  | { type: "start"; definition: GuidedWorkflowDefinition; runToken: string }
  | {
      type: "resume";
      definition: GuidedWorkflowDefinition;
      snapshot: OnboardingWorkflowSnapshot;
      runToken: string;
    }
  | ({ type: "advance" } & StepScopedAction)
  | ({ type: "back" } & StepScopedAction)
  | ({ type: "skip-step" } & StepScopedAction)
  | ({ type: "fail"; reason: string } & StepScopedAction)
  // Run-scoped rather than step-scoped: leaving the workflow is a decision
  // about the journey, not about one step, but it must still not apply to a
  // run the user already abandoned.
  | { type: "dismiss"; runToken: string }
  | { type: "replay"; runToken: string }
  // Deliberately global and unconditional: cancel is the guaranteed exit from
  // every state and always restores the same pre-guided state, so binding it
  // to identity could only ever make an escape hatch fail to work.
  | { type: "cancel" };

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

/**
 * Whether a step definition is well-formed enough to drive the reducer.
 *
 * Duplicate ids are not a cosmetic problem: step lookup resolves an id to its
 * *first* index, so `["a", "a", "b"]` would advance from the first `a` to the
 * second `a`, resolve that back to index 0, and never reach `b` or complete --
 * a permanently non-progressing "active" workflow, which is exactly the
 * trapped state this contract promises cannot exist. Blank ids have the same
 * effect through a different route, and a non-positive or fractional version
 * cannot order snapshots.
 */
export function isValidWorkflowDefinition(definition: GuidedWorkflowDefinition): boolean {
  if (!Number.isInteger(definition.definitionVersion) || definition.definitionVersion <= 0) {
    return false;
  }
  if (definition.stepIds.length === 0) return false;
  if (definition.stepIds.some((id) => typeof id !== "string" || id.trim() === "")) return false;
  return new Set(definition.stepIds).size === definition.stepIds.length;
}

/**
 * Detaches and freezes a list the state will own.
 *
 * TypeScript's `readonly` is erased at runtime, so storing a caller's array by
 * reference leaves live state aliased to a value the caller can still mutate
 * *after* validation has passed. A caller could hand over a valid
 * `["A", "B"]`, have it accepted, then assign `stepIds[1] = "A"` and recreate
 * exactly the non-progressing workflow the definition validator exists to
 * prevent. Copying makes the state's own value independent; freezing makes a
 * later attempt to mutate it throw in this module's strict-mode scope instead
 * of silently corrupting progress.
 */
function ownList(ids: readonly string[]): readonly string[] {
  return Object.freeze([...ids]);
}

function ownDefinition(definition: GuidedWorkflowDefinition): GuidedWorkflowDefinition {
  return Object.freeze({
    goal: definition.goal,
    definitionVersion: definition.definitionVersion,
    stepIds: ownList(definition.stepIds),
  });
}

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

/**
 * Whether a step-scoped action still describes the live step and run.
 *
 * This is what makes a duplicated or delayed event harmless. Without it,
 * `advance`/`back`/`skip-step`/`fail` were accepted whenever the workflow
 * merely happened to be active, so two Next events produced while step A was
 * on screen would confirm A *and then B* -- silently completing a step the
 * user never saw, and defeating the requirement that each guided step is
 * explicitly confirmed.
 */
function matchesLiveStep(state: GuidedWorkflowState, action: StepScopedAction): boolean {
  return (
    state.runToken !== null &&
    state.runToken === action.runToken &&
    state.currentStepId !== null &&
    state.currentStepId === action.expectedStepId
  );
}

function startedState(
  supplied: GuidedWorkflowDefinition,
  runToken: string,
): GuidedWorkflowState {
  // Validate the caller value, then keep an owned copy: validating a value the
  // caller can still mutate would only prove it was valid at one instant.
  const definition = ownDefinition(supplied);
  const firstStepId = definition.stepIds[0];
  if (!isValidWorkflowDefinition(definition) || firstStepId === undefined) {
    // Fail closed rather than entering an active workflow that cannot
    // progress: a malformed definition must be a visible failure, never a
    // silent dead end the user has to abandon.
    return {
      ...initialGuidedWorkflowState,
      status: "failed",
      definition,
      runToken,
      failureReason:
        "A guided workflow requires a positive version and at least one unique, non-blank step id.",
    };
  }
  return {
    status: "active",
    definition,
    runToken,
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
  if (!isValidWorkflowDefinition(definition)) return false;
  if (snapshot.goal !== definition.goal) return false;
  if (snapshot.definitionVersion !== definition.definitionVersion) return false;

  const currentIndex = definition.stepIds.indexOf(snapshot.currentStepId);
  if (currentIndex < 0) return false;

  // The reducer can only reach a step by processing every step before it, so
  // recorded progress must be *exactly* the prefix before the open step, each
  // step accounted for exactly once across completed and skipped.
  //
  // Requiring only "all progress lies behind the current step" is not enough:
  // it would accept {current: C, completed: [A]} for steps A/B/C, which claims
  // the user reached C without ever processing B -- a journey the reducer
  // cannot produce, and resuming it would silently skip a required step.
  //
  // This single comparison also subsumes the narrower checks it replaces: a
  // duplicate id, the same step in both lists, an unknown id, and the current
  // or a later step marked finished all break either the length or the
  // coverage test below.
  const prefix = definition.stepIds.slice(0, currentIndex);
  const progressIds = [...snapshot.completedStepIds, ...snapshot.skippedStepIds];
  if (progressIds.length !== prefix.length) return false;
  const progress = new Set(progressIds);
  if (progress.size !== progressIds.length) return false;
  return prefix.every((id) => progress.has(id));
}

/**
 * Captures the persistable record of an in-progress workflow, or `null` when
 * there is nothing meaningful to resume (idle, terminal, or no open step).
 */
export function toWorkflowSnapshot(state: GuidedWorkflowState): OnboardingWorkflowSnapshot | null {
  if (state.status !== "active" || state.definition === null || state.currentStepId === null) {
    return null;
  }
  // Detached: a caller mutating the returned snapshot must not reach back
  // into live progress.
  return Object.freeze({
    goal: state.definition.goal,
    definitionVersion: state.definition.definitionVersion,
    currentStepId: state.currentStepId,
    completedStepIds: ownList(state.completedStepIds),
    skippedStepIds: ownList(state.skippedStepIds),
  });
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
      return startedState(action.definition, action.runToken);
    }

    case "resume": {
      if (!canResumeSnapshot(action.definition, action.snapshot)) {
        // Fail closed to idle rather than guessing a step: a wrong guess would
        // silently claim progress the user never made.
        return initialGuidedWorkflowState;
      }
      return {
        status: "active",
        definition: ownDefinition(action.definition),
        runToken: action.runToken,
        currentStepId: action.snapshot.currentStepId,
        completedStepIds: ownList(action.snapshot.completedStepIds),
        skippedStepIds: ownList(action.snapshot.skippedStepIds),
        failureReason: null,
      };
    }

    case "replay": {
      if (state.definition === null) return state;
      // A fresh token, so any event still in flight from the finished run
      // cannot apply to the restarted one.
      return startedState(state.definition, action.runToken);
    }

    case "advance":
    case "skip-step": {
      if (!matchesLiveStep(state, action)) return state;
      const definition = state.definition;
      if (definition === null) return state;
      const index = stepIndexOf(definition, state.currentStepId);
      if (index < 0) return state;

      const skipping = action.type === "skip-step";
      // A step is either completed or skipped, never recorded as both -- the
      // summary a user is shown after the journey has to be truthful.
      const completedStepIds = ownList(
        skipping
          ? withoutId(state.completedStepIds, state.currentStepId)
          : withId(state.completedStepIds, state.currentStepId),
      );
      const skippedStepIds = ownList(
        skipping
          ? withId(state.skippedStepIds, state.currentStepId)
          : withoutId(state.skippedStepIds, state.currentStepId),
      );

      const nextStepId = definition.stepIds[index + 1];
      if (nextStepId === undefined) {
        return { ...state, status: "completed", completedStepIds, skippedStepIds };
      }
      return { ...state, currentStepId: nextStepId, completedStepIds, skippedStepIds };
    }

    case "back": {
      if (!matchesLiveStep(state, action)) return state;
      const definition = state.definition;
      if (definition === null) return state;
      const index = stepIndexOf(definition, state.currentStepId);
      if (index <= 0) return state;
      const previousIndex = index - 1;
      const previousStepId = definition.stepIds[previousIndex];
      if (previousStepId === undefined) return state;

      // Going back reopens the destination step and discards progress from
      // that step forward. Leaving later steps marked complete would let an
      // interrupted journey resume claiming work the user is currently
      // redoing is already finished -- and if they change an earlier decision
      // such as material or text, that later "completion" is simply false.
      const stillBehind = (id: string): boolean =>
        definition.stepIds.indexOf(id) < previousIndex;
      return {
        ...state,
        currentStepId: previousStepId,
        completedStepIds: ownList(state.completedStepIds.filter(stillBehind)),
        skippedStepIds: ownList(state.skippedStepIds.filter(stillBehind)),
      };
    }

    case "dismiss": {
      if (state.runToken === null || state.runToken !== action.runToken) return state;
      return { ...state, status: "dismissed" };
    }

    case "fail": {
      if (!matchesLiveStep(state, action)) return state;
      return { ...state, status: "failed", failureReason: action.reason };
    }

    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
