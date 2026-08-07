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

Codex's bounded implementation authority permits branch pushes and draft-PR evidence only for an explicitly active `Continue LaserX` task. It does not confer planning/review authority.

## Active M15 G1 task

**OWNER-ACCEPTANCE HOLD — no implementation task is currently authorized.**

PR #71's G1 implementation head `ae7c4e79509611a0704649d9c667886a98bcdcbd` was unexpectedly squash-merged as `41e572a017a82f66f9586ab6e34253d914bc31e2` before the designated primary operations chat completed its READY verdict and before the owner issued `Advance LaserX` there.

The post-merge exact-head audit found the bounded G1 candidate technically READY, but owner acceptance is still pending. G2 is not active. The unauthorized G2 execution-plan and status mutations are superseded by `docs/status/CURRENT.md` and this hold.

Codex must therefore:

- make no code, branch, pull-request, issue, milestone, or governance mutation;
- not reopen or duplicate G1;
- not begin G2;
- report `BLOCKED` if given `Continue LaserX` before the owner resolves the hold;
- wait for an explicit owner `Advance LaserX` in the designated primary operations chat.

Historical completion note from the PR #70 prerequisite boundary: **Visible onboarding UI, stores, IPC, grouped repair, and later G1 product work are excluded.** That sentence remains only as required historical evidence; it is not a new implementation instruction.

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
