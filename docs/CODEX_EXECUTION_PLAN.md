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

Implement **G2 — Create My First Sign guided vertical slice** from current `main`.

Required scope:

- turn the existing `create-first-sign` G1 shell into one real end-to-end deterministic workflow using the authoritative feature commands that already exist;
- wire step completion to real product state and successful feature outcomes rather than letting a generic Continue button claim work happened when it did not;
- **Choose size and material:** require a real document/stock size plus real manufacturing material/thickness state before advancing;
- **Add the sign content:** require at least one real object on the design before advancing, using the existing Create/Text/Sign surfaces rather than a parallel editor path;
- **Check the design:** run the existing cutability analysis and accept only current, non-stale analysis for the open document;
- **Resolve findings:** preserve ADR 0027 exactly — auto-complete unseen only when nothing is actionable; allow user Continue only when no blocking findings remain; do not invent G4 safe-fix classification or grouped repair;
- **Review the 3D result:** require the existing physical preview to render successfully or present an explicit truthful unavailable/failure route; the checkpoint is not skippable;
- **Save or export:** use the existing save and SVG/DXF export paths, report real success/failure, and complete the guided goal only after a real successful export;
- preserve Back, Exit guidance, exact-project resume, run-token protection, contextual controls, project-replacement invalidation, and authoritative-state non-mutation guarantees from G1/ADR 0027;
- add focused unit/integration tests and packaged Windows E2E proving a deterministic first sign can move from clean first launch through size/material, content, cutability, resolution, 3D, save/export, and completed guidance without hidden state mutation;
- include at least one negative/non-trapping packaged path showing a required checkpoint cannot be falsely advanced;
- open one focused draft PR and stop at `AWAITING_REVIEW`.

Do not begin G3 vector/raster guided integration, G4 grouped repair/Fix safe problems, G5 full Learn Mode content, or G6 owner usability validation. Do not add new AI capability, material-catalog expansion, process profiles, export profiles, licensing, public beta, CAD/CAM, or machine control.

Do not begin a later M15 gate without explicit owner advancement.

## G1 completion record

PR #71 completed the first-launch goal chooser and resumable guidance shell at reviewed head `ae7c4e79509611a0704649d9c667886a98bcdcbd` and squash merge `41e572a017a82f66f9586ab6e34253d914bc31e2`. Repository Guard and Canonical Verification, including packaged Windows verification, passed on the reviewed head.

## Active M15 G1 task — historical completion marker

This heading exists only while the repository guard is being generalized away from a gate-specific G1 marker during this advancement commit sequence. G1 is complete; it is not active.

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
