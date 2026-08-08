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

## Active M15 task

Implement **G4 — grouped repair decisions and Fix safe problems workflow** from current `main`.

Required scope:

- transform current repair/manufacturing findings into a small decision-oriented surface grouped as **Safe to fix**, **Suggested fix**, and **Needs your decision**, with truthful affected scope/counts;
- define deterministic, regression-tested safe eligibility limited initially to exact duplicate geometry, zero-length entities, redundant collinear points, and eligible near-closures within an explicit approved tolerance;
- make **Fix safe problems** preview-first: proposed deterministic repairs are visible while authoritative geometry remains unchanged until user acceptance;
- apply an accepted safe batch as one coherent undoable repair transaction whenever technically practical, preserving reject and undo and reporting fixed/skipped/remaining counts;
- re-run current analysis after accepted repair and keep all remaining suggested/decision findings visible;
- never claim automated safe repair proves cut readiness or physical safety;
- never silently apply suggested fixes, bridge/island decisions, ambiguous near-closures, or any class not mechanically proven safe;
- reuse existing geometry/history/cutability systems and the accepted G2/G3 guided resolution checkpoint rather than creating parallel geometry or finding truth;
- preserve G1–G3 run-token protection, exact-project resume, project replacement, contextual controls, security, Save/Export semantics, and non-trapping Exit guidance;
- add focused unit/integration regressions and packaged Windows E2E proving preview non-mutation, safe-versus-ambiguous separation, accepted batch behavior, undo/reject, grouped large-finding presentation, reanalysis, and a negative/non-trapping recovery path;
- open one focused draft PR and stop at `AWAITING_REVIEW`.

Do not begin G5 full Learn Mode/replay content or G6 owner usability validation. Do not broaden this into a general geometry-engine rewrite, invent speculative safe classifications, add new AI capability, expand materials/process/export profiles, implement licensing/public beta, CAD/CAM, machine control, or native DWG support.

Do not begin a later M15 gate without explicit owner advancement.

## G3 completion record

PR #73 completed **Import My Own Design** source-aware guidance at reviewed head `4df406869bf23c175069b9b93dda9d97b5cb8cab` and squash merge `f2a54d732ec9ee661c921d421da08e2b83c01b14`. Repository Guard and Canonical Verification, including packaged Windows verification, passed on the reviewed head. The owner explicitly accepted and advanced G3 in the designated LaserX Design Studio primary operations chat on 2026-08-07.

## Active M15 G1 task — historical completion marker

This heading is retained only as a durable historical marker for repository-guard compatibility. G1 is complete and accepted; it is not active.

Visible onboarding UI, stores, IPC, grouped repair, and later G1 product work are excluded.

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
