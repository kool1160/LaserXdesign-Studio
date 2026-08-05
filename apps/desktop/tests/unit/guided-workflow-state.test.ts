import { describe, expect, it } from "vitest";

import {
  ALLOWED_SOURCE_STATUSES,
  canResumeSnapshot,
  initialGuidedWorkflowState,
  initialOnboardingPreferences,
  isTerminalStatus,
  reduceGuidedWorkflow,
  toWorkflowSnapshot,
  type GuidedGoal,
  type GuidedWorkflowAction,
  type GuidedWorkflowActionType,
  type GuidedWorkflowDefinition,
  type GuidedWorkflowState,
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

function start(definition = DEFINITION): GuidedWorkflowState {
  return reduceGuidedWorkflow(initialGuidedWorkflowState, { type: "start", definition });
}

function advanceTo(stepId: string): GuidedWorkflowState {
  let state = start();
  while (state.currentStepId !== stepId && state.status === "active") {
    state = reduceGuidedWorkflow(state, { type: "advance" });
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
    expect(state.failureReason).toMatch(/at least one step/u);
  });

  it("advances through every step to completed", () => {
    let state = start();
    for (let i = 0; i < DEFINITION.stepIds.length; i += 1) {
      state = reduceGuidedWorkflow(state, { type: "advance" });
    }
    expect(state.status).toBe("completed");
    expect(state.completedStepIds).toEqual(DEFINITION.stepIds);
  });

  it("moves back by step id, never past the first step", () => {
    const second = advanceTo("add-text");
    expect(reduceGuidedWorkflow(second, { type: "back" }).currentStepId).toBe("choose-material");
    const first = start();
    expect(reduceGuidedWorkflow(first, { type: "back" })).toBe(first);
  });

  it("fail records a reason and is terminal", () => {
    const state = reduceGuidedWorkflow(start(), { type: "fail", reason: "worker crashed" });
    expect(state.status).toBe("failed");
    expect(state.failureReason).toBe("worker crashed");
  });

  it("replay restarts the same definition from the first step, clearing history", () => {
    let state = start();
    state = reduceGuidedWorkflow(state, { type: "skip-step" });
    state = reduceGuidedWorkflow(state, { type: "advance" });
    state = reduceGuidedWorkflow(state, { type: "advance" });
    expect(state.status).toBe("completed");

    const replayed = reduceGuidedWorkflow(state, { type: "replay" });
    expect(replayed.status).toBe("active");
    expect(replayed.currentStepId).toBe("choose-material");
    expect(replayed.completedStepIds).toEqual([]);
    expect(replayed.skippedStepIds).toEqual([]);
  });
});

describe("guided workflow -- skip a step versus leaving the workflow", () => {
  it("skip-step advances to the next step and keeps the workflow active", () => {
    const state = reduceGuidedWorkflow(start(), { type: "skip-step" });
    expect(state.status).toBe("active");
    expect(state.currentStepId).toBe("add-text");
    expect(state.skippedStepIds).toEqual(["choose-material"]);
    expect(state.completedStepIds).toEqual([]);
  });

  it("skip-step on the final step completes the workflow rather than erroring", () => {
    const last = advanceTo("review-cutability");
    const state = reduceGuidedWorkflow(last, { type: "skip-step" });
    expect(state.status).toBe("completed");
    expect(state.skippedStepIds).toContain("review-cutability");
  });

  it("dismiss leaves the workflow and is terminal", () => {
    const state = reduceGuidedWorkflow(start(), { type: "dismiss" });
    expect(state.status).toBe("dismissed");
    expect(state.currentStepId).toBe("choose-material");
  });

  it("a step is never recorded as both completed and skipped", () => {
    // Skip a step, go back, then complete it: the earlier skip must not linger.
    let state = reduceGuidedWorkflow(start(), { type: "skip-step" });
    expect(state.skippedStepIds).toEqual(["choose-material"]);
    state = reduceGuidedWorkflow(state, { type: "back" });
    state = reduceGuidedWorkflow(state, { type: "advance" });
    expect(state.completedStepIds).toEqual(["choose-material"]);
    expect(state.skippedStepIds).toEqual([]);
  });
});

describe("guided workflow -- persistence round trip", () => {
  it("captures no snapshot when there is nothing meaningful to resume", () => {
    expect(toWorkflowSnapshot(initialGuidedWorkflowState)).toBeNull();
    const completed = reduceGuidedWorkflow(
      reduceGuidedWorkflow(reduceGuidedWorkflow(start(), { type: "advance" }), { type: "advance" }),
      { type: "advance" },
    );
    expect(completed.status).toBe("completed");
    expect(toWorkflowSnapshot(completed)).toBeNull();
  });

  it("reconstructs the exact interrupted state from the persisted shape alone", () => {
    // Build real progress, persist only what OnboardingPreferences stores,
    // then restore from that snapshot and nothing else.
    let live = reduceGuidedWorkflow(start(), { type: "skip-step" });
    live = reduceGuidedWorkflow(live, { type: "advance" });
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

    const restored = reduceGuidedWorkflow(initialGuidedWorkflowState, {
      type: "resume",
      definition: DEFINITION,
      snapshot: reloaded.activeWorkflow as OnboardingWorkflowSnapshot,
    });

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
    const restored = reduceGuidedWorkflow(initialGuidedWorkflowState, {
      type: "resume",
      definition: newerDefinition,
      snapshot: snapshot as OnboardingWorkflowSnapshot,
    });
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
      reduceGuidedWorkflow(initialGuidedWorkflowState, {
        type: "resume",
        definition: withoutStep,
        snapshot: snapshot as OnboardingWorkflowSnapshot,
      }),
    ).toEqual(initialGuidedWorkflowState);
  });

  it("refuses to resume a snapshot from a different goal", () => {
    const snapshot = toWorkflowSnapshot(advanceTo("add-text"));
    const otherGoal = { ...DEFINITION, goal: "import-own-design" as const };
    expect(canResumeSnapshot(otherGoal, snapshot as OnboardingWorkflowSnapshot)).toBe(false);
  });
});

describe("guided workflow -- transition table", () => {
  const ALL_STATUSES = ["idle", "active", "completed", "dismissed", "failed"] as const;

  function actionOfType(type: GuidedWorkflowActionType): GuidedWorkflowAction {
    switch (type) {
      case "start":
        return { type: "start", definition: DEFINITION };
      case "resume":
        return {
          type: "resume",
          definition: DEFINITION,
          snapshot: {
            goal: DEFINITION.goal,
            definitionVersion: DEFINITION.definitionVersion,
            currentStepId: "add-text",
            completedStepIds: ["choose-material"],
            skippedStepIds: [],
          },
        };
      case "fail":
        return { type: "fail", reason: "example" };
      default:
        return { type };
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
        const next = reduceGuidedWorkflow(current, actionOfType(type));
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
        expect(reduceGuidedWorkflow(state, actionOfType(type))).toBe(state);
      }
    }
  });

  it("a stale start cannot reset an active journey", () => {
    const midway = advanceTo("add-text");
    expect(reduceGuidedWorkflow(midway, { type: "start", definition: DEFINITION })).toBe(midway);
  });

  it("a stale resume cannot overwrite a terminal record", () => {
    const dismissed = reduceGuidedWorkflow(start(), { type: "dismiss" });
    expect(reduceGuidedWorkflow(dismissed, actionOfType("resume"))).toBe(dismissed);
  });

  it("every reachable non-terminal state has a valid forward exit and a cancel exit", () => {
    for (const [, state] of reachableStates()) {
      // cancel is always available, from every reachable state.
      expect(reduceGuidedWorkflow(state, { type: "cancel" })).toEqual(initialGuidedWorkflowState);

      if (state.status === "idle" || isTerminalStatus(state.status)) continue;

      // A non-terminal state must also be able to move forward on its own,
      // so a user is never stuck needing to abandon the workflow entirely.
      const forward = reduceGuidedWorkflow(state, { type: "advance" });
      expect(forward).not.toBe(state);
    }
  });

  it("every reachable terminal state can be replayed or canceled", () => {
    for (const [, state] of reachableStates()) {
      if (!isTerminalStatus(state.status)) continue;
      const replayed = reduceGuidedWorkflow(state, { type: "replay" });
      const canceled = reduceGuidedWorkflow(state, { type: "cancel" });
      expect(canceled).toEqual(initialGuidedWorkflowState);
      // A terminal state with a definition can always be replayed; one that
      // failed before a definition existed still has cancel.
      if (state.definition !== null) expect(replayed.status).toBe("active");
    }
  });
});

describe("guided workflow -- non-mutation", () => {
  it("never mutates the state object it was given, for every action type", () => {
    const actions: GuidedWorkflowAction[] = [
      { type: "start", definition: DEFINITION },
      { type: "advance" },
      { type: "back" },
      { type: "skip-step" },
      { type: "dismiss" },
      {
        type: "resume",
        definition: DEFINITION,
        snapshot: {
          goal: DEFINITION.goal,
          definitionVersion: 1,
          currentStepId: "add-text",
          completedStepIds: [],
          skippedStepIds: [],
        },
      },
      { type: "replay" },
      { type: "cancel" },
      { type: "fail", reason: "x" },
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
        state = reduceGuidedWorkflow(state, { type: "advance" });
      }
      expect(state.status).toBe("completed");
      expect(reduceGuidedWorkflow(state, { type: "cancel" })).toEqual(initialGuidedWorkflowState);
    }
  });
});
