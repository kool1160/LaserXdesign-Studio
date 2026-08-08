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

Every other chat is read-only for those mutations.

There is no automatic routine merge.

## Current hold — G3 post-merge repair PR #74

PR #73 was accepted and merged, then a late P1 review finding proved that imported **Set physical details** could auto-advance when choosing a physical role populated default material and thickness.

PR #74 fixes that defect and is now READY at reviewed head `66dab265b3073145e48667639b0a303691733f7b` with Repository Guard and Canonical Verification, including packaged Windows verification, green.

Codex must **not begin G4 while PR #74 remains unmerged**. If `Continue LaserX` is received during this hold, re-read current truth and stop `BLOCKED` with the repair acceptance hold as the blocker. Do not modify G4 code, do not create a G4 branch, and do not merge PR #74.

The next valid owner action is `Advance LaserX` in the primary operations chat. That command accepts/merges PR #74 and restores G4 as active; it does not advance to G5.

## Held next task — M15 G4

After PR #74 is explicitly accepted and merged, implement **G4 — grouped repair decisions and Fix safe problems workflow** from then-current `main`.

Required scope:

- group current findings into **Safe to fix**, **Suggested fix**, and **Needs your decision** without creating parallel finding truth;
- limit deterministic safe eligibility to exact duplicate geometry, zero-length entities, redundant collinear points, and eligible near-closures within an explicit approved tolerance;
- make **Fix safe problems** preview-first and non-mutating until acceptance;
- refuse stale repair proposals when their document/finding basis changes;
- apply accepted safe repairs as one coherent undoable transaction whenever technically practical, with truthful fixed/skipped/remaining counts;
- re-run current analysis after acceptance and keep unresolved suggested/decision findings visible;
- never claim automated repair proves cut readiness or physical safety;
- never silently apply suggested fixes, bridge/island decisions, ambiguous near-closures, or unproven classes;
- reuse existing geometry/history/cutability and G2/G3 guided-resolution systems;
- preserve exact-project resume, run-token protection, project replacement, contextual controls, security, Save/Export, and non-trapping Exit guidance;
- add focused unit/integration and packaged Windows E2E for preview non-mutation, safe/ambiguous separation, acceptance/reject/undo, grouped large-finding presentation, reanalysis, stale-proposal refusal, and a negative/non-trapping route;
- open one focused draft PR and stop at `AWAITING_REVIEW`.

Do not begin G5 or G6, broad geometry-engine work, speculative safe classifications, new AI capability, material expansion, process/export profiles, licensing, public beta, CAD/CAM, machine control, or native DWG support.

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
