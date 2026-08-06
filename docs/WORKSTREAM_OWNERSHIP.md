# LaserX Design Studio Workstream Ownership

## Status and authority

This document records the owner's restored operating model, effective **2026-08-06**:

> Chat decides. GitHub remembers. SOL High executes. Pull requests hold the evidence.

This assignment supersedes ADR 0026's Claude implementation assignment. ADR 0026 remains historical evidence explaining the earlier role split, but it no longer controls current implementation routing.

`AGENTS.md`, `docs/OPERATOR_PROTOCOL.md`, and `docs/status/CURRENT.md` are the current operating truth.

## Current delivery gate

- Milestone: **M15 — Guided Onboarding, Workflow-First UI, and Learn Mode**
- Active issue: **#45**
- Active slice: **G0 — guided-workflow architecture and first-run contract**
- Active PR: **#67**
- Current implementation state: **AWAITING_REVIEW**
- G1 and later M15 slices remain held.

## Owner authority

The owner controls:

- product direction;
- milestone and gate order;
- pricing and trial philosophy;
- implementation-model choice;
- hands-on acceptance;
- explicit advancement through `Advance LaserX`.

A `READY` verdict is required before advancement, but it does not replace the owner command.

## Planning/review chat ownership

The planning/review chat owns:

- `Plan LaserX: <idea>`;
- `Lock that into LaserX`;
- exact-head review through `Check LaserX`;
- durable findings and decisions on GitHub;
- `Status LaserX` and `Hold LaserX`;
- merge, issue closure, status recording, and next-gate activation only after the owner issues `Advance LaserX`.

The planning/review chat must independently inspect the exact head, full relevant diff, tests, review state, and required CI. It does not accept an implementation report as proof.

There is no automatic routine merge under this restored workflow.

## SOL High implementation ownership

**SOL High** is the owner-selected OpenAI coding model running at High reasoning in the Codex coding workspace.

Only `Continue LaserX` goes to the SOL High implementation thread.

SOL High owns:

- reading live repository truth before editing;
- fixing active review blockers first;
- fixing required CI failures second;
- implementing only the smallest complete active-gate slice when no active PR exists;
- using focused branches and draft PRs;
- adding regression tests and behavior-linked documentation;
- running required verification;
- pushing exact-head evidence;
- stopping at `AWAITING_REVIEW` or `BLOCKED`.

SOL High must never:

- merge its own PR;
- close the active issue;
- activate the next gate;
- redesign unrelated architecture;
- create speculative future infrastructure;
- run parallel later-milestone work;
- create scheduled heartbeats, background polling, or self-waking sessions;
- continue after `AWAITING_REVIEW` without another owner command.

## Claude / Anthropic hold

Claude and paid Anthropic models are held from implementation, repair, review, and background work.

Do not spend Anthropic usage credits or invoke an Anthropic model unless the owner explicitly authorizes one named, bounded task in GitHub. Earlier Claude-authored code remains normal repository history and is judged by exact-head review, not by author.

## Independent verification

Critical geometry, manufacturing truth, schema/migration, filesystem, IPC, credential, signing, licensing, release, or machine-safety work may require an independent verifier who did not author the load-bearing change. The planning/review chat records the verifier and exact target head in GitHub.

## GitHub ownership

GitHub stores:

- product decisions;
- active milestone and gate;
- implementation assignment;
- code and exact heads;
- pull-request evidence;
- review findings;
- CI state;
- merges and milestone history.

The owner does not courier implementation reports between chats.

## Durable operating loop

1. Owner discusses direction with `Plan LaserX: <idea>`.
2. Planning/review chat records it with `Lock that into LaserX`.
3. Owner sends `Continue LaserX` to the SOL High implementation thread.
4. SOL High implements or repairs the bounded active gate and stops.
5. Owner sends `Check LaserX` to the planning/review chat.
6. If `REPAIR`, owner sends `Continue LaserX` to SOL High.
7. If `READY`, owner sends `Advance LaserX` to the planning/review chat.
8. Planning/review chat merges, records, activates the next gate, and stops.
9. Owner starts the new gate with a later `Continue LaserX`.

## Explicit exclusions

No later milestone, wholesale experiment merge, general CAD rewrite, CAM expansion, machine control, material expansion, licensing implementation, or public beta work becomes active merely because an agent has capacity or a draft branch exists.
