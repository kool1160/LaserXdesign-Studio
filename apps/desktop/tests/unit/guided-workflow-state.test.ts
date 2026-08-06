import { describe, expect, it } from "vitest";

import {
  ALLOWED_SOURCE_STATUSES,
  canCompleteResolution,
  canResumeSnapshot,
  initialGuidedWorkflowState,
  initialOnboardingPreferences,
  isStepSkippable,
  isStepTransient,
  isTerminalStatus,
  isUsableProjectBinding,
  isValidWorkflowDefinition,
  reduceGuidedWorkflow,
  resolutionPrimaryAction,
  resolveResumeStepId,
  shouldAutoCompleteResolution,
  toWorkflowSnapshot,
  type GuidedGoal,
  type GuidedProjectBinding,
  type GuidedWorkflowAction,
  type GuidedWorkflowActionType,
  type GuidedWorkflowDefinition,
  type GuidedWorkflowState,
  type ResolutionFindingCounts,
  type StepScopedAction,
  type OnboardingWorkflowSnapshot,
} from "../../src/features/onboarding/guidedWorkflowState.js";

const GOALS: readonly GuidedGoal[] = ["create-first-sign", "import-own-design", "describe-with-ai"];

/** The document the guided run is bound to in most tests. */
const BINDING: GuidedProjectBinding = { documentId: "doc-1", fingerprint: "fp-1" };

const DEFINITION: GuidedWorkflowDefinition = {
  goal: "create-first-sign",
  definitionVersion: 1,
  stepIds: ["choose-material", "add-text", "review-cutability"],
  // Every step skippable here: this fixture drives the generic skip-step
  // mechanics tests (recording, ordering, non-mutation, staleness, ...),
  // which are unrelated to eligibility. Skip-eligibility gating itself is
  // covered by MIXED_SKIP_DEFINITION below.
  skippableStepIds: ["choose-material", "add-text", "review-cutability"],
  transientStepIds: [],
};

/**
 * Models a repair/decision-shaped goal: one genuinely optional explanation
 * step, plus required analysis, physical-3D, and export-precondition steps
 * -- exactly the shape the locked M15 product direction requires (physical
 * 3D is a required checkpoint before export; analysis/repair stages must not
 * be bypassable). Only "learn-about-scale" is skippable.
 */
const MIXED_SKIP_DEFINITION: GuidedWorkflowDefinition = {
  goal: "import-own-design",
  definitionVersion: 1,
  stepIds: ["choose-file", "learn-about-scale", "analyze-cutability", "physical-3d", "export"],
  skippableStepIds: ["learn-about-scale"],
  transientStepIds: [],
};

/**
 * The locked stable-linear-superset shape for Import My Own Design (ADR 0027
 * §3): one stable source-preparation step whose vector/raster presentation is
 * a contextual variant, and one always-present resolution checkpoint.
 * `prepare-source` and `resolve-findings` depend on transient in-memory state
 * (a preview slot, current analysis results) and are marked so.
 */
const IMPORT_GOAL_DEFINITION: GuidedWorkflowDefinition = {
  goal: "import-own-design",
  definitionVersion: 1,
  stepIds: [
    "choose-file",
    "prepare-source",
    "assign-physical",
    "analyze-cutability",
    "resolve-findings",
    "physical-3d",
    "export",
  ],
  skippableStepIds: [],
  transientStepIds: ["prepare-source", "resolve-findings"],
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

    const replayed = reduceGuidedWorkflow(state, {
      type: "replay",
      expectedRunToken: state.runToken ?? "",
      nextRunToken: "run-token-2",
    });
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
    ["a transientStepIds entry naming no real step", { ...DEFINITION, transientStepIds: ["ghost"] }],
    [
      "a duplicate entry within transientStepIds",
      { ...DEFINITION, transientStepIds: ["add-text", "add-text"] },
    ],
    ["a blank transientStepIds entry", { ...DEFINITION, transientStepIds: ["  "] }],
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
      liveBinding: BINDING,
      snapshot: {
        goal: trapped.goal,
        definitionVersion: trapped.definitionVersion,
        currentStepId: "b",
        completedStepIds: ["a"],
        skippedStepIds: [],
        projectBinding: BINDING,
      },
    });
    expect(resumed).toEqual(initialGuidedWorkflowState);

    const failedStart = start(trapped);
    expect(
      reduceGuidedWorkflow(failedStart, {
        type: "replay",
        expectedRunToken: failedStart.runToken ?? "",
        nextRunToken: "run-token-2",
      }).status,
    ).toBe("failed");
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

describe("guided workflow -- skip eligibility is locked in the definition", () => {
  function startMixed(runToken = RUN): GuidedWorkflowState {
    return reduceGuidedWorkflow(initialGuidedWorkflowState, {
      type: "start",
      definition: MIXED_SKIP_DEFINITION,
      runToken,
    });
  }

  it("rejects a skippableStepIds entry that names no real step", () => {
    const invalid = { ...MIXED_SKIP_DEFINITION, skippableStepIds: ["not-a-real-step"] };
    expect(isValidWorkflowDefinition(invalid)).toBe(false);
  });

  it("rejects a duplicate entry within skippableStepIds", () => {
    const invalid = {
      ...MIXED_SKIP_DEFINITION,
      skippableStepIds: ["learn-about-scale", "learn-about-scale"],
    };
    expect(isValidWorkflowDefinition(invalid)).toBe(false);
  });

  it("accepts an empty skippableStepIds -- a definition may require every step", () => {
    expect(isValidWorkflowDefinition({ ...MIXED_SKIP_DEFINITION, skippableStepIds: [] })).toBe(
      true,
    );
  });

  it("isStepSkippable reflects exactly the locked set", () => {
    expect(isStepSkippable(MIXED_SKIP_DEFINITION, "learn-about-scale")).toBe(true);
    expect(isStepSkippable(MIXED_SKIP_DEFINITION, "analyze-cutability")).toBe(false);
    expect(isStepSkippable(MIXED_SKIP_DEFINITION, "choose-file")).toBe(false);
    expect(isStepSkippable(MIXED_SKIP_DEFINITION, null)).toBe(false);
  });

  it("a genuinely optional explanation step really can be skipped", () => {
    let state = startMixed();
    expect(state.currentStepId).toBe("choose-file");
    state = dispatch(state, "advance");
    expect(state.currentStepId).toBe("learn-about-scale");

    state = dispatch(state, "skip-step");
    expect(state.currentStepId).toBe("analyze-cutability");
    expect(state.skippedStepIds).toEqual(["learn-about-scale"]);
    expect(state.status).toBe("active");
  });

  it("skip-step is a same-reference no-op on the required cutability-analysis step", () => {
    let state = startMixed();
    state = dispatch(state, "advance"); // learn-about-scale
    state = dispatch(state, "skip-step"); // skip the optional step
    expect(state.currentStepId).toBe("analyze-cutability");

    const before = state;
    const after = dispatch(state, "skip-step");
    expect(after).toBe(before);
    expect(after.currentStepId).toBe("analyze-cutability");
    expect(after.skippedStepIds).toEqual(["learn-about-scale"]);
    expect(after.completedStepIds).toEqual(["choose-file"]);
  });

  it("skip-step is a same-reference no-op on the required physical-3D checkpoint", () => {
    let state = startMixed();
    state = dispatch(state, "advance"); // learn-about-scale
    state = dispatch(state, "skip-step"); // skip the optional step
    state = dispatch(state, "advance"); // complete analyze-cutability
    expect(state.currentStepId).toBe("physical-3d");

    const before = state;
    const after = dispatch(state, "skip-step");
    expect(after).toBe(before);
    expect(after.currentStepId).toBe("physical-3d");
  });

  it("skip-step is a same-reference no-op on the required export-precondition step", () => {
    let state = startMixed();
    state = dispatch(state, "advance");
    state = dispatch(state, "skip-step");
    state = dispatch(state, "advance"); // physical-3d
    state = dispatch(state, "advance"); // export
    expect(state.currentStepId).toBe("export");

    const before = state;
    const after = dispatch(state, "skip-step");
    expect(after).toBe(before);
    expect(after.currentStepId).toBe("export");
  });

  it("cancel and advance remain unconditionally available on a required step even though skip is refused", () => {
    // The guard must be specific to skip-step: cancel is still the
    // unconditional global escape, and advance still works normally.
    let state = startMixed();
    state = dispatch(state, "advance");
    state = dispatch(state, "skip-step");
    expect(state.currentStepId).toBe("analyze-cutability");

    expect(dispatch(state, "advance").currentStepId).toBe("physical-3d");
    expect(reduceGuidedWorkflow(state, { type: "cancel" })).toBe(initialGuidedWorkflowState);
  });

  it("resume refuses a snapshot claiming a required step was skipped", () => {
    const snapshot: OnboardingWorkflowSnapshot = {
      goal: MIXED_SKIP_DEFINITION.goal,
      definitionVersion: MIXED_SKIP_DEFINITION.definitionVersion,
      currentStepId: "physical-3d",
      completedStepIds: ["choose-file"],
      // analyze-cutability is not in skippableStepIds -- the reducer could
      // never have produced this snapshot.
      skippedStepIds: ["learn-about-scale", "analyze-cutability"],
      projectBinding: BINDING,
    };
    expect(canResumeSnapshot(MIXED_SKIP_DEFINITION, snapshot, BINDING)).toBe(false);
    expect(
      reduceGuidedWorkflow(initialGuidedWorkflowState, {
        type: "resume",
        definition: MIXED_SKIP_DEFINITION,
        snapshot,
        runToken: RUN,
        liveBinding: BINDING,
      }),
    ).toEqual(initialGuidedWorkflowState);
  });

  it("resume accepts a snapshot where only the truly skippable step was recorded as skipped", () => {
    const snapshot: OnboardingWorkflowSnapshot = {
      goal: MIXED_SKIP_DEFINITION.goal,
      definitionVersion: MIXED_SKIP_DEFINITION.definitionVersion,
      currentStepId: "physical-3d",
      completedStepIds: ["choose-file", "analyze-cutability"],
      skippedStepIds: ["learn-about-scale"],
      projectBinding: BINDING,
    };
    expect(canResumeSnapshot(MIXED_SKIP_DEFINITION, snapshot, BINDING)).toBe(true);
    const restored = reduceGuidedWorkflow(initialGuidedWorkflowState, {
      type: "resume",
      definition: MIXED_SKIP_DEFINITION,
      snapshot,
      runToken: RUN,
      liveBinding: BINDING,
    });
    expect(restored.status).toBe("active");
    expect(restored.currentStepId).toBe("physical-3d");
  });
});

describe("guided workflow -- persistence round trip", () => {
  it("captures no snapshot when there is nothing meaningful to resume", () => {
    expect(toWorkflowSnapshot(initialGuidedWorkflowState, BINDING)).toBeNull();
    const completed = dispatch(dispatch(dispatch(start(), "advance"), "advance"), "advance");
    expect(completed.status).toBe("completed");
    expect(toWorkflowSnapshot(completed, BINDING)).toBeNull();
  });

  it("reconstructs the exact interrupted state from the persisted shape alone", () => {
    // Build real progress, persist only what OnboardingPreferences stores,
    // then restore from that snapshot and nothing else.
    let live = dispatch(start(), "skip-step");
    live = dispatch(live, "advance");
    expect(live.currentStepId).toBe("review-cutability");

    const snapshot = toWorkflowSnapshot(live, BINDING);
    expect(snapshot).not.toBeNull();

    const persisted = {
      ...initialOnboardingPreferences,
      activeWorkflow: snapshot,
    };
    // Round-trip through JSON: the store writes a file, so anything that
    // survives resume must survive serialization.
    const reloaded = JSON.parse(JSON.stringify(persisted)) as typeof persisted;
    expect(reloaded.activeWorkflow).not.toBeNull();

    const restored = reduceGuidedWorkflow(initialGuidedWorkflowState, { type: "resume", definition: DEFINITION, snapshot: reloaded.activeWorkflow as OnboardingWorkflowSnapshot, runToken: RUN, liveBinding: BINDING });

    expect(restored.status).toBe("active");
    expect(restored.currentStepId).toBe(live.currentStepId);
    expect(restored.completedStepIds).toEqual(live.completedStepIds);
    expect(restored.skippedStepIds).toEqual(live.skippedStepIds);
  });

  it("refuses to resume across a definition version change instead of inventing progress", () => {
    const snapshot = toWorkflowSnapshot(advanceTo("add-text"), BINDING);
    expect(snapshot).not.toBeNull();
    const newerDefinition = { ...DEFINITION, definitionVersion: 2 };

    expect(canResumeSnapshot(newerDefinition, snapshot as OnboardingWorkflowSnapshot, BINDING)).toBe(false);
    const restored = reduceGuidedWorkflow(initialGuidedWorkflowState, { type: "resume", definition: newerDefinition, snapshot: snapshot as OnboardingWorkflowSnapshot, runToken: RUN, liveBinding: BINDING });
    expect(restored).toEqual(initialGuidedWorkflowState);
  });

  it("refuses to resume a step the definition no longer contains", () => {
    const snapshot = toWorkflowSnapshot(advanceTo("add-text"), BINDING);
    const withoutStep = {
      ...DEFINITION,
      stepIds: ["choose-material", "review-cutability"],
    };

    expect(canResumeSnapshot(withoutStep, snapshot as OnboardingWorkflowSnapshot, BINDING)).toBe(false);
    expect(
      reduceGuidedWorkflow(initialGuidedWorkflowState, { type: "resume", definition: withoutStep, snapshot: snapshot as OnboardingWorkflowSnapshot, runToken: RUN, liveBinding: BINDING }),
    ).toEqual(initialGuidedWorkflowState);
  });

  it("refuses to resume a snapshot from a different goal", () => {
    const snapshot = toWorkflowSnapshot(advanceTo("add-text"), BINDING);
    const otherGoal = { ...DEFINITION, goal: "import-own-design" as const };
    expect(canResumeSnapshot(otherGoal, snapshot as OnboardingWorkflowSnapshot, BINDING)).toBe(false);
  });

  const base = {
    goal: DEFINITION.goal,
    definitionVersion: DEFINITION.definitionVersion,
    projectBinding: BINDING,
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
    expect(canResumeSnapshot(DEFINITION, snapshot, BINDING)).toBe(false);
    expect(
      reduceGuidedWorkflow(initialGuidedWorkflowState, {
        type: "resume",
        definition: DEFINITION,
        snapshot,
        runToken: RUN,
        liveBinding: BINDING,
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
      projectBinding: BINDING,
    };
    expect(canResumeSnapshot(DEFINITION, gap, BINDING)).toBe(false);
    expect(
      reduceGuidedWorkflow(initialGuidedWorkflowState, { type: "resume", definition: DEFINITION, snapshot: gap, runToken: RUN, liveBinding: BINDING }),
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
      projectBinding: BINDING,
    };
    expect(canResumeSnapshot(DEFINITION, outOfOrder, BINDING)).toBe(false);
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
        const snapshot = toWorkflowSnapshot(state, BINDING);
        expect(snapshot).not.toBeNull();
        expect(canResumeSnapshot(DEFINITION, snapshot as OnboardingWorkflowSnapshot, BINDING)).toBe(
          true,
        );
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

    const snapshot = toWorkflowSnapshot(live, BINDING);
    expect(snapshot).not.toBeNull();
    expect(canResumeSnapshot(DEFINITION, snapshot as OnboardingWorkflowSnapshot, BINDING)).toBe(
      true,
    );

    const restored = reduceGuidedWorkflow(initialGuidedWorkflowState, { type: "resume", definition: DEFINITION, snapshot: snapshot as OnboardingWorkflowSnapshot, runToken: RUN, liveBinding: BINDING });
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
          liveBinding: BINDING,
          snapshot: {
            goal: DEFINITION.goal,
            definitionVersion: DEFINITION.definitionVersion,
            currentStepId: "add-text",
            completedStepIds: ["choose-material"],
            skippedStepIds: [],
            projectBinding: BINDING,
          },
        };
      case "replay":
        return {
          type,
          expectedRunToken: state.runToken ?? RUN,
          nextRunToken: state.runToken === "replay-a" ? "replay-b" : "replay-a",
        };
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
      const replayed = reduceGuidedWorkflow(state, {
        type: "replay",
        expectedRunToken: state.runToken ?? "",
        nextRunToken: state.runToken === "replay-a" ? "replay-b" : "replay-a",
      });
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

    const replayed = reduceGuidedWorkflow(state, {
      type: "replay",
      expectedRunToken: state.runToken ?? "",
      nextRunToken: "run-B",
    });
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

  it("a delayed replay from an earlier run cannot restart a later terminal run", () => {
    // Run A finishes and the user asks to replay it. Before that event is
    // handled, run B becomes the current terminal state. The delayed replay
    // must not restart B -- it was a decision about A.
    let runA = start(DEFINITION, "run-A");
    for (let i = 0; i < DEFINITION.stepIds.length; i += 1) runA = dispatch(runA, "advance");
    expect(runA.status).toBe("completed");
    const delayedReplay = {
      type: "replay" as const,
      expectedRunToken: "run-A",
      nextRunToken: "run-A-next",
    };

    reduceGuidedWorkflow(runA, { type: "cancel" });
    let runB = start(DEFINITION, "run-B");
    runB = reduceGuidedWorkflow(runB, { type: "dismiss", runToken: "run-B" });
    expect(runB.status).toBe("dismissed");

    expect(reduceGuidedWorkflow(runB, delayedReplay)).toBe(runB);
  });

  it("replay refuses to reuse the token of the run it restarts", () => {
    // Reusing the token would let step events still in flight from the
    // finished run match the fresh one.
    let state = start(DEFINITION, "run-A");
    const inFlight = live(state, "advance");
    for (let i = 0; i < DEFINITION.stepIds.length; i += 1) state = dispatch(state, "advance");

    const sameToken = reduceGuidedWorkflow(state, {
      type: "replay",
      expectedRunToken: "run-A",
      nextRunToken: "run-A",
    });
    expect(sameToken).toBe(state);

    // With a genuinely fresh token the replay succeeds, and the old in-flight
    // step event still cannot apply to it.
    const replayed = reduceGuidedWorkflow(state, {
      type: "replay",
      expectedRunToken: "run-A",
      nextRunToken: "run-B",
    });
    expect(replayed.status).toBe("active");
    expect(reduceGuidedWorkflow(replayed, inFlight)).toBe(replayed);
  });

  it("rejects a blank run token rather than making every run indistinguishable", () => {
    for (const blank of ["", "   "]) {
      const started = start(DEFINITION, blank);
      expect(started.status).toBe("failed");
      expect(started.failureReason).toMatch(/non-blank run token/u);

      expect(
        reduceGuidedWorkflow(initialGuidedWorkflowState, {
          type: "resume",
          definition: DEFINITION,
          runToken: blank,
          liveBinding: BINDING,
          snapshot: {
            goal: DEFINITION.goal,
            definitionVersion: DEFINITION.definitionVersion,
            currentStepId: "add-text",
            completedStepIds: ["choose-material"],
            skippedStepIds: [],
            projectBinding: BINDING,
          },
        }),
      ).toEqual(initialGuidedWorkflowState);
    }

    let terminal = start(DEFINITION, "run-A");
    for (let i = 0; i < DEFINITION.stepIds.length; i += 1) terminal = dispatch(terminal, "advance");
    expect(
      reduceGuidedWorkflow(terminal, {
        type: "replay",
        expectedRunToken: "run-A",
        nextRunToken: "  ",
      }),
    ).toBe(terminal);
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
      skippableStepIds: [],
      transientStepIds: [],
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
      projectBinding: BINDING,
    };
    const state = reduceGuidedWorkflow(initialGuidedWorkflowState, {
      type: "resume",
      definition: DEFINITION,
      snapshot,
      runToken: RUN,
      liveBinding: BINDING,
    });
    expect(state.completedStepIds).toEqual(["choose-material"]);

    completedStepIds.push("review-cutability");
    skippedStepIds.push("add-text");

    expect(state.completedStepIds).toEqual(["choose-material"]);
    expect(state.skippedStepIds).toEqual([]);
  });

  it("mutating a returned snapshot cannot reach back into live progress", () => {
    const state = advanceTo("review-cutability");
    const snapshot = toWorkflowSnapshot(state, BINDING) as OnboardingWorkflowSnapshot;
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
        liveBinding: BINDING,
        snapshot: {
          goal: DEFINITION.goal,
          definitionVersion: 1,
          currentStepId: "add-text",
          completedStepIds: ["choose-material"],
          skippedStepIds: [],
          projectBinding: BINDING,
        },
      },
      { type: "replay", expectedRunToken: identity.runToken, nextRunToken: "run-token-next" },
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

describe("guided workflow -- stable linear superset (ADR 0027 §3)", () => {
  function startImport(runToken = RUN): GuidedWorkflowState {
    return reduceGuidedWorkflow(initialGuidedWorkflowState, {
      type: "start",
      definition: IMPORT_GOAL_DEFINITION,
      runToken,
    });
  }

  it("the vector and raster paths traverse the same stable step ids with no branch action and no definition change", () => {
    // The vector/raster split is a contextual presentation variant of the one
    // stable prepare-source step, decided by classifying the selected file --
    // it is not a different step sequence. Both paths are therefore the same
    // reducer walk: same ids, same definition object from start to completion,
    // no branch action, no definition mutation, no cancel/restart.
    for (const variant of ["vector", "raster"] as const) {
      let state = startImport();
      const definitionAtStart = state.definition;
      const visited: string[] = [];
      while (state.status === "active") {
        visited.push(state.currentStepId ?? "");
        state = dispatch(state, "advance");
        // The definition never changes identity mid-run -- the walk needs no
        // per-variant definition swap.
        expect(state.definition).toBe(definitionAtStart);
      }
      expect(state.status).toBe("completed");
      expect(visited).toEqual([...IMPORT_GOAL_DEFINITION.stepIds]);
      expect(variant).toBeTruthy();
    }
  });

  it("the resolution checkpoint is always present and auto-completes through an ordinary advance when nothing is actionable", () => {
    // Route "no actionable findings": the checkpoint is still in stepIds; the
    // caller sees shouldAutoCompleteResolution(...) true at the moment it
    // opens and advances immediately, so no stage is presented and no skip is
    // recorded. canCompleteResolution alone is never the auto-advance trigger.
    const noFindings: ResolutionFindingCounts = {
      safeFixableCount: 0,
      needsDecisionCount: 0,
      blockingCount: 0,
    };
    expect(resolutionPrimaryAction(noFindings)).toBe("continue");
    expect(shouldAutoCompleteResolution(noFindings)).toBe(true);
    expect(canCompleteResolution(noFindings)).toBe(true);

    let state = startImport();
    while (state.currentStepId !== "resolve-findings" && state.status === "active") {
      state = dispatch(state, "advance");
    }
    expect(state.currentStepId).toBe("resolve-findings");

    const autoCompleted = dispatch(state, "advance");
    expect(autoCompleted.currentStepId).toBe("physical-3d");
    expect(autoCompleted.completedStepIds).toContain("resolve-findings");
    expect(autoCompleted.skippedStepIds).toEqual([]);
  });

  it("the resolution checkpoint cannot be skipped and cancel remains the exit while findings block", () => {
    let state = startImport();
    while (state.currentStepId !== "resolve-findings" && state.status === "active") {
      state = dispatch(state, "advance");
    }

    // Blocking findings: the caller must not advance (canCompleteResolution is
    // false), and skip-step is structurally refused because the checkpoint is
    // never in skippableStepIds.
    const blocking: ResolutionFindingCounts = {
      safeFixableCount: 2,
      needsDecisionCount: 3,
      blockingCount: 1,
    };
    expect(canCompleteResolution(blocking)).toBe(false);
    expect(isStepSkippable(IMPORT_GOAL_DEFINITION, "resolve-findings")).toBe(false);
    expect(dispatch(state, "skip-step")).toBe(state);

    // The global escape stays unconditional -- a large finding count is never
    // a trap.
    expect(reduceGuidedWorkflow(state, { type: "cancel" })).toBe(initialGuidedWorkflowState);
  });
});

describe("guided workflow -- deterministic resolution routing", () => {
  const counts = (
    safeFixableCount: number,
    needsDecisionCount: number,
    blockingCount: number,
  ): ResolutionFindingCounts => ({ safeFixableCount, needsDecisionCount, blockingCount });

  it("safe fixes win first: Fix safe problems is primary whenever eligible safe fixes exist", () => {
    expect(resolutionPrimaryAction(counts(1, 0, 0))).toBe("fix-safe-problems");
    expect(resolutionPrimaryAction(counts(4, 7, 0))).toBe("fix-safe-problems");
    // Even alongside blocking findings -- the overlap the old four-route
    // wording left undefined resolves to exactly one action.
    expect(resolutionPrimaryAction(counts(4, 7, 2))).toBe("fix-safe-problems");
  });

  it("after safe fixes are exhausted, Review decisions is primary while anything needs attention", () => {
    expect(resolutionPrimaryAction(counts(0, 5, 0))).toBe("review-decisions");
    expect(resolutionPrimaryAction(counts(0, 0, 3))).toBe("review-decisions");
    expect(resolutionPrimaryAction(counts(0, 5, 3))).toBe("review-decisions");
  });

  it("Continue is primary only when nothing is actionable, and completion then always holds", () => {
    expect(resolutionPrimaryAction(counts(0, 0, 0))).toBe("continue");
    expect(canCompleteResolution(counts(0, 0, 0))).toBe(true);
  });

  it("the checkpoint unlocks exactly when no blocking findings remain", () => {
    expect(canCompleteResolution(counts(0, 0, 1))).toBe(false);
    expect(canCompleteResolution(counts(5, 5, 1))).toBe(false);
    // Non-blocking suggestions never trap the user: Review decisions stays
    // primary, but Continue is allowed.
    expect(canCompleteResolution(counts(0, 5, 0))).toBe(true);
    expect(canCompleteResolution(counts(3, 0, 0))).toBe(true);
  });

  it("exactly one primary action applies for every count combination", () => {
    for (const safe of [0, 1, 3]) {
      for (const decisions of [0, 1, 3]) {
        for (const blocking of [0, 1, 3]) {
          const action = resolutionPrimaryAction(counts(safe, decisions, blocking));
          if (safe > 0) expect(action).toBe("fix-safe-problems");
          else if (decisions > 0 || blocking > 0) expect(action).toBe("review-decisions");
          else expect(action).toBe("continue");
          // Continue while completion is refused is contradictory and must be
          // impossible by construction.
          if (action === "continue") {
            expect(canCompleteResolution(counts(safe, decisions, blocking))).toBe(true);
          }
        }
      }
    }
  });

  it("malformed counts fail closed: a human reviews and the checkpoint never unlocks", () => {
    for (const bad of [counts(-1, 0, 0), counts(0, 1.5, 0), counts(0, 0, Number.NaN)]) {
      expect(resolutionPrimaryAction(bad)).toBe("review-decisions");
      expect(canCompleteResolution(bad)).toBe(false);
      expect(shouldAutoCompleteResolution(bad)).toBe(false);
    }
  });

  it("safe fixes do not auto-complete the checkpoint even though Continue is permitted", () => {
    // Permission to leave and "nothing to show" are different decisions. If
    // the caller auto-advanced on canCompleteResolution, a checkpoint with
    // only non-blocking safe fixes would be silently bypassed and Fix safe
    // problems -- the flagship repair action -- would never be presented.
    const safeOnly = counts(3, 0, 0);
    expect(canCompleteResolution(safeOnly)).toBe(true);
    expect(shouldAutoCompleteResolution(safeOnly)).toBe(false);
    expect(resolutionPrimaryAction(safeOnly)).toBe("fix-safe-problems");
  });

  it("non-blocking decisions do not auto-complete the checkpoint even though Continue is permitted", () => {
    const decisionsOnly = counts(0, 5, 0);
    expect(canCompleteResolution(decisionsOnly)).toBe(true);
    expect(shouldAutoCompleteResolution(decisionsOnly)).toBe(false);
    expect(resolutionPrimaryAction(decisionsOnly)).toBe("review-decisions");

    const both = counts(3, 5, 0);
    expect(canCompleteResolution(both)).toBe(true);
    expect(shouldAutoCompleteResolution(both)).toBe(false);
  });

  it("only the all-zero counts auto-complete, and never anything blocked", () => {
    expect(shouldAutoCompleteResolution(counts(0, 0, 0))).toBe(true);
    expect(shouldAutoCompleteResolution(counts(0, 0, 1))).toBe(false);
    expect(shouldAutoCompleteResolution(counts(1, 0, 1))).toBe(false);
  });

  it("auto-completion agrees with the primary action for every count combination", () => {
    // The unseen path exists exactly when Continue is the primary action --
    // pinned so the two rules cannot drift apart.
    for (const safe of [0, 1, 3]) {
      for (const decisions of [0, 1, 3]) {
        for (const blocking of [0, 1, 3]) {
          const c = counts(safe, decisions, blocking);
          expect(shouldAutoCompleteResolution(c)).toBe(
            resolutionPrimaryAction(c) === "continue",
          );
          // Auto-completing always implies the user-permission rule too; the
          // reverse direction is exactly what must NOT hold.
          if (shouldAutoCompleteResolution(c)) {
            expect(canCompleteResolution(c)).toBe(true);
          }
        }
      }
    }
  });
});

describe("guided workflow -- project binding and transient-step recovery", () => {
  function snapshotOn(stepId: string, binding = BINDING): OnboardingWorkflowSnapshot {
    let state = reduceGuidedWorkflow(initialGuidedWorkflowState, {
      type: "start",
      definition: IMPORT_GOAL_DEFINITION,
      runToken: RUN,
    });
    while (state.currentStepId !== stepId && state.status === "active") {
      state = dispatch(state, "advance");
    }
    expect(state.currentStepId).toBe(stepId);
    return toWorkflowSnapshot(state, binding) as OnboardingWorkflowSnapshot;
  }

  function resume(
    snapshot: OnboardingWorkflowSnapshot,
    liveBinding: GuidedProjectBinding,
  ): GuidedWorkflowState {
    return reduceGuidedWorkflow(initialGuidedWorkflowState, {
      type: "resume",
      definition: IMPORT_GOAL_DEFINITION,
      snapshot,
      runToken: RUN,
      liveBinding,
    });
  }

  it("resumes exactly when the same unchanged document is open and the step is stable", () => {
    const snapshot = snapshotOn("assign-physical");
    expect(canResumeSnapshot(IMPORT_GOAL_DEFINITION, snapshot, BINDING)).toBe(true);
    const restored = resume(snapshot, BINDING);
    expect(restored.status).toBe("active");
    expect(restored.currentStepId).toBe("assign-physical");
    expect(restored.completedStepIds).toEqual(["choose-file", "prepare-source"]);
  });

  it("refuses a snapshot from a different project", () => {
    const snapshot = snapshotOn("assign-physical");
    const otherProject = { documentId: "doc-2", fingerprint: "fp-1" };
    expect(canResumeSnapshot(IMPORT_GOAL_DEFINITION, snapshot, otherProject)).toBe(false);
    expect(resume(snapshot, otherProject)).toEqual(initialGuidedWorkflowState);
  });

  it("refuses a snapshot whose document changed since it was taken", () => {
    // Same identity, different content: "analysis passed" or "material
    // assigned" may no longer describe the document, so progress is stale.
    const snapshot = snapshotOn("assign-physical");
    const edited = { documentId: "doc-1", fingerprint: "fp-2" };
    expect(canResumeSnapshot(IMPORT_GOAL_DEFINITION, snapshot, edited)).toBe(false);
    expect(resume(snapshot, edited)).toEqual(initialGuidedWorkflowState);
  });

  it("a binding that cannot distinguish documents is rejected at both capture and resume", () => {
    for (const blank of [
      { documentId: "", fingerprint: "fp-1" },
      { documentId: "doc-1", fingerprint: "  " },
    ]) {
      expect(isUsableProjectBinding(blank)).toBe(false);
      // No snapshot is even produced against a vacuous binding.
      let state = reduceGuidedWorkflow(initialGuidedWorkflowState, {
        type: "start",
        definition: IMPORT_GOAL_DEFINITION,
        runToken: RUN,
      });
      state = dispatch(state, "advance");
      expect(toWorkflowSnapshot(state, blank)).toBeNull();

      // And a persisted one (however it was written) never matches.
      const snapshot = snapshotOn("assign-physical");
      expect(canResumeSnapshot(IMPORT_GOAL_DEFINITION, snapshot, blank)).toBe(false);
      expect(resume(snapshot, blank)).toEqual(initialGuidedWorkflowState);
    }
  });

  it("restart during the transient source-preparation step recovers to choosing the file", () => {
    // The import/trace preview slot does not survive a restart, so reopening
    // prepare-source would present a review surface with nothing behind it.
    const snapshot = snapshotOn("prepare-source");
    expect(isStepTransient(IMPORT_GOAL_DEFINITION, "prepare-source")).toBe(true);
    expect(resolveResumeStepId(IMPORT_GOAL_DEFINITION, snapshot)).toBe("choose-file");

    const restored = resume(snapshot, BINDING);
    expect(restored.status).toBe("active");
    expect(restored.currentStepId).toBe("choose-file");
    // The recovery step is reopened, so nothing at or after it stays recorded.
    expect(restored.completedStepIds).toEqual([]);
    expect(restored.skippedStepIds).toEqual([]);
  });

  it("restart during the transient resolution checkpoint recovers to the analysis step that rebuilds its findings", () => {
    const snapshot = snapshotOn("resolve-findings");
    expect(resolveResumeStepId(IMPORT_GOAL_DEFINITION, snapshot)).toBe("analyze-cutability");

    const restored = resume(snapshot, BINDING);
    expect(restored.currentStepId).toBe("analyze-cutability");
    expect(restored.completedStepIds).toEqual([
      "choose-file",
      "prepare-source",
      "assign-physical",
    ]);
  });

  it("a snapshot open on a transient step with no stable predecessor cannot resume at all", () => {
    const transientFirst: GuidedWorkflowDefinition = {
      goal: "describe-with-ai",
      definitionVersion: 1,
      stepIds: ["pick-concept", "make-manufacturable"],
      skippableStepIds: [],
      transientStepIds: ["pick-concept"],
    };
    const snapshot: OnboardingWorkflowSnapshot = {
      goal: "describe-with-ai",
      definitionVersion: 1,
      currentStepId: "pick-concept",
      completedStepIds: [],
      skippedStepIds: [],
      projectBinding: BINDING,
    };
    expect(resolveResumeStepId(transientFirst, snapshot)).toBeNull();
    expect(canResumeSnapshot(transientFirst, snapshot, BINDING)).toBe(false);
    expect(
      reduceGuidedWorkflow(initialGuidedWorkflowState, {
        type: "resume",
        definition: transientFirst,
        snapshot,
        runToken: RUN,
        liveBinding: BINDING,
      }),
    ).toEqual(initialGuidedWorkflowState);
  });

  it("the binding survives the JSON round trip the persistence store performs", () => {
    const snapshot = snapshotOn("assign-physical");
    const reloaded = JSON.parse(JSON.stringify(snapshot)) as OnboardingWorkflowSnapshot;
    expect(reloaded.projectBinding).toEqual(BINDING);
    expect(canResumeSnapshot(IMPORT_GOAL_DEFINITION, reloaded, BINDING)).toBe(true);
    expect(resume(reloaded, BINDING).currentStepId).toBe("assign-physical");
  });

  it("every reachable active state of a transient-bearing definition snapshots to something resumable", () => {
    // Same validator-reducer tie as the plain walk, for a definition with
    // transient steps: an active state either resumes exactly or recovers to
    // its documented stable predecessor -- never rejected outright, because
    // choose-file (stable) precedes every transient step in this shape.
    const seen = new Set<string>();
    const queue: GuidedWorkflowState[] = [
      reduceGuidedWorkflow(initialGuidedWorkflowState, {
        type: "start",
        definition: IMPORT_GOAL_DEFINITION,
        runToken: RUN,
      }),
    ];
    const stepTypes = ["advance", "skip-step", "back"] as const;
    while (queue.length > 0) {
      const state = queue.shift() as GuidedWorkflowState;
      const key = JSON.stringify(state);
      if (seen.has(key)) continue;
      seen.add(key);
      if (state.status === "active") {
        const snapshot = toWorkflowSnapshot(state, BINDING) as OnboardingWorkflowSnapshot;
        expect(snapshot).not.toBeNull();
        expect(canResumeSnapshot(IMPORT_GOAL_DEFINITION, snapshot, BINDING)).toBe(true);
        const target = resolveResumeStepId(IMPORT_GOAL_DEFINITION, snapshot);
        expect(target).not.toBeNull();
        expect(isStepTransient(IMPORT_GOAL_DEFINITION, target)).toBe(false);
      }
      for (const type of stepTypes) {
        queue.push(dispatch(state, type));
      }
    }
    expect(seen.size).toBeGreaterThan(IMPORT_GOAL_DEFINITION.stepIds.length);
  });
});

describe("guided workflow -- exported initial values are frozen", () => {
  it("initialGuidedWorkflowState is frozen at the top level and in both owned lists", () => {
    expect(Object.isFrozen(initialGuidedWorkflowState)).toBe(true);
    expect(Object.isFrozen(initialGuidedWorkflowState.completedStepIds)).toBe(true);
    expect(Object.isFrozen(initialGuidedWorkflowState.skippedStepIds)).toBe(true);

    expect(() => {
      (initialGuidedWorkflowState as { status: string }).status = "active";
    }).toThrow();
    expect(() =>
      (initialGuidedWorkflowState.completedStepIds as string[]).push("intruder"),
    ).toThrow();
    expect(() =>
      (initialGuidedWorkflowState.skippedStepIds as string[]).push("intruder"),
    ).toThrow();

    // The mutation attempts above must not have landed, and every later
    // cancel must still hand back the same untouched object.
    expect(initialGuidedWorkflowState.status).toBe("idle");
    expect(initialGuidedWorkflowState.completedStepIds).toEqual([]);
    const canceled = reduceGuidedWorkflow(advanceTo("add-text"), { type: "cancel" });
    expect(canceled).toBe(initialGuidedWorkflowState);
  });

  it("initialOnboardingPreferences is frozen at the top level and in its owned list", () => {
    expect(Object.isFrozen(initialOnboardingPreferences)).toBe(true);
    expect(Object.isFrozen(initialOnboardingPreferences.completedGoals)).toBe(true);

    expect(() => {
      (initialOnboardingPreferences as { dismissed: boolean }).dismissed = true;
    }).toThrow();
    expect(() =>
      (initialOnboardingPreferences.completedGoals as GuidedGoal[]).push("create-first-sign"),
    ).toThrow();

    expect(initialOnboardingPreferences.dismissed).toBe(false);
    expect(initialOnboardingPreferences.completedGoals).toEqual([]);
  });
});
