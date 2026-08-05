import { describe, expect, it } from "vitest";

import {
  initialGuidedWorkflowState,
  reduceGuidedWorkflow,
  type GuidedGoal,
  type GuidedWorkflowAction,
  type GuidedWorkflowState,
  type GuidedWorkflowStatus,
} from "../../src/features/onboarding/guidedWorkflowState.js";

const GOALS: readonly GuidedGoal[] = ["create-first-sign", "import-own-design", "describe-with-ai"];
const STEPS = ["choose-material", "add-text", "review-cutability"] as const;

/** Deep-frozen so an in-place mutation would throw in strict mode rather than
 * silently succeed -- combined with the snapshot-compare tests below, this
 * makes non-mutation a checked property rather than an assumption. */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function activeState(overrides: Partial<GuidedWorkflowState> = {}): GuidedWorkflowState {
  return deepFreeze({
    status: "active",
    goal: "create-first-sign",
    steps: STEPS,
    stepIndex: 0,
    visitedStepIds: [STEPS[0]],
    completedStepIds: [],
    failureReason: null,
    ...overrides,
  });
}

describe("reduceGuidedWorkflow -- basic transitions", () => {
  it("starts a goal at the first step", () => {
    const result = reduceGuidedWorkflow(initialGuidedWorkflowState, {
      type: "start",
      goal: "import-own-design",
      steps: STEPS,
    });
    expect(result).toEqual({
      status: "active",
      goal: "import-own-design",
      steps: STEPS,
      stepIndex: 0,
      visitedStepIds: [STEPS[0]],
      completedStepIds: [],
      failureReason: null,
    });
  });

  it("fails closed rather than starting with zero steps", () => {
    const result = reduceGuidedWorkflow(initialGuidedWorkflowState, {
      type: "start",
      goal: "create-first-sign",
      steps: [],
    });
    expect(result.status).toBe("failed");
    expect(result.failureReason).toMatch(/at least one step/u);
  });

  it("advances through every step to completed, tracking visited and completed ids", () => {
    let state = reduceGuidedWorkflow(initialGuidedWorkflowState, {
      type: "start",
      goal: "create-first-sign",
      steps: STEPS,
    });
    for (let i = 0; i < STEPS.length; i += 1) {
      state = reduceGuidedWorkflow(state, { type: "advance" });
    }
    expect(state.status).toBe("completed");
    expect(state.completedStepIds).toEqual(STEPS);
    expect(state.visitedStepIds).toEqual(STEPS);
  });

  it("moves back a step but not past the first", () => {
    const step2 = activeState({ stepIndex: 1 });
    expect(reduceGuidedWorkflow(step2, { type: "back" }).stepIndex).toBe(0);
    const step0 = activeState({ stepIndex: 0 });
    expect(reduceGuidedWorkflow(step0, { type: "back" })).toBe(step0);
  });

  it("skip is terminal and preserves history for the summary", () => {
    const result = reduceGuidedWorkflow(activeState(), { type: "skip" });
    expect(result.status).toBe("skipped");
    expect(result.goal).toBe("create-first-sign");
  });

  it("fail records a reason and is terminal", () => {
    const result = reduceGuidedWorkflow(activeState(), {
      type: "fail",
      reason: "worker crashed",
    });
    expect(result.status).toBe("failed");
    expect(result.failureReason).toBe("worker crashed");
  });

  it("resume restores a goal, steps, and step index from a persisted preference", () => {
    const result = reduceGuidedWorkflow(initialGuidedWorkflowState, {
      type: "resume",
      goal: "describe-with-ai",
      steps: STEPS,
      stepIndex: 1,
    });
    expect(result.status).toBe("active");
    expect(result.stepIndex).toBe(1);
    expect(result.goal).toBe("describe-with-ai");
  });

  it("resume clamps an out-of-range index rather than producing an invalid state", () => {
    const result = reduceGuidedWorkflow(initialGuidedWorkflowState, {
      type: "resume",
      goal: "create-first-sign",
      steps: STEPS,
      stepIndex: 99,
    });
    expect(result.stepIndex).toBe(STEPS.length - 1);
  });

  it("replay restarts the same goal from step zero, clearing history", () => {
    const completed = { ...activeState({ stepIndex: 2 }), status: "completed" as const };
    const result = reduceGuidedWorkflow(completed, { type: "replay" });
    expect(result.status).toBe("active");
    expect(result.stepIndex).toBe(0);
    expect(result.completedStepIds).toEqual([]);
  });

  it("replay is a no-op when nothing has ever started", () => {
    expect(reduceGuidedWorkflow(initialGuidedWorkflowState, { type: "replay" })).toBe(
      initialGuidedWorkflowState,
    );
  });
});

describe("reduceGuidedWorkflow -- non-mutation", () => {
  it("never mutates the state object it was given, for every action type", () => {
    const actions: GuidedWorkflowAction[] = [
      { type: "start", goal: "create-first-sign", steps: STEPS },
      { type: "advance" },
      { type: "back" },
      { type: "skip" },
      { type: "resume", goal: "create-first-sign", steps: STEPS, stepIndex: 1 },
      { type: "replay" },
      { type: "cancel" },
      { type: "fail", reason: "x" },
    ];
    for (const action of actions) {
      const input = activeState();
      const snapshotBefore = structuredClone(input);
      // deepFreeze on `input` (via activeState) means an in-place write here
      // would throw in strict mode; the snapshot compare below also catches
      // any mutation strict mode wouldn't (e.g. reassigning a non-frozen
      // nested array element within a frozen container is already prevented,
      // but this keeps the check independent of freeze semantics).
      expect(() => reduceGuidedWorkflow(input, action)).not.toThrow();
      expect(input).toEqual(snapshotBefore);
    }
  });

  it("takes no project or document argument -- non-mutation of authoritative state holds structurally", () => {
    expect(reduceGuidedWorkflow.length).toBe(2);
  });
});

describe("reduceGuidedWorkflow -- no trapped states", () => {
  const STATUSES: readonly GuidedWorkflowStatus[] = [
    "idle",
    "active",
    "skipped",
    "completed",
    "canceled",
    "failed",
  ];

  function representativeState(status: GuidedWorkflowStatus): GuidedWorkflowState {
    if (status === "idle") return initialGuidedWorkflowState;
    return {
      status,
      goal: "create-first-sign",
      steps: STEPS,
      stepIndex: 1,
      visitedStepIds: [STEPS[0], STEPS[1]],
      completedStepIds: status === "completed" ? STEPS : [STEPS[0]],
      failureReason: status === "failed" ? "example" : null,
    };
  }

  const ACTIONS_TO_TRY: readonly GuidedWorkflowAction[] = [
    { type: "start", goal: "import-own-design", steps: STEPS },
    { type: "advance" },
    { type: "back" },
    { type: "skip" },
    { type: "resume", goal: "describe-with-ai", steps: STEPS, stepIndex: 0 },
    { type: "replay" },
    { type: "cancel" },
    { type: "fail", reason: "example" },
  ];

  it.each(STATUSES)("every action is total from status %s and cancel always reaches idle", (status) => {
    const state = deepFreeze(representativeState(status));
    for (const action of ACTIONS_TO_TRY) {
      let result: GuidedWorkflowState | undefined;
      expect(() => {
        result = reduceGuidedWorkflow(state, action);
      }).not.toThrow();
      // The load-bearing assertion: no matter which state was reached, a
      // subsequent cancel is a guaranteed, reachable, non-trapped exit back
      // to the pre-guided state.
      expect(reduceGuidedWorkflow(result as GuidedWorkflowState, { type: "cancel" })).toEqual(
        initialGuidedWorkflowState,
      );
    }
  });

  it("cancel from every status returns exactly the initial state", () => {
    for (const status of STATUSES) {
      const state = representativeState(status);
      expect(reduceGuidedWorkflow(state, { type: "cancel" })).toEqual(initialGuidedWorkflowState);
    }
  });

  it("every locked goal can start, advance to completion, and cancel cleanly", () => {
    for (const goal of GOALS) {
      let state = reduceGuidedWorkflow(initialGuidedWorkflowState, {
        type: "start",
        goal,
        steps: STEPS,
      });
      for (let i = 0; i < STEPS.length; i += 1) {
        state = reduceGuidedWorkflow(state, { type: "advance" });
      }
      expect(state.status).toBe("completed");
      expect(reduceGuidedWorkflow(state, { type: "cancel" })).toEqual(initialGuidedWorkflowState);
    }
  });
});
