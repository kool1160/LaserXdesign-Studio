import { describe, expect, it } from "vitest";

import {
  ALLOWED_SOURCE_STATUSES,
  canResumeSnapshot,
  initialGuidedWorkflowState,
  initialOnboardingPreferences,
  isTerminalStatus,
  isValidWorkflowDefinition,
  reduceGuidedWorkflow,
  toWorkflowSnapshot,
  type GuidedGoal,
  type GuidedWorkflowAction,
  type GuidedWorkflowActionType,
  type GuidedWorkflowDefinition,
  type GuidedWorkflowState,
  type StepScopedAction,
  type OnboardingWorkflowSnapshot,
} from "../../src/features/onboarding/guidedWorkflowState.js";

const GOALS: readonly GuidedGoal[] = ["create-first-sign", "import-own-design", "describe-with-ai"];

const DEFINITION: GuidedWorkflowDefinition = {
  goal: "create-first-sign",
  definitionVersion: 1,
  stepIds: ["choose-material", "add-text", "review-cutability"],
};

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

const RUN = "run-token-1";

/** Builds a step-scoped action bound to whatever step/run is currently live. */
function live(
  state: GuidedWorkflowState,
  type: "advance" | "back" | "skip-step" | "fail",
  reason = "example",
): GuidedWorkflowAction & StepScopedAction {
  const identity = {
    expectedStepId: state.currentStepId ?? "",
    runToken: state.runToken ?? "",
  };
  return type === "fail" ? { type, reason, ...identity } : { type, ...identity };
}

/** Dispatches a step-scoped action that correctly targets the live step. */
function dispatch(
  state: GuidedWorkflowState,
  type: "advance" | "back" | "skip-step" | "fail",
  reason?: string,
): GuidedWorkflowState {
  return reduceGuidedWorkflow(state, live(state, type, reason));
}

function start(definition = DEFINITION, runToken = RUN): GuidedWorkflowState {
  return reduceGuidedWorkflow(initialGuidedWorkflowState, { type: "start", definition, runToken });
}

function advanceTo(stepId: string): GuidedWorkflowState {
  let state = start();
  while (state.currentStepId !== stepId && state.status === "active") {
    state = dispatch(state, "advance");
  }
  return state;
}

describe("guided workflow -- basic transitions", () => {
  it("starts at the first step of the definition", () => {
    const state = start();
    expect(state.status).toBe("active");
    expect(state.currentStepId).toBe("choose-material");
    expect(state.completedStepIds).toEqual([]);
  });

  it("fails closed rather than starting with zero steps", () => {
    const state = start({ ...DEFINITION, stepIds: [] });
    expect(state.status).toBe("failed");
    expect(state.failureReason).toMatch(/at least one unique, non-blank step id/u);
  });

  it("advances through every step to completed", () => {
    let state = start();
    for (let i = 0; i < DEFINITION.stepIds.length; i += 1) {
      state = dispatch(state, "advance");
    }
    expect(state.status).toBe("completed");
    expect(state.completedStepIds).toEqual(DEFINITION.stepIds);
  });

  it("moves back by step id, never past the first step", () => {
    const second = advanceTo("add-text");
    expect(dispatch(second, "back").currentStepId).toBe("choose-material");
    const first = start();
    expect(dispatch(first, "back")).toBe(first);
  });

  it("going back reopens the destination step and discards progress from there forward", () => {
    let state = dispatch(start(), "advance");
    state = dispatch(state, "skip-step");
    expect(state.currentStepId).toBe("review-cutability");
    expect(state.completedStepIds).toEqual(["choose-material"]);
    expect(state.skippedStepIds).toEqual(["add-text"]);

    // Back to add-text: that step is being redone, so it is no longer skipped.
    state = dispatch(state, "back");
    expect(state.currentStepId).toBe("add-text");
    expect(state.skippedStepIds).toEqual([]);
    expect(state.completedStepIds).toEqual(["choose-material"]);

    // Back again to the first step: nothing at or after it stays recorded.
    state = dispatch(state, "back");
    expect(state.currentStepId).toBe("choose-material");
    expect(state.completedStepIds).toEqual([]);
    expect(state.skippedStepIds).toEqual([]);
  });

  it("fail records a reason and is terminal", () => {
    const state = dispatch(start(), "fail", "worker crashed");
    expect(state.status).toBe("failed");
    expect(state.failureReason).toBe("worker crashed");
  });

  it("replay restarts the same definition from the first step, clearing history", () => {
    let state = start();
    state = dispatch(state, "skip-step");
    state = dispatch(state, "advance");
    state = dispatch(state, "advance");
    expect(state.status).toBe("completed");

    const replayed = reduceGuidedWorkflow(state, { type: "replay", runToken: RUN });
    expect(replayed.status).toBe("active");
    expect(replayed.currentStepId).toBe("choose-material");
    expect(replayed.completedStepIds).toEqual([]);
    expect(replayed.skippedStepIds).toEqual([]);
  });
});

describe("guided workflow -- definition validity", () => {
  const INVALID: readonly (readonly [string, GuidedWorkflowDefinition])[] = [
    ["duplicate step ids", { ...DEFINITION, stepIds: ["a", "a", "b"] }],
    ["a blank step id", { ...DEFINITION, stepIds: ["a", "   ", "b"] }],
    ["an empty step id", { ...DEFINITION, stepIds: ["a", "", "b"] }],
    ["no steps at all", { ...DEFINITION, stepIds: [] }],
    ["a zero version", { ...DEFINITION, definitionVersion: 0 }],
    ["a negative version", { ...DEFINITION, definitionVersion: -1 }],
    ["a fractional version", { ...DEFINITION, definitionVersion: 1.5 }],
  ];

  it.each(INVALID)("rejects %s", (_label, definition) => {
    expect(isValidWorkflowDefinition(definition)).toBe(false);
  });

  it("accepts a well-formed definition", () => {
    expect(isValidWorkflowDefinition(DEFINITION)).toBe(true);
  });

  it.each(INVALID)("fails closed instead of starting on %s", (_label, definition) => {
    const state = start(definition);
    expect(state.status).toBe("failed");
    expect(state.currentStepId).toBeNull();
  });

  it("duplicate step ids cannot create a permanently non-progressing active workflow", () => {
    // Step lookup resolves an id to its FIRST index, so ["a","a","b"] would
    // advance from the first `a` to the second `a`, resolve back to index 0,
    // and never reach `b` -- an "active" workflow with no forward exit.
    const trapped = { ...DEFINITION, stepIds: ["a", "a", "b"] };
    let state = start(trapped);
    for (let i = 0; i < 6; i += 1) {
      state = dispatch(state, "advance");
    }
    expect(state.status).not.toBe("active");
    expect(state.status).toBe("failed");
  });

  it("refuses to resume or replay a malformed definition", () => {
    const trapped = { ...DEFINITION, stepIds: ["a", "a", "b"] };
    const resumed = reduceGuidedWorkflow(initialGuidedWorkflowState, {
      type: "resume",
      definition: trapped,
      runToken: RUN,
      snapshot: {
        goal: trapped.goal,
        definitionVersion: trapped.definitionVersion,
        currentStepId: "b",
        completedStepIds: ["a"],
        skippedStepIds: [],
      },
    });
    expect(resumed).toEqual(initialGuidedWorkflowState);

    const failedStart = start(trapped);
    expect(reduceGuidedWorkflow(failedStart, { type: "replay", runToken: RUN }).status).toBe("failed");
  });
});

describe("guided workflow -- skip a step versus leaving the workflow", () => {
  it("skip-step advances to the next step and keeps the workflow active", () => {
    const state = dispatch(start(), "skip-step");
    expect(state.status).toBe("active");
    expect(state.currentStepId).toBe("add-text");
    expect(state.skippedStepIds).toEqual(["choose-material"]);
    expect(state.completedStepIds).toEqual([]);
  });

  it("skip-step on the final step completes the workflow rather than erroring", () => {
    const last = advanceTo("review-cutability");
    const state = dispatch(last, "skip-step");
    expect(state.status).toBe("completed");
    expect(state.skippedStepIds).toContain("review-cutability");
  });

  it("dismiss leaves the workflow and is terminal", () => {
    const state = reduceGuidedWorkflow(start(), { type: "dismiss", runToken: RUN });
    expect(state.status).toBe("dismissed");
    expect(state.currentStepId).toBe("choose-material");
  });

  it("a step is never recorded as both completed and skipped", () => {
    // Skip a step, go back, then complete it: the earlier skip must not linger.
    let state = dispatch(start(), "skip-step");
    expect(state.skippedStepIds).toEqual(["choose-material"]);
    state = dispatch(state, "back");
    state = dispatch(state, "advance");
    expect(state.completedStepIds).toEqual(["choose-material"]);
    expect(state.skippedStepIds).toEqual([]);
  });
});

describe("guided workflow -- persistence round trip", () => {
  it("captures no snapshot when there is nothing meaningful to resume", () => {
    expect(toWorkflowSnapshot(initialGuidedWorkflowState)).toBeNull();
    const completed = dispatch(dispatch(dispatch(start(), "advance"), "advance"), "advance");
    expect(completed.status).toBe("completed");
    expect(toWorkflowSnapshot(completed)).toBeNull();
  });

  it("reconstructs the exact interrupted state from the persisted shape alone", () => {
    // Build real progress, persist only what OnboardingPreferences stores,
    // then restore from that snapshot and nothing else.
    let live = dispatch(start(), "skip-step");
    live = dispatch(live, "advance");
    expect(live.currentStepId).toBe("review-cutability");

    const snapshot = toWorkflowSnapshot(live);
    expect(snapshot).not.toBeNull();

    const persisted = {
      ...initialOnboardingPreferences,
      activeWorkflow: snapshot,
    };
    // Round-trip through JSON: the store writes a file, so anything that
    // survives resume must survive serialization.
    const reloaded = JSON.parse(JSON.stringify(persisted)) as typeof persisted;
    expect(reloaded.activeWorkflow).not.toBeNull();

    const restored = reduceGuidedWorkflow(initialGuidedWorkflowState, { type: "resume", definition: DEFINITION, snapshot: reloaded.activeWorkflow as OnboardingWorkflowSnapshot, runToken: RUN });

    expect(restored.status).toBe("active");
    expect(restored.currentStepId).toBe(live.currentStepId);
    expect(restored.completedStepIds).toEqual(live.completedStepIds);
    expect(restored.skippedStepIds).toEqual(live.skippedStepIds);
  });

  it("refuses to resume across a definition version change instead of inventing progress", () => {
    const snapshot = toWorkflowSnapshot(advanceTo("add-text"));
    expect(snapshot).not.toBeNull();
    const newerDefinition = { ...DEFINITION, definitionVersion: 2 };

    expect(canResumeSnapshot(newerDefinition, snapshot as OnboardingWorkflowSnapshot)).toBe(false);
    const restored = reduceGuidedWorkflow(initialGuidedWorkflowState, { type: "resume", definition: newerDefinition, snapshot: snapshot as OnboardingWorkflowSnapshot, runToken: RUN });
    expect(restored).toEqual(initialGuidedWorkflowState);
  });

  it("refuses to resume a step the definition no longer contains", () => {
    const snapshot = toWorkflowSnapshot(advanceTo("add-text"));
    const withoutStep = {
      ...DEFINITION,
      stepIds: ["choose-material", "review-cutability"],
    };

    expect(canResumeSnapshot(withoutStep, snapshot as OnboardingWorkflowSnapshot)).toBe(false);
    expect(
      reduceGuidedWorkflow(initialGuidedWorkflowState, { type: "resume", definition: withoutStep, snapshot: snapshot as OnboardingWorkflowSnapshot, runToken: RUN }),
    ).toEqual(initialGuidedWorkflowState);
  });

  it("refuses to resume a snapshot from a different goal", () => {
    const snapshot = toWorkflowSnapshot(advanceTo("add-text"));
    const otherGoal = { ...DEFINITION, goal: "import-own-design" as const };
    expect(canResumeSnapshot(otherGoal, snapshot as OnboardingWorkflowSnapshot)).toBe(false);
  });

  const base = {
    goal: DEFINITION.goal,
    definitionVersion: DEFINITION.definitionVersion,
  } as const;

  const CONTRADICTORY: readonly (readonly [string, OnboardingWorkflowSnapshot])[] = [
    [
      "the current step already marked completed",
      { ...base, currentStepId: "add-text", completedStepIds: ["add-text"], skippedStepIds: [] },
    ],
    [
      "the current step already marked skipped",
      { ...base, currentStepId: "add-text", completedStepIds: [], skippedStepIds: ["add-text"] },
    ],
    [
      "a later step marked completed while an earlier one is open",
      {
        ...base,
        currentStepId: "choose-material",
        completedStepIds: ["review-cutability"],
        skippedStepIds: [],
      },
    ],
    [
      "the same step both completed and skipped",
      {
        ...base,
        currentStepId: "review-cutability",
        completedStepIds: ["choose-material"],
        skippedStepIds: ["choose-material"],
      },
    ],
    [
      "a duplicated completed id",
      {
        ...base,
        currentStepId: "review-cutability",
        completedStepIds: ["choose-material", "choose-material"],
        skippedStepIds: [],
      },
    ],
  ];

  it.each(CONTRADICTORY)("refuses a snapshot with %s", (_label, snapshot) => {
    expect(canResumeSnapshot(DEFINITION, snapshot)).toBe(false);
    expect(
      reduceGuidedWorkflow(initialGuidedWorkflowState, {
        type: "resume",
        definition: DEFINITION,
        snapshot,
        runToken: RUN,
      }),
    ).toEqual(initialGuidedWorkflowState);
  });

  it("refuses a partial-prefix snapshot that skipped a required step", () => {
    // The reducer cannot reach C without processing B, so a snapshot claiming
    // it did is describing a journey that never happened. Resuming it would
    // silently bypass a required step.
    const gap: OnboardingWorkflowSnapshot = {
      goal: DEFINITION.goal,
      definitionVersion: DEFINITION.definitionVersion,
      currentStepId: "review-cutability",
      completedStepIds: ["choose-material"],
      skippedStepIds: [],
    };
    expect(canResumeSnapshot(DEFINITION, gap)).toBe(false);
    expect(
      reduceGuidedWorkflow(initialGuidedWorkflowState, { type: "resume", definition: DEFINITION, snapshot: gap, runToken: RUN }),
    ).toEqual(initialGuidedWorkflowState);
  });

  it("refuses progress recorded out of prefix order", () => {
    const outOfOrder: OnboardingWorkflowSnapshot = {
      goal: DEFINITION.goal,
      definitionVersion: DEFINITION.definitionVersion,
      currentStepId: "review-cutability",
      // Two entries, so the count matches, but "review-cutability" is the
      // open step rather than part of the prefix.
      completedStepIds: ["choose-material", "review-cutability"],
      skippedStepIds: [],
    };
    expect(canResumeSnapshot(DEFINITION, outOfOrder)).toBe(false);
  });

  it("every active state the reducer can produce satisfies the resume invariant", () => {
    // Ties the validator to the reducer: anything reachable must be resumable,
    // or persistence would reject states the product can legitimately be in.
    const seen = new Set<string>();
    const queue: GuidedWorkflowState[] = [start()];
    const stepTypes = ["advance", "skip-step", "back"] as const;

    while (queue.length > 0) {
      const state = queue.shift() as GuidedWorkflowState;
      const key = JSON.stringify(state);
      if (seen.has(key)) continue;
      seen.add(key);

      if (state.status === "active") {
        const snapshot = toWorkflowSnapshot(state);
        expect(snapshot).not.toBeNull();
        expect(canResumeSnapshot(DEFINITION, snapshot as OnboardingWorkflowSnapshot)).toBe(true);
      }
      for (const type of stepTypes) {
        queue.push(dispatch(state, type));
      }
    }
    expect(seen.size).toBeGreaterThan(3);
  });

  it("a snapshot taken after going back is still resumable and truthful", () => {
    // The exact sequence the review flagged: complete two steps, reach the
    // third, then go back. The persisted snapshot must not claim the step
    // being redone -- or any later one -- is already finished.
    let live = dispatch(start(), "advance");
    live = dispatch(live, "advance");
    expect(live.currentStepId).toBe("review-cutability");
    expect(live.completedStepIds).toEqual(["choose-material", "add-text"]);

    live = dispatch(live, "back");
    expect(live.currentStepId).toBe("add-text");
    expect(live.completedStepIds).toEqual(["choose-material"]);

    const snapshot = toWorkflowSnapshot(live);
    expect(snapshot).not.toBeNull();
    expect(canResumeSnapshot(DEFINITION, snapshot as OnboardingWorkflowSnapshot)).toBe(true);

    const restored = reduceGuidedWorkflow(initialGuidedWorkflowState, { type: "resume", definition: DEFINITION, snapshot: snapshot as OnboardingWorkflowSnapshot, runToken: RUN });
    expect(restored.currentStepId).toBe("add-text");
    expect(restored.completedStepIds).toEqual(["choose-material"]);
  });
});

describe("guided workflow -- transition table", () => {
  const ALL_STATUSES = ["idle", "active", "completed", "dismissed", "failed"] as const;

  function actionOfType(
    type: GuidedWorkflowActionType,
    state: GuidedWorkflowState,
  ): GuidedWorkflowAction {
    const identity = {
      expectedStepId: state.currentStepId ?? "",
      runToken: state.runToken ?? RUN,
    };
    switch (type) {
      case "start":
        return { type: "start", definition: DEFINITION, runToken: RUN };
      case "resume":
        return {
          type: "resume",
          definition: DEFINITION,
          runToken: RUN,
          snapshot: {
            goal: DEFINITION.goal,
            definitionVersion: DEFINITION.definitionVersion,
            currentStepId: "add-text",
            completedStepIds: ["choose-material"],
            skippedStepIds: [],
          },
        };
      case "replay":
      case "dismiss":
        return { type, runToken: state.runToken ?? RUN };
      case "cancel":
        return { type };
      case "fail":
        return { type: "fail", reason: "example", ...identity };
      default:
        return { type, ...identity };
    }
  }

  /** Only states the reducer can actually produce, discovered by walking the
   * graph from the initial state -- never synthesized by hand. */
  function reachableStates(): Map<string, GuidedWorkflowState> {
    const seen = new Map<string, GuidedWorkflowState>();
    const queue: GuidedWorkflowState[] = [initialGuidedWorkflowState];
    const key = (s: GuidedWorkflowState): string => JSON.stringify(s);
    seen.set(key(initialGuidedWorkflowState), initialGuidedWorkflowState);

    while (queue.length > 0) {
      const current = queue.shift() as GuidedWorkflowState;
      for (const type of Object.keys(ALLOWED_SOURCE_STATUSES) as GuidedWorkflowActionType[]) {
        const next = reduceGuidedWorkflow(current, actionOfType(type, current));
        const nextKey = key(next);
        if (!seen.has(nextKey)) {
          seen.set(nextKey, next);
          queue.push(next);
        }
      }
    }
    return seen;
  }

  it("every status in the table is one the reducer can actually reach", () => {
    const reached = new Set([...reachableStates().values()].map((state) => state.status));
    for (const status of ALL_STATUSES) {
      expect(reached.has(status)).toBe(true);
    }
  });

  it("an action from a disallowed source status is a no-op returning the same reference", () => {
    for (const type of Object.keys(ALLOWED_SOURCE_STATUSES) as GuidedWorkflowActionType[]) {
      for (const [, state] of reachableStates()) {
        if (ALLOWED_SOURCE_STATUSES[type].includes(state.status)) continue;
        expect(reduceGuidedWorkflow(state, actionOfType(type, state))).toBe(state);
      }
    }
  });

  it("a stale start cannot reset an active journey", () => {
    const midway = advanceTo("add-text");
    expect(
      reduceGuidedWorkflow(midway, { type: "start", definition: DEFINITION, runToken: RUN }),
    ).toBe(midway);
  });

  it("a stale resume cannot overwrite a terminal record", () => {
    const dismissed = reduceGuidedWorkflow(start(), { type: "dismiss", runToken: RUN });
    expect(reduceGuidedWorkflow(dismissed, actionOfType("resume", dismissed))).toBe(dismissed);
  });

  it("every reachable non-terminal state has a valid forward exit and a cancel exit", () => {
    for (const [, state] of reachableStates()) {
      // cancel is always available, from every reachable state.
      expect(reduceGuidedWorkflow(state, { type: "cancel" })).toEqual(initialGuidedWorkflowState);

      if (state.status === "idle" || isTerminalStatus(state.status)) continue;

      // A non-terminal state must also be able to move forward on its own,
      // so a user is never stuck needing to abandon the workflow entirely.
      const forward = dispatch(state, "advance");
      expect(forward).not.toBe(state);
    }
  });

  it("every reachable terminal state can be replayed or canceled", () => {
    for (const [, state] of reachableStates()) {
      if (!isTerminalStatus(state.status)) continue;
      const replayed = reduceGuidedWorkflow(state, { type: "replay", runToken: RUN });
      const canceled = reduceGuidedWorkflow(state, { type: "cancel" });
      expect(canceled).toEqual(initialGuidedWorkflowState);
      // A terminal state with a definition can always be replayed; one that
      // failed before a definition existed still has cancel.
      if (state.definition !== null) expect(replayed.status).toBe("active");
    }
  });
});

describe("guided workflow -- stale and duplicate events", () => {
  it("a duplicated Next cannot confirm the following step", () => {
    // Both actions were produced while step A was on screen. The first
    // confirms A; the second must not silently confirm B, which the user
    // never saw or agreed to.
    const onA = start();
    const duplicate = live(onA, "advance");

    const onB = reduceGuidedWorkflow(onA, duplicate);
    expect(onB.currentStepId).toBe("add-text");
    expect(onB.completedStepIds).toEqual(["choose-material"]);

    const afterDuplicate = reduceGuidedWorkflow(onB, duplicate);
    expect(afterDuplicate).toBe(onB);
    expect(afterDuplicate.completedStepIds).toEqual(["choose-material"]);
  });

  it("a delayed Skip for an earlier step cannot skip a later one", () => {
    // Skip was offered for the optional explanation on step A. It arrives
    // after the user already advanced past A; it must not skip B.
    const onA = start();
    const staleSkip = live(onA, "skip-step");
    const onB = dispatch(onA, "advance");

    const result = reduceGuidedWorkflow(onB, staleSkip);
    expect(result).toBe(onB);
    expect(result.currentStepId).toBe("add-text");
    expect(result.skippedStepIds).toEqual([]);
  });

  it("an event from an abandoned run cannot apply after cancel and restart", () => {
    // Same goal, same step id, different run: a step id alone would match.
    const firstRun = start(DEFINITION, "run-A");
    const inFlight = live(firstRun, "advance");

    expect(reduceGuidedWorkflow(firstRun, { type: "cancel" })).toEqual(initialGuidedWorkflowState);
    const secondRun = start(DEFINITION, "run-B");
    expect(secondRun.currentStepId).toBe(inFlight.expectedStepId);

    const result = reduceGuidedWorkflow(secondRun, inFlight);
    expect(result).toBe(secondRun);
    expect(result.completedStepIds).toEqual([]);
  });

  it("an event from the pre-replay run cannot apply after replay", () => {
    let state = start(DEFINITION, "run-A");
    const inFlight = live(state, "advance");
    for (let i = 0; i < DEFINITION.stepIds.length; i += 1) {
      state = dispatch(state, "advance");
    }
    expect(state.status).toBe("completed");

    const replayed = reduceGuidedWorkflow(state, { type: "replay", runToken: "run-B" });
    expect(replayed.currentStepId).toBe(inFlight.expectedStepId);
    expect(reduceGuidedWorkflow(replayed, inFlight)).toBe(replayed);
  });

  it("a delayed fail from an abandoned run cannot fail the new one", () => {
    const firstRun = start(DEFINITION, "run-A");
    const staleFail = live(firstRun, "fail", "worker crashed");

    reduceGuidedWorkflow(firstRun, { type: "cancel" });
    const secondRun = start(DEFINITION, "run-B");

    const result = reduceGuidedWorkflow(secondRun, staleFail);
    expect(result).toBe(secondRun);
    expect(result.status).toBe("active");
  });

  it("a stale dismiss cannot leave a run the user did not abandon", () => {
    const firstRun = start(DEFINITION, "run-A");
    const secondRun = start(DEFINITION, "run-B");
    expect(
      reduceGuidedWorkflow(secondRun, { type: "dismiss", runToken: firstRun.runToken ?? "" }),
    ).toBe(secondRun);
  });
});

describe("guided workflow -- input ownership", () => {
  it("mutating the caller's step list after start cannot corrupt live state", () => {
    // TypeScript's `readonly` is erased at runtime, so a caller can hand over
    // a valid definition, have it accepted, and then mutate the same array.
    // Without an owned copy this recreates the exact duplicate-id trap the
    // definition validator exists to prevent -- after validation has passed.
    const stepIds = ["A", "B"];
    const definition = {
      goal: "create-first-sign" as const,
      definitionVersion: 1,
      stepIds,
    };
    let state = reduceGuidedWorkflow(initialGuidedWorkflowState, {
      type: "start",
      definition,
      runToken: RUN,
    });
    expect(state.status).toBe("active");

    stepIds[1] = "A";

    expect(state.definition?.stepIds).toEqual(["A", "B"]);
    state = dispatch(state, "advance");
    expect(state.currentStepId).toBe("B");
    state = dispatch(state, "advance");
    expect(state.status).toBe("completed");
  });

  it("mutating the caller's snapshot arrays after resume cannot corrupt live progress", () => {
    const completedStepIds = ["choose-material"];
    const skippedStepIds: string[] = [];
    const snapshot = {
      goal: DEFINITION.goal,
      definitionVersion: DEFINITION.definitionVersion,
      currentStepId: "add-text",
      completedStepIds,
      skippedStepIds,
    };
    const state = reduceGuidedWorkflow(initialGuidedWorkflowState, {
      type: "resume",
      definition: DEFINITION,
      snapshot,
      runToken: RUN,
    });
    expect(state.completedStepIds).toEqual(["choose-material"]);

    completedStepIds.push("review-cutability");
    skippedStepIds.push("add-text");

    expect(state.completedStepIds).toEqual(["choose-material"]);
    expect(state.skippedStepIds).toEqual([]);
  });

  it("mutating a returned snapshot cannot reach back into live progress", () => {
    const state = advanceTo("review-cutability");
    const snapshot = toWorkflowSnapshot(state) as OnboardingWorkflowSnapshot;
    expect(snapshot.completedStepIds).toEqual(["choose-material", "add-text"]);

    // Frozen, so the attempt throws rather than silently corrupting state.
    expect(() => (snapshot.completedStepIds as string[]).push("review-cutability")).toThrow();
    expect(state.completedStepIds).toEqual(["choose-material", "add-text"]);
  });

  it("owned state arrays are frozen at every boundary", () => {
    const started = start();
    expect(Object.isFrozen(started.definition?.stepIds)).toBe(true);
    const advanced = dispatch(started, "advance");
    expect(Object.isFrozen(advanced.completedStepIds)).toBe(true);
    expect(Object.isFrozen(advanced.skippedStepIds)).toBe(true);
    const backed = dispatch(advanced, "back");
    expect(Object.isFrozen(backed.completedStepIds)).toBe(true);
  });
});

describe("guided workflow -- non-mutation", () => {
  it("never mutates the state object it was given, for every action type", () => {
    const sample = advanceTo("add-text");
    const identity = {
      expectedStepId: sample.currentStepId ?? "",
      runToken: sample.runToken ?? RUN,
    };
    const actions: GuidedWorkflowAction[] = [
      { type: "start", definition: DEFINITION, runToken: RUN },
      { type: "advance", ...identity },
      { type: "back", ...identity },
      { type: "skip-step", ...identity },
      { type: "dismiss", runToken: identity.runToken },
      {
        type: "resume",
        definition: DEFINITION,
        runToken: RUN,
        snapshot: {
          goal: DEFINITION.goal,
          definitionVersion: 1,
          currentStepId: "add-text",
          completedStepIds: ["choose-material"],
          skippedStepIds: [],
        },
      },
      { type: "replay", runToken: identity.runToken },
      { type: "cancel" },
      { type: "fail", reason: "x", ...identity },
    ];
    for (const action of actions) {
      const input = deepFreeze(advanceTo("add-text"));
      const before = structuredClone(input);
      expect(() => reduceGuidedWorkflow(input, action)).not.toThrow();
      expect(input).toEqual(before);
    }
  });

  it("takes no project or document argument -- non-mutation of authoritative state holds structurally", () => {
    expect(reduceGuidedWorkflow.length).toBe(2);
  });
});

describe("guided workflow -- goals", () => {
  it("every locked goal can start, complete, and cancel cleanly", () => {
    for (const goal of GOALS) {
      let state = start({ ...DEFINITION, goal });
      for (let i = 0; i < DEFINITION.stepIds.length; i += 1) {
        state = dispatch(state, "advance");
      }
      expect(state.status).toBe("completed");
      expect(reduceGuidedWorkflow(state, { type: "cancel" })).toEqual(initialGuidedWorkflowState);
    }
  });
});
