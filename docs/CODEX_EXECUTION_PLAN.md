# Codex Execution Plan

## Purpose

Keep LaserX moving through one bounded, reviewable active-gate task at a time while preserving owner control, primary-chat write authority, exact-head evidence, and clear stop boundaries.

`AGENTS.md`, `docs/OPERATOR_PROTOCOL.md`, `docs/CHAT_AUTHORITY.md`, `docs/WORKSTREAM_OWNERSHIP.md`, `docs/status/CURRENT.md`, the active milestone, issue, and PR are authoritative.

## Active implementation contract

Codex is the only active implementation surface. The owner selects the model inside Codex for each session. The repository must not name a fixed implementation model, auto-route between models, or define an external paid fallback.

Only `Continue LaserX` goes to Codex. Codex must:

- inspect current `main`, live GitHub state, neighboring code, tests, accepted ADRs, and CI before editing;
- implement only the bounded active task in `CURRENT.md`;
- repair review blockers first and required CI second;
- use one focused branch and one draft PR;
- preserve product, geometry, units, security, persistence, packaging, and accessibility regression coverage;
- push exact-head evidence and stop at `AWAITING_REVIEW` or `BLOCKED`;
- never merge, close the active issue, change the gate, approve its own work, or rewrite authority.

Claude, Anthropic, Fable, and other external paid implementation, review, continuation, and fallback routes are removed from active operation.

## Primary operations authority

The LaserX Design Studio primary operations chat alone may plan, lock, review, report status, change holds, merge, close, or advance. Every other chat is read-only for those mutations. If identity is uncertain, fail closed and use the exact return-to-primary response in `docs/CHAT_AUTHORITY.md`.

Codex's bounded implementation authority permits branch pushes and draft-PR evidence only for the active `Continue LaserX` task. It does not confer planning/review authority.

## Active M15 G1 task

Implement **G1 — first-launch goal chooser and resumable guidance shell** from current `main`.

Required scope:

- wire `guidedWorkflowState.ts` into the desktop application without moving authoritative project/geometry behavior into React;
- implement the versioned, validated, atomic `OnboardingPreferences` store through the existing Electron desktop-state boundary;
- present the three locked first-run goals on clean first launch / appropriate empty-workspace entry;
- make the AI goal clearly optional and reuse existing provider-connected state;
- implement the focused guidance shell with progress/orientation, Back, permitted Skip, and globally reachable Exit guidance;
- enforce the contextual shell rules already locked by ADR 0027, including hidden project-replacement controls and Save availability when a document exists;
- satisfy the app-layer run-token, project-replaced, project/document/fingerprint binding, transient-resume, and resolution-checkpoint obligations locked in ADR 0027;
- add app-layer regression tests and packaged Windows E2E for first launch, exit, persistence/resume, project replacement, and non-trapping recovery;
- open one focused draft PR and stop at `AWAITING_REVIEW`.

Do not begin G2's complete Create My First Sign journey, G3 vector/raster guided integration, G4 grouped repair/Fix safe problems, G5 full Learn Mode content, or G6 owner usability validation. Do not add new AI capability, material expansion, process profiles, export profiles, licensing, public beta, CAD/CAM, or machine control.

Historical completion note: during the now-merged governance-normalization prerequisite, the explicit boundary was: **Visible onboarding UI, stores, IPC, grouped repair, and later G1 product work are excluded.** That sentence is retained only as evidence of the completed PR #70 boundary; it is not the active G1 scope.

## `Continue LaserX` algorithm

1. Read the live sources of truth and exact GitHub state.
2. If held, stop.
3. Repair a posted blocker or required CI failure before new work.
4. If a complete active PR exists, refresh exact-head evidence and stop.
5. Otherwise implement the smallest complete active task, test it, open one focused draft PR, and stop.
6. If authority or scope conflicts, report `BLOCKED` rather than guessing.

There is no automatic routine merge.

## Completion boundary

```text
LaserX M## — AWAITING_REVIEW | BLOCKED
PR: #__
Head: <full SHA>
CI: green | failing | running
Work: <one-sentence result>
Blocker: none | <one-sentence blocker>
Next command: Check LaserX | Continue LaserX | Plan LaserX: <decision>
```
