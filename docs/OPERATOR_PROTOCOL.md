# LaserX Design Studio Operator Protocol

## Purpose

This protocol keeps the owner out of the copy-and-paste loop while preserving bounded implementation, exact evidence, review discipline, and explicit advancement.

The durable workflow is:

1. discuss product intent with the owner;
2. record accepted decisions in GitHub;
3. let ChatGPT inspect and implement one bounded active-gate slice;
4. run a fresh exact-head review before merge;
5. keep detailed evidence and findings on GitHub;
6. return only a compact status and next valid command to the owner.

Issue #44, Issue #37, ADR 0025, and `docs/status/CURRENT.md` are mandatory context for post-M13 work.

## Roles

| Role | Responsibility |
| --- | --- |
| Owner | Defines product direction, pricing philosophy, milestone order, and advancement. |
| ChatGPT | Senior software engineer, active implementation lead, orchestrator, exact-head reviewer, and merger after owner command. |
| Claude | Held by default; available for an explicitly assigned independent review, repair, comparison, or specialist task. |
| Codex | Held by default under the same explicit-assignment boundary. |
| GitHub | Stores the durable plan, code, evidence, findings, CI, and milestone state. |

ChatGPT must distinguish implementation evidence from acceptance review and must not treat its own earlier summary, or another agent's report, as proof without re-reading the exact GitHub head.

## Authoritative reading order

1. explicit owner instruction;
2. `AGENTS.md`;
3. ADR 0025 and `docs/status/CURRENT.md` for the active implementation assignment;
4. Issues #44 and #37;
5. `docs/OPERATOR_PROTOCOL.md`;
6. `docs/WORKSTREAM_OWNERSHIP.md`;
7. active milestone document;
8. active issue;
9. active PR, review findings, and exact-head CI.

Old chats, stale PR bodies, old branches, experiment branches, local handoffs, and temporary worktrees are not current truth.

# Command reference

## `Plan LaserX: <idea>`

Discuss product behavior, workflow, scope, priority, business model, manufacturing rules, or sequencing without writing code.

## `Lock that into LaserX`

Write an accepted decision to the smallest authoritative GitHub location: issue, milestone, requirements, ADR, ownership document, current status, or PR finding.

## `Continue LaserX`

**Use with ChatGPT while `CURRENT.md` assigns ChatGPT as implementation lead.**

ChatGPT must:

1. read all authoritative sources and live GitHub state;
2. identify the one active milestone, issue, bounded slice, and any open PR;
3. resolve blocking review findings first;
4. otherwise repair required CI failures;
5. otherwise implement only the next approved bounded slice;
6. add tests and documentation tied to behavior;
7. push exact-head evidence to a draft PR;
8. stop at `AWAITING_REVIEW`, `REPAIRING`, or `BLOCKED` unless the owner has also issued a valid advancement command.

`Continue LaserX` never authorizes:

- later-milestone scope;
- speculative future infrastructure;
- wholesale experiment merge;
- silent issue closure;
- milestone advancement without owner authorization;
- accepting a stale handoff as proof.

### Implementation handoff

```text
LaserX M## — AWAITING_REVIEW | REPAIRING | BLOCKED
PR: #__
Head: <full SHA>
CI: green | failing | running
Work: <one-sentence result>
Blocker: none | <one-sentence blocker>
Next command: Check LaserX | Continue LaserX | Plan LaserX: <decision>
```

Detailed evidence belongs in GitHub.

## `Repair LaserX`

Inspect the active PR, findings, CI, and source, then repair only the unresolved bounded defects. Do not use repair as permission to broaden the slice.

## `Check LaserX`

Perform a fresh review against the exact current head, even when ChatGPT performed the implementation.

The review must inspect:

- active milestone and issue acceptance criteria;
- exact PR head and complete diff;
- relevant source, tests, fixtures, migrations, ADRs, and documentation;
- review findings and whether repairs truly close them;
- required workflow results on the final pushed head or reviewed merge ref;
- scope control and later-gate restraint;
- whether claims and PR evidence match the live code.

The chat verdict is normally:

```text
LaserX M## PR #__ — READY | REPAIR | BLOCKED
Head: <full SHA>
CI: green | failing | running
Finding: none | <brief blocking reason>
Next command: Advance LaserX | Continue LaserX | Plan LaserX: <decision>
```

A second-model review may be assigned to Claude or Codex when risk, uncertainty, or owner direction warrants it.

## `Advance LaserX`

Valid only after `READY` and explicit owner authorization.

Before advancing, ChatGPT verifies:

1. reviewed head is unchanged;
2. required checks are green on that head or the reviewed merge ref;
3. no blocking finding remains;
4. active slice or milestone acceptance criteria are satisfied;
5. the owner authorized the advancement.

Then ChatGPT may:

1. mark the PR ready if needed;
2. merge using the established method with an expected-head guard;
3. close the active slice or issue when appropriate;
4. update `CURRENT.md` with exact merge and verification evidence;
5. activate only the next owner-approved slice or milestone;
6. continue implementation only when the owner's command explicitly includes it.

## `Status LaserX`

Read-only live status: active milestone, issue, sub-slice, open PR/head, CI, blockers, implementation owner, and next valid command.

## `Hold LaserX`

Pause new implementation. Do not merge, advance, create new production branches, or start parallel scope until explicit resume.

# Normal operating loop

```text
Owner: Plan LaserX: <idea>
ChatGPT: discuss and settle decision
Owner: Lock that into LaserX
ChatGPT: update GitHub

Owner: Continue LaserX
ChatGPT: implement or repair one bounded slice, update draft PR, stop

Owner: Check LaserX
ChatGPT: re-read and review exact head

If REPAIR:
Owner: Continue LaserX or Repair LaserX

If READY:
Owner: Advance LaserX
```

## Slice policy

A milestone may contain multiple capabilities, but each implementation PR must be a reviewable vertical result. Split work when one PR would combine unrelated architectures, risky migrations, or independently testable workflows.

Do not split into empty infrastructure with no testable value. M14's G4 sub-slices are recorded in `docs/CLAUDE_EXECUTION_PLAN.md` and ADR 0025.

## State names

| State | Meaning | Next normal command |
| --- | --- | --- |
| `PLANNING` | Product behavior or gate is still being decided. | `Lock that into LaserX` |
| `IMPLEMENTING` | ChatGPT is building the approved slice. | `Check LaserX` after the PR handoff |
| `REPAIRING` | ChatGPT is resolving review or CI findings. | `Check LaserX` |
| `AWAITING_REVIEW` | Draft PR is ready for a fresh exact-head review. | `Check LaserX` |
| `READY` | Exact head accepted and required CI green. | `Advance LaserX` |
| `BLOCKED` | Human decision, external dependency, or failure prevents progress. | `Plan LaserX` or repair after correction |
| `HELD` | Owner intentionally paused work or an agent is not assigned. | Explicit assignment or resume |

## Final rules

- GitHub is the project record; chat is not.
- ChatGPT implements and orchestrates while `CURRENT.md` says so.
- Claude and Codex enter only through explicit recorded assignment.
- The owner never needs to courier completion reports between agents.
- No agent invents the roadmap.
- No milestone advances merely because code exists.
- No experiment branch is merged wholesale.
