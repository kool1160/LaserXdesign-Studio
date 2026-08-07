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

The first G1 task is governance and CI normalization only:

- replace fixed-model and external-provider routing with this Codex contract;
- make cross-chat write prohibition mechanically load-bearing;
- consolidate required PR checks around Repository Guard and Canonical Verification;
- make completed milestone workflows manual historical evidence;
- run packaged Windows verification only when the active gate or changed product paths require it;
- keep release and signing workflows as explicit release gates.

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
