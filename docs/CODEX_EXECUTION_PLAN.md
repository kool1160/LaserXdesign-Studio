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

Implement **G3 — vector import and raster trace contextual guidance** from current `main`.

Required scope:

- turn **Import My Own Design** into one truthful source-aware guided workflow using the existing SVG/DXF and PNG/JPEG systems;
- keep the first source-selection step generic until the selected file type is known;
- for SVG/DXF, use the existing vector preview/commit flow with real units, fit/scale, layers, findings/warnings, accept, and cancel while keeping raster trace controls hidden;
- for PNG/JPEG, expose preprocessing/trace only after a raster source is selected and require a real accepted editable-geometry commit before advancing;
- treat vector/raster preview state as transient so resume returns to the stable source-selection checkpoint instead of pretending a vanished preview still exists;
- make commit/accept the completion signal; cancel/reject returns to source selection without falsely marking the step complete;
- after editable geometry is committed, reuse the accepted physical-layer, whole-design cutability, ADR 0027 resolution, required physical 3D, Save/Save As, and SVG/DXF export checkpoints rather than bypassing them;
- preserve G1/G2 run-token protection, exact-project resume, project replacement, contextual controls, security, undo/history, and non-mutation guarantees;
- do not implement G4 grouped repair, safe-fix classification, batch repair, or **Fix safe problems**;
- add focused unit/integration tests plus packaged Windows E2E for at least one SVG/DXF branch, one PNG/JPEG branch, branch isolation, and a negative/non-trapping cancel or stale-preview case;
- open one focused draft PR and stop at `AWAITING_REVIEW`.

Do not begin G4 grouped repair/Fix safe problems, G5 full Learn Mode content, or G6 owner usability validation. Do not add new AI capability, material-catalog expansion, process profiles, export profiles, licensing, public beta, CAD/CAM, machine control, or native DWG support.

Do not begin a later M15 gate without explicit owner advancement.

## G2 completion record

PR #72 completed the deterministic **Create My First Sign** vertical slice at reviewed head `9da334207d29da27948863bb95f21155737f65b8` and squash merge `c9a834a811db831207da6ca695ee8c46d6a88ca4`. Repository Guard and Canonical Verification, including packaged Windows verification, passed on the reviewed head. The owner explicitly accepted and advanced G2 in the designated LaserX Design Studio primary operations chat on 2026-08-07.

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
