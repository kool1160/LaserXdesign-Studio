# SOL High Execution Plan

## Purpose

Keep LaserX moving through one bounded, reviewable active-gate slice at a time while preventing handoff drift, speculative scope, repeated full-project rereads, background polling, and unbounded model cost.

`AGENTS.md`, `docs/OPERATOR_PROTOCOL.md`, `docs/status/CURRENT.md`, the active milestone, the active issue, and the active PR are authoritative.

## Role split

### SOL High

SOL High is the owner-selected OpenAI coding model running at High reasoning in the Codex coding workspace.

Only `Continue LaserX` goes to the SOL High implementation thread.

SOL High must:

- inspect current `main`, the active issue, the active PR, exact review findings, neighboring code, tests, accepted ADRs, and CI before editing;
- implement only the bounded active gate recorded in `CURRENT.md`;
- repair review blockers first;
- repair required CI second;
- implement new work only when no active PR is awaiting review or repair;
- use a focused branch and draft PR;
- add regression coverage and behavior-linked documentation;
- distinguish implementation evidence from acceptance judgment;
- stop at `AWAITING_REVIEW` or `BLOCKED`;
- never merge, close the active issue, activate the next gate, or approve its own work.

### Planning/review chat

The planning/review chat:

- decides and locks product direction;
- defines bounded repairs and later slices;
- performs exact-head `Check LaserX` review;
- posts detailed findings to GitHub;
- reports `READY`, `REPAIR`, or `BLOCKED`;
- advances only after the owner explicitly sends `Advance LaserX`.

There is no automatic routine merge.

### Owner

The owner controls product direction, model choice, gate advancement, and hands-on acceptance. Green CI alone never advances a gate.

### Claude / Anthropic

Held. No paid Anthropic task is authorized unless the owner records one named, bounded exception in GitHub.

## Efficiency and stop rules

SOL High must not:

- create recurring heartbeats or scheduled checks;
- poll CI in the background after the implementation result is pushed;
- keep a session alive after `AWAITING_REVIEW`;
- spawn parallel subagents unless the active issue explicitly requires a specialist investigation;
- reread the full milestone history when current GitHub truth already narrows the task;
- rewrite stable PR descriptions with every small repair;
- post duplicate evidence in chat and GitHub;
- broaden a repair into a general architecture pass.

When CI is still running after a push, record that fact, stop, and let a later `Continue LaserX`, `Status LaserX`, or `Check LaserX` read the terminal result.

## Evidence rules

Every implementation or repair PR records:

- exact base and head SHAs;
- changed files;
- focused and root test results;
- required exact-head CI state;
- unresolved findings and limitations;
- later-gate work deliberately excluded.

Stable scope and architecture belong in the PR body. Volatile exact-head results belong in the latest PR comment. A handoff is never proof by itself.

## Current M15 queue

### G0 — guided-workflow architecture and first-run contract

**Current state:** PR #67 at exact head `9cf4458bef5d8cc39814e6b9e94de221fa8228e0`, `AWAITING_REVIEW`.

SOL High must not edit this PR until the planning/review chat returns `REPAIR`. It must not begin G1 until the owner advances after `READY`.

If a `REPAIR` verdict is posted, `Continue LaserX` means:

1. read the exact posted finding;
2. reproduce it before changing code when feasible;
3. fix only the bounded defect;
4. add a load-bearing regression test;
5. run required verification;
6. update the same draft PR;
7. stop at `AWAITING_REVIEW`.

### G1 — first-launch goal chooser and resumable guidance shell

Held until G0 is accepted and explicitly advanced.

### G2 — Create My First Sign guided vertical slice

Held until G1 is accepted and explicitly advanced.

### G3 — vector import and raster trace contextual guidance

Held until G2 is accepted and explicitly advanced.

### G4 — grouped repair decisions and Fix safe problems workflow

Held until G3 is accepted and explicitly advanced.

### G5 — Learn Mode, replay, recovery, and contextual explanations

Held until G4 is accepted and explicitly advanced.

### G6 — packaged accessibility and first-session validation

Held until G5 is accepted and explicitly advanced.

## `Continue LaserX` algorithm

1. Read `AGENTS.md`, `docs/OPERATOR_PROTOCOL.md`, `docs/status/CURRENT.md`, active milestone, active issue, active PR, current findings, and CI.
2. If the project is `HELD`, stop.
3. If a blocking review finding exists, repair only that finding.
4. Else if required CI is failing, diagnose and repair it without scope expansion.
5. Else if an active PR exists and is green, refresh exact-head evidence and stop at `AWAITING_REVIEW`.
6. Else if no active PR exists, implement the smallest complete active-gate vertical slice, test it, open a draft PR, and stop.
7. If sources conflict or required owner direction is missing, record `BLOCKED` instead of guessing.

## Compact completion response

```text
LaserX M## — AWAITING_REVIEW | BLOCKED
PR: #__
Head: <full SHA>
CI: green | failing | running
Work: <one-sentence result>
Blocker: none | <one-sentence blocker>
Next command: Check LaserX | Continue LaserX | Plan LaserX: <decision>
```

## Restraint

One complete, learnable workflow beats a large cosmetic rewrite. Do not spend implementation capacity on speculative visual redesign, duplicate onboarding systems, broad cleanup, materials, process profiles, export profiles, licensing, public beta, CAD/CAM, machine control, or later milestones unless the active gate explicitly requires it.
