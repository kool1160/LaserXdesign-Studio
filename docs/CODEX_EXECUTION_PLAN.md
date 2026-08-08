# Codex Execution Plan

## Purpose

Keep LaserX moving through one bounded, reviewable active-gate task at a time while preserving owner control, primary-chat write authority, exact-head evidence, and clear stop boundaries.

`AGENTS.md`, `docs/OPERATOR_PROTOCOL.md`, `docs/CHAT_AUTHORITY.md`, `docs/WORKSTREAM_OWNERSHIP.md`, `docs/status/CURRENT.md`, the active milestone, issue, and PR are authoritative.

## Active implementation contract

Codex is the only active implementation surface. The owner selects the model inside Codex for each session. The repository must not name a fixed implementation model, auto-route between models, or define an external paid fallback.

Only `Continue LaserX` goes to Codex. Codex must inspect current `main`, live GitHub state, neighboring code, tests, accepted ADRs, and CI before editing; implement only the bounded active task in `CURRENT.md`; repair review blockers first; push exact-head evidence; and stop at `AWAITING_REVIEW` or `BLOCKED`.

Claude, Anthropic, Fable, and other external paid implementation, review, continuation, and fallback routes are removed from active operation.

## Primary operations authority

The LaserX Design Studio primary operations chat alone may plan, lock, review, report status, change holds, merge, close, or advance. Every other chat is read-only for those mutations. If identity is uncertain, fail closed and use the exact return-to-primary response in `docs/CHAT_AUTHORITY.md`.

There is no automatic routine merge.

## Active M15 task

Implement **G5 — Learn Mode, replay, recovery, and contextual explanations** from current `main`.

Required scope:

- add a permanent optional Learn/Help entry point that enables/disables contextual teaching without mutating project geometry or requiring a new project;
- teach through real LaserX controls and current workflow state rather than a disconnected slideshow;
- provide normal-shop-language **what it does / why it matters** explanations for core M15 concepts: physical layers, material/thickness, cutability findings, Safe to fix / Suggested fix / Needs your decision, bridge/island intent, physical 3D, and export;
- allow guided workflows/tutorials to be skipped, replayed, and reopened later from Learn/Help;
- replay with a fresh run token and current project/document identity, without overwriting current project state or reviving stale/transient previews;
- preserve exact-project resume, wrong-project protection, project-replacement invalidation, stable-checkpoint recovery, and non-trapping global Exit from G1–G4;
- keep educational completion state separate from manufacturing/document truth;
- ensure opening/dismissing/replaying explanations cannot mutate geometry, accept repairs, complete required checkpoints, create analysis/3D evidence, or export on the user's behalf;
- reuse the accepted guided-workflow reducer, onboarding preferences, contextual controls, geometry/history/cutability, and G4 repair systems instead of creating a parallel tutorial/workflow engine;
- add focused unit/integration and packaged Windows E2E for Learn Mode toggle, contextual explanation, skip/replay/reopen, fresh-token replay, restart/resume recovery, wrong-project/project replacement, and non-trapping Exit;
- open one focused draft PR and stop at `AWAITING_REVIEW`.

Do not begin G6, owner-observed usability validation, new AI capability, future material/process tutorial expansion, broad material expansion, process/export profiles, licensing, public beta, CAD/CAM, machine control, or native DWG support.

## G4 completion record

PR #75 delivered grouped repair decisions and preview-first **Fix safe problems** at reviewed head `fb6caaeddb4117f308685314082102e65e231989` and squash merge `daf48515fa54e1dfd3276173d84d597b7dd14492`. Repository Guard and Canonical Verification, including packaged Windows verification, were green; all review threads were resolved. The owner explicitly accepted G4 with `Advance LaserX` in the designated primary operations chat on 2026-08-08.

## G3 post-merge repair completion record

PR #74 repaired the late G3 P1 at reviewed head `66dab265b3073145e48667639b0a303691733f7b` and squash merge `df0d3463470afb7f69724ca808c25df0b8317d87`. Repository Guard and Canonical Verification, including packaged Windows verification, passed on the reviewed head. The owner explicitly accepted the repair with `Advance LaserX` in the designated primary operations chat on 2026-08-08.

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
