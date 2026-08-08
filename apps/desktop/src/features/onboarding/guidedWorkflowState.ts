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
 * Stable identities for the contextual explanations introduced in M15 G5.
 *
 * These are preference/progress keys only. The explanatory copy and its UI
 * placement stay in the presentation layer, while this pure module continues
 * to own no project or editor data.
 */
export type LearnTopic =
  | "physical-layers"
  | "material-thickness"
  | "cutability-findings"
  | "repair-groups"
  | "bridge-islands"
  | "physical-preview"
  | "export-output";

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
  /**
   * Which of `stepIds` may be bypassed with `skip-step`.
   *
   * Skip eligibility is locked here, in the definition, rather than left to
   * whichever caller happens to dispatch `skip-step` -- the locked M15
   * product direction requires most guided stages (cutability analysis, the
   * physical-3D checkpoint before export, any repair/decision stage with
   * unresolved blocking findings) to be mandatory, with only genuinely
   * optional explanations skippable. `isValidWorkflowDefinition` requires
   * this to be a known, duplicate-free subset of `stepIds`; `skip-step` for
   * a step outside it is a same-reference no-op (`isStepSkippable`).
   */
  readonly skippableStepIds: readonly string[];
  /**
   * Which of `stepIds` depend on transient in-memory feature state -- a
   * nullable preview slot (vector-import review, raster-trace acceptance,
   * AI-concept choice) or current analysis results -- that does not survive an
   * application restart.
   *
   * Resume never reopens such a step: its prerequisites are gone, so
   * reopening it would present a surface with nothing behind it. A snapshot
   * whose open step is transient instead recovers to the nearest earlier
   * non-transient step (`resolveResumeStepId`), and a definition whose
   * *first* step is transient simply cannot be resumed mid-run -- the goal
   * restarts. Like `skippableStepIds`, this is locked in the definition so
   * recovery is a contract, not a per-caller improvisation.
   */
  readonly transientStepIds: readonly string[];
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
   * The opaque identity of the *project* this run is guiding work in, bound
   * at `start`/`resume` and never changed for the life of the run.
   *
   * A run token scopes events to a run, but nothing about it says which
   * project the run is about. Without this, a later snapshot could pair the
   * run's completed prefix with another project's binding. The
   * `toWorkflowSnapshot` identity guard keys off this field.
   *
   * This persisted project id is deliberately NOT used to detect an open
   * project replacement. Save As and copied `.laserx` files retain it, so
   * reopening or replacing from one of those files may present the same id.
   * The edge-triggered `project-replaced` action (below) is the live-session
   * boundary and ends the run regardless of persisted identity.
   *
   * Deliberately the project identity, NOT the document identity: the
   * shipped `project.create-document` command replaces the document -- with
   * a freshly minted document id -- *inside the same project*, and that
   * exact operation is the first real step Create My First Sign guides. A
   * run keyed to the document id would end, or lose resumability, at the
   * moment its first step succeeded. Document identity and content still
   * matter for persistence, where they are captured per snapshot
   * (`GuidedProjectBinding`), not per run.
   */
  readonly projectId: string | null;
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

/**
 * Freezes a state object and its two owned lists.
 *
 * `initialGuidedWorkflowState` is returned by reference from `cancel` for
 * *every* run -- it is not copied per call. Leaving it mutable would mean one
 * untyped write or bad cast anywhere in the app could corrupt the reset value
 * every later cancel/replay relies on. Freezing it the same way `ownList`/
 * `ownDefinition` freeze runtime-owned state closes that gap structurally
 * instead of by convention.
 */
function freezeState(state: GuidedWorkflowState): GuidedWorkflowState {
  Object.freeze(state.completedStepIds);
  Object.freeze(state.skippedStepIds);
  return Object.freeze(state);
}

export const initialGuidedWorkflowState: GuidedWorkflowState = freezeState({
  status: "idle",
  definition: null,
  runToken: null,
  projectId: null,
  currentStepId: null,
  completedStepIds: [],
  skippedStepIds: [],
  failureReason: null,
});

/**
 * The project and document a guided run's progress is actually *about*, as
 * captured at one snapshot moment.
 *
 * All values are opaque to this module and supplied by the app layer, which
 * already owns project/document identity and fingerprinting (the
 * `documentFingerprint`/`projectFingerprint` idiom in `ProjectSession`). The
 * pure module compares them by exact string equality and nothing else, so it
 * stays independent of every project package.
 *
 * Without this, a persisted snapshot is structurally valid against *any*
 * open document: progress recorded against Project A -- "analysis passed",
 * "material assigned" -- would resume against Project B or an empty document
 * and claim work that was never done there.
 *
 * The three values have different lifetimes on purpose. `projectId` is the
 * stable identity the *run* is bound to. `documentId` and `fingerprint`
 * describe the exact current document at snapshot time -- the shipped
 * `project.create-document` command legitimately replaces the document id
 * inside the same project mid-run, so successive snapshots of one run may
 * carry different document ids while the project id stays fixed.
 */
export interface GuidedProjectBinding {
  /** Opaque, stable identity of the project the run is bound to. */
  readonly projectId: string;
  /** Opaque identity of the exact document open at snapshot time. */
  readonly documentId: string;
  /** Opaque content fingerprint captured at snapshot time. */
  readonly fingerprint: string;
}

/**
 * The persisted record of an interrupted workflow.
 *
 * Carries everything needed to reconstruct the in-progress state truthfully:
 * which goal, against which step-set version, which exact step was open,
 * which steps were already completed or skipped, and which document that
 * progress belongs to. Without the version, the step id, and the binding, a
 * restart could only guess.
 */
export interface OnboardingWorkflowSnapshot {
  readonly goal: GuidedGoal;
  readonly definitionVersion: number;
  readonly currentStepId: string;
  readonly completedStepIds: readonly string[];
  readonly skippedStepIds: readonly string[];
  readonly projectBinding: GuidedProjectBinding;
}

/**
 * Version 2 adds G5 learning preferences without mixing learning progress into
 * manufacturing or guided-checkpoint truth. The persistence adapter migrates
 * the shipped version-1 shape.
 */
export interface OnboardingPreferences {
  readonly schemaVersion: 2;
  readonly completedGoals: readonly GuidedGoal[];
  readonly dismissed: boolean;
  readonly activeWorkflow: OnboardingWorkflowSnapshot | null;
  readonly learnModeEnabled: boolean;
  readonly completedLearnTopics: readonly LearnTopic[];
}

/** Freezes a preferences object and its owned list. See `freezeState`. */
function freezePreferences(preferences: OnboardingPreferences): OnboardingPreferences {
  Object.freeze(preferences.completedGoals);
  Object.freeze(preferences.completedLearnTopics);
  return Object.freeze(preferences);
}

export const initialOnboardingPreferences: OnboardingPreferences = freezePreferences({
  schemaVersion: 2,
  completedGoals: [],
  dismissed: false,
  activeWorkflow: null,
  learnModeEnabled: false,
  completedLearnTopics: [],
});

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
  // `projectId` binds the run to the project it guides from its first
  // moment -- identity only, deliberately not a fingerprint or document id:
  // a fingerprint goes stale with the first edit the guided run itself
  // causes, and the document id is legitimately replaced inside the same
  // project by the shipped create-document step. The project identity is
  // the one value stable for the run's life.
  | { type: "start"; definition: GuidedWorkflowDefinition; runToken: string; projectId: string }
  | {
      type: "resume";
      definition: GuidedWorkflowDefinition;
      snapshot: OnboardingWorkflowSnapshot;
      runToken: string;
      /**
       * The binding of the document actually open right now, freshly derived
       * by the app layer -- never copied from the snapshot, which would make
       * the comparison vacuous. Resume refuses a snapshot whose persisted
       * binding does not exactly match this live one.
       */
      liveBinding: GuidedProjectBinding;
    }
  | ({ type: "advance" } & StepScopedAction)
  | ({ type: "back" } & StepScopedAction)
  | ({ type: "skip-step" } & StepScopedAction)
  | ({ type: "fail"; reason: string } & StepScopedAction)
  // Run-scoped rather than step-scoped: leaving the workflow is a decision
  // about the journey, not about one step, but it must still not apply to a
  // run the user already abandoned.
  | { type: "dismiss"; runToken: string }
  // Carries both identities. `expectedRunToken` says which terminal run the
  // user actually chose to replay, so a delayed replay cannot restart a
  // *later* run; `nextRunToken` is the identity the restarted run takes, and
  // must differ, or step events still in flight from the finished run would
  // match the fresh one.
  | { type: "replay"; expectedRunToken: string; nextRunToken: string }
  // Deliberately global and unconditional: cancel is the guaranteed exit from
  // every state and always restores the same pre-guided state, so binding it
  // to identity could only ever make an escape hatch fail to work.
  | { type: "cancel" }
  // Reports an edge, not an identity comparison: the open project session
  // was replaced by New Design, Open Project, a Recent-projects entry, or an
  // external open. Every delivery ends a non-idle run atomically, even when
  // the replacement file carries the same persisted project id (Save As and
  // copied `.laserx` files do). Returning the exact initial state clears the
  // run token and makes `toWorkflowSnapshot` return `null`, so stale events
  // and stale persistence cannot cross the replacement boundary.
  //
  // Deliberately NOT dispatched for `project.create-document`, Save, or Save
  // As: those operations stay inside the current open project session.
  | { type: "project-replaced" };

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
  // An external fact must always be deliverable: a run bound to a replaced
  // project is invalid whether it is active or already terminal.
  "project-replaced": ["idle", "active", "completed", "dismissed", "failed"],
};

/**
 * Whether a run token can actually identify a run.
 *
 * A blank token would make every run indistinguishable from every other, so
 * the identity checks would pass vacuously and stale events would apply again.
 *
 * Uniqueness cannot be checked here -- `cancel` returns exactly the initial
 * state and so the reducer deliberately remembers no history -- which is why
 * ADR 0027 makes minting a fresh, unique token for every `start`, `resume`,
 * and `replay` an explicit caller obligation.
 */
export function isUsableToken(token: string): boolean {
  return typeof token === "string" && token.trim() !== "";
}

/**
 * Whether a project binding can actually distinguish one project and
 * document from another. A blank identity or fingerprint would match
 * anything, so the wrong-project, wrong-document, and changed-content checks
 * would pass vacuously -- the same reasoning that rejects a blank run token.
 */
export function isUsableProjectBinding(binding: GuidedProjectBinding): boolean {
  return (
    isUsableToken(binding.projectId) &&
    isUsableToken(binding.documentId) &&
    isUsableToken(binding.fingerprint)
  );
}

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
  if (new Set(definition.stepIds).size !== definition.stepIds.length) return false;

  // skippableStepIds and transientStepIds must each be well-formed and
  // describe only real steps: a blank/duplicate entry is meaningless, and an
  // id absent from stepIds would silently claim eligibility for a step that
  // does not exist.
  return (
    isWellFormedStepSubset(definition.skippableStepIds, definition.stepIds) &&
    isWellFormedStepSubset(definition.transientStepIds, definition.stepIds)
  );
}

function isWellFormedStepSubset(ids: readonly string[], stepIds: readonly string[]): boolean {
  if (ids.some((id) => typeof id !== "string" || id.trim() === "")) return false;
  if (new Set(ids).size !== ids.length) return false;
  const stepIdSet = new Set(stepIds);
  return ids.every((id) => stepIdSet.has(id));
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
    skippableStepIds: ownList(definition.skippableStepIds),
    transientStepIds: ownList(definition.transientStepIds),
  });
}

function ownBinding(binding: GuidedProjectBinding): GuidedProjectBinding {
  return Object.freeze({
    projectId: binding.projectId,
    documentId: binding.documentId,
    fingerprint: binding.fingerprint,
  });
}

/**
 * Whether `skip-step` may bypass this step under this definition.
 *
 * Exported so a caller (G1) can decide whether to offer a Skip affordance at
 * all, without duplicating the eligibility rule the reducer itself enforces.
 */
export function isStepSkippable(
  definition: GuidedWorkflowDefinition,
  stepId: string | null,
): boolean {
  return stepId !== null && definition.skippableStepIds.includes(stepId);
}

/**
 * Whether a step's prerequisites live in transient in-memory feature state
 * that does not survive an application restart. Exported so a caller (G1) can
 * explain a recovery ("we took you back to X") without duplicating the rule
 * the resume path itself enforces.
 */
export function isStepTransient(
  definition: GuidedWorkflowDefinition,
  stepId: string | null,
): boolean {
  return stepId !== null && definition.transientStepIds.includes(stepId);
}

function nearestStableStepIdAtOrBefore(
  definition: GuidedWorkflowDefinition,
  startIndex: number,
): string | null {
  for (let index = startIndex; index >= 0; index -= 1) {
    const stepId = definition.stepIds[index];
    if (stepId !== undefined && !isStepTransient(definition, stepId)) return stepId;
  }
  return null;
}

/**
 * The step a snapshot actually resumes to, or `null` when it cannot resume.
 *
 * A non-transient open step resumes exactly. A transient open step recovers
 * to the nearest earlier non-transient step -- its prerequisites (a preview
 * slot, current analysis results) are gone after a restart, so reopening it
 * would present a surface with nothing behind it. When no earlier
 * non-transient step exists the snapshot is unresumable and the goal
 * restarts; the document itself is untouched either way, only guidance
 * position is lost.
 */
export function resolveResumeStepId(
  definition: GuidedWorkflowDefinition,
  snapshot: OnboardingWorkflowSnapshot,
): string | null {
  const currentIndex = definition.stepIds.indexOf(snapshot.currentStepId);
  if (currentIndex < 0) return null;
  return nearestStableStepIdAtOrBefore(definition, currentIndex);
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
  projectId: string,
): GuidedWorkflowState {
  // Validate the caller value, then keep an owned copy: validating a value the
  // caller can still mutate would only prove it was valid at one instant.
  const definition = ownDefinition(supplied);
  const firstStepId = definition.stepIds[0];
  if (!isUsableToken(runToken)) {
    return {
      ...initialGuidedWorkflowState,
      status: "failed",
      definition,
      failureReason: "A guided workflow requires a non-blank run token.",
    };
  }
  if (!isUsableToken(projectId)) {
    // A blank identity could never match or mismatch anything, so the
    // snapshot-identity guard would be vacuous for the whole run -- the same
    // reasoning that rejects a blank run token.
    return {
      ...initialGuidedWorkflowState,
      status: "failed",
      definition,
      runToken,
      failureReason: "A guided workflow requires a non-blank project identity.",
    };
  }
  if (!isValidWorkflowDefinition(definition) || firstStepId === undefined) {
    // Fail closed rather than entering an active workflow that cannot
    // progress: a malformed definition must be a visible failure, never a
    // silent dead end the user has to abandon.
    return {
      ...initialGuidedWorkflowState,
      status: "failed",
      definition,
      runToken,
      projectId,
      failureReason:
        "A guided workflow requires a positive version and at least one unique, non-blank step id.",
    };
  }
  return {
    status: "active",
    definition,
    runToken,
    projectId,
    currentStepId: firstStepId,
    completedStepIds: [],
    skippedStepIds: [],
    failureReason: null,
  };
}

/**
 * Whether a persisted snapshot can be trusted against a step definition and
 * the document that is actually open.
 *
 * Fail-closed by design: a snapshot from a different goal, a different step-set
 * version, a different document, a document whose content changed since the
 * snapshot, or naming a step the definition no longer contains cannot be
 * repaired into "probably this step" without inventing progress the user never
 * made. Callers restart the goal instead; refusal never touches the document,
 * only guidance position.
 */
export function canResumeSnapshot(
  definition: GuidedWorkflowDefinition,
  snapshot: OnboardingWorkflowSnapshot,
  liveBinding: GuidedProjectBinding,
): boolean {
  if (!isValidWorkflowDefinition(definition)) return false;
  if (snapshot.goal !== definition.goal) return false;
  if (snapshot.definitionVersion !== definition.definitionVersion) return false;

  // Progress belongs to one exact project and document. A different project
  // identity is the wrong project outright; a different document identity is
  // the wrong document; the same document with a different fingerprint means
  // its content changed since the snapshot, so recorded progress ("analysis
  // passed", "material assigned") may no longer describe it. All three
  // refuse rather than resume against a document the progress is not about.
  if (!isUsableProjectBinding(snapshot.projectBinding)) return false;
  if (!isUsableProjectBinding(liveBinding)) return false;
  if (snapshot.projectBinding.projectId !== liveBinding.projectId) return false;
  if (snapshot.projectBinding.documentId !== liveBinding.documentId) return false;
  if (snapshot.projectBinding.fingerprint !== liveBinding.fingerprint) return false;

  const currentIndex = definition.stepIds.indexOf(snapshot.currentStepId);
  if (currentIndex < 0) return false;

  // A transient open step must have a stable predecessor to recover to
  // (resolveResumeStepId); otherwise the snapshot cannot be resumed at all.
  if (resolveResumeStepId(definition, snapshot) === null) return false;

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
  if (!prefix.every((id) => progress.has(id))) return false;

  // A skipped id the reducer could never have produced: skip-step is a
  // same-reference no-op on a step outside skippableStepIds, so a snapshot
  // claiming a required step was skipped describes a journey the reducer
  // cannot produce -- exactly the same reasoning as the prefix checks above,
  // applied to skip eligibility instead of ordering.
  return snapshot.skippedStepIds.every((id) => isStepSkippable(definition, id));
}

/**
 * Captures the persistable record of an in-progress workflow, or `null` when
 * there is nothing meaningful to resume (idle, terminal, or no open step).
 *
 * The caller supplies the binding of the document the run is operating on,
 * derived at snapshot time -- fingerprints are point-in-time values, so the
 * reducer cannot carry one from `start` without it going stale as the user
 * edits. A binding that cannot distinguish documents (blank identity or
 * fingerprint) produces no snapshot at all: persisting it would only create
 * a record the resume checks must later refuse.
 *
 * The binding's persisted identity must also be the identity the run is
 * bound to. That rejects a different-project binding directly. A replacement
 * that retains the same persisted id (reopen, Save As, copied file) is closed
 * by the caller's synchronous `project-replaced` transaction before snapshot
 * persistence can observe the replacement binding.
 */
export function toWorkflowSnapshot(
  state: GuidedWorkflowState,
  projectBinding: GuidedProjectBinding,
): OnboardingWorkflowSnapshot | null {
  if (state.status !== "active" || state.definition === null || state.currentStepId === null) {
    return null;
  }
  if (!isUsableProjectBinding(projectBinding)) return null;
  if (state.projectId === null || projectBinding.projectId !== state.projectId) return null;
  // Detached: a caller mutating the returned snapshot must not reach back
  // into live progress.
  return Object.freeze({
    goal: state.definition.goal,
    definitionVersion: state.definition.definitionVersion,
    currentStepId: state.currentStepId,
    completedStepIds: ownList(state.completedStepIds),
    skippedStepIds: ownList(state.skippedStepIds),
    projectBinding: ownBinding(projectBinding),
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
      return startedState(action.definition, action.runToken, action.projectId);
    }

    case "project-replaced": {
      // No run to invalidate.
      if (state.status === "idle") return state;
      // A replacement is an edge, not an identity comparison: reopening the
      // same file or opening a Save As/copy may retain the same persisted
      // project id. End the run atomically so in-flight events no-op and the
      // ordinary persist-on-change write clears the resumable snapshot.
      return initialGuidedWorkflowState;
    }

    case "resume": {
      if (!isUsableToken(action.runToken)) return initialGuidedWorkflowState;
      if (!canResumeSnapshot(action.definition, action.snapshot, action.liveBinding)) {
        // Fail closed to idle rather than guessing a step: a wrong guess would
        // silently claim progress the user never made.
        return initialGuidedWorkflowState;
      }
      const definition = ownDefinition(action.definition);
      // A transient open step recovers to its nearest stable predecessor
      // (resolveResumeStepId) -- never reopened with its prerequisites gone.
      // Reopening the recovery step discards progress from that step forward,
      // exactly the `back` semantics, so the restored record stays truthful.
      const resumeStepId = resolveResumeStepId(definition, action.snapshot);
      if (resumeStepId === null) return initialGuidedWorkflowState;
      const resumeIndex = definition.stepIds.indexOf(resumeStepId);
      const stillBehind = (id: string): boolean => definition.stepIds.indexOf(id) < resumeIndex;
      return {
        status: "active",
        definition,
        runToken: action.runToken,
        // canResumeSnapshot proved liveBinding matches the snapshot's
        // persisted binding, so this is the identity the progress is about.
        projectId: action.liveBinding.projectId,
        currentStepId: resumeStepId,
        completedStepIds: ownList(action.snapshot.completedStepIds.filter(stillBehind)),
        skippedStepIds: ownList(action.snapshot.skippedStepIds.filter(stillBehind)),
        failureReason: null,
      };
    }

    case "replay": {
      if (state.definition === null) return state;
      // Which run the user chose to replay. Without this, a delayed replay
      // produced by run A would restart whichever run happens to be terminal
      // now -- a stale event mutating a newer run.
      if (state.runToken === null || state.runToken !== action.expectedRunToken) return state;
      // A distinct, usable next identity, so step events still in flight from
      // the finished run cannot match the restarted one.
      if (!isUsableToken(action.nextRunToken) || action.nextRunToken === state.runToken) {
        return state;
      }
      // The restarted run guides the same project as the run it replays; a
      // replaced project would already have ended this terminal state via
      // project-replaced before replay could target it.
      return startedState(state.definition, action.nextRunToken, state.projectId ?? "");
    }

    case "advance":
    case "skip-step": {
      if (!matchesLiveStep(state, action)) return state;
      const definition = state.definition;
      if (definition === null) return state;

      const skipping = action.type === "skip-step";
      // Skip eligibility is locked in the definition (isStepSkippable), not
      // left to whichever caller dispatches skip-step: a required stage --
      // cutability analysis, the physical-3D checkpoint, a repair/decision
      // stage with unresolved blocking findings -- must not become an
      // allowed transition just because a UI happened to offer a Skip
      // control on it. This is a same-reference no-op, identical in shape to
      // every other identity mismatch this reducer already treats as a
      // stale or invalid event.
      if (skipping && !isStepSkippable(definition, state.currentStepId)) return state;

      const index = stepIndexOf(definition, state.currentStepId);
      if (index < 0) return state;

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
      // A consumed preview or analysis checkpoint cannot be reconstructed by
      // navigating back to it. Use the same stable recovery boundary as
      // resume; stable-to-stable Back still moves exactly one step.
      const previousStepId = nearestStableStepIdAtOrBefore(definition, index - 1);
      if (previousStepId === null) return state;
      const previousIndex = definition.stepIds.indexOf(previousStepId);

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

/**
 * The current findings at a post-analysis resolution checkpoint, grouped by
 * the milestone's locked classification. Producing these counts -- deciding
 * which finding is safely auto-fixable, which needs a judgment call, and
 * which blocks manufacturing -- is the grouped-repair engine's job (G4). This
 * module only fixes what the checkpoint *does* with the counts, so every
 * goal shares one deterministic rule instead of each UI inventing its own.
 */
export interface ResolutionFindingCounts {
  /** Findings a deterministic, previewable, undoable safe repair can fix. */
  readonly safeFixableCount: number;
  /** Findings needing a user judgment (Suggested fix or Needs your decision). */
  readonly needsDecisionCount: number;
  /** Findings that block continuing to 3D/export until resolved. */
  readonly blockingCount: number;
}

export type ResolutionPrimaryAction = "fix-safe-problems" | "review-decisions" | "continue";

function isValidFindingCount(count: number): boolean {
  return Number.isInteger(count) && count >= 0;
}

function hasValidFindingCounts(counts: ResolutionFindingCounts): boolean {
  return (
    isValidFindingCount(counts.safeFixableCount) &&
    isValidFindingCount(counts.needsDecisionCount) &&
    isValidFindingCount(counts.blockingCount)
  );
}

/**
 * The one primary action a resolution checkpoint shows, decided by strict
 * first-match precedence so exactly one rule ever applies:
 *
 * 1. eligible safe fixes exist -- **Fix safe problems**;
 * 2. otherwise, anything still needs attention (a decision or a blocking
 *    finding) -- **Review decisions**;
 * 3. otherwise nothing is actionable -- **Continue**.
 *
 * "Continue" is primary only when `canCompleteResolution` also holds, by
 * construction: a blocking finding forces rule 2, so the checkpoint can never
 * present Continue while refusing to complete. Malformed counts (negative,
 * fractional, NaN) fail closed to **Review decisions** -- a human looks,
 * rather than a broken count waving the checkpoint through.
 */
export function resolutionPrimaryAction(counts: ResolutionFindingCounts): ResolutionPrimaryAction {
  if (!hasValidFindingCounts(counts)) return "review-decisions";
  if (counts.safeFixableCount > 0) return "fix-safe-problems";
  if (counts.needsDecisionCount > 0 || counts.blockingCount > 0) return "review-decisions";
  return "continue";
}

/**
 * Whether the *user* may leave the resolution checkpoint: no blocking
 * findings remain. Non-blocking suggestions do not trap -- Review decisions
 * stays primary while they exist, but a visible Continue action remains
 * available and this rule is its permission. An explicitly-approved
 * acknowledgment path may later widen this (G4 work); nothing here invents
 * one. Malformed counts fail closed.
 *
 * This is the caller-side gate for dispatching `advance` on a resolution
 * checkpoint, the same kind of obligation as minting run tokens: the reducer
 * cannot see findings, so the definition keeps the checkpoint out of
 * `skippableStepIds` (skip is structurally refused) and the caller advances
 * only when this returns true.
 *
 * It is deliberately NOT the unseen auto-advance trigger. Permission to
 * continue is broader than "nothing to show": safe fixes or non-blocking
 * decisions leave this true while the checkpoint still has real work to
 * present. Auto-advancing on this rule would silently bypass Fix safe
 * problems and Review decisions -- the flagship repair workflow -- so the
 * unseen path is gated by `shouldAutoCompleteResolution` instead.
 */
export function canCompleteResolution(counts: ResolutionFindingCounts): boolean {
  if (!hasValidFindingCounts(counts)) return false;
  return counts.blockingCount === 0;
}

/**
 * Whether the resolution checkpoint should complete unseen, without ever
 * presenting a stage: true only when *nothing is actionable at all* -- no
 * safe fixes, no decisions, no blocking findings. Equivalently, exactly when
 * `resolutionPrimaryAction` returns "continue"; the tests pin that
 * equivalence so the two rules cannot drift apart.
 *
 * The caller dispatches the immediate `advance` on this rule and only this
 * rule. `canCompleteResolution` merely permits a user-chosen Continue; using
 * that broader permission as the auto-advance trigger would skip repair
 * surfaces the user was owed. Malformed counts fail closed: the stage is
 * presented, never silently bypassed.
 */
export function shouldAutoCompleteResolution(counts: ResolutionFindingCounts): boolean {
  if (!hasValidFindingCounts(counts)) return false;
  return (
    counts.safeFixableCount === 0 &&
    counts.needsDecisionCount === 0 &&
    counts.blockingCount === 0
  );
}
