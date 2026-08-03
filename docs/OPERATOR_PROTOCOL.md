# LaserX Design Studio Operator Protocol

## Purpose

This protocol keeps the owner out of the copy-and-paste loop while preserving clear separation between product decisions, implementation, independent audit, merge, and milestone advancement.

The durable workflow is:

1. discuss product intent with the owner;
2. record accepted decisions in GitHub;
3. let Claude execute one bounded active-gate slice;
4. let ChatGPT independently audit the exact PR head;
5. keep detailed evidence and findings on GitHub;
6. return only a compact verdict and next command to the owner.

Issue #44 and Issue #37 are mandatory planning context for post-M13 work.

## Roles

| Role | Responsibility |
| --- | --- |
| Owner | Defines product direction, pricing philosophy, milestone order, and advancement. |
| Claude | Implements or repairs the one active milestone slice, tests it, updates a draft PR, and stops. |
| ChatGPT | Converts owner decisions into GitHub planning, performs independent exact-head audits, merges, and records advancement after owner command. |
| Codex | Held unless the owner explicitly assigns a task. |
| GitHub | Stores the durable plan, code, evidence, review findings, CI, and milestone state. |

Claude may not approve or merge its own work. ChatGPT may not treat Claude's completion report as proof without inspecting GitHub.

## Authoritative reading order

1. `AGENTS.md`;
2. Issues #44 and #37;
3. `docs/OPERATOR_PROTOCOL.md`;
4. `docs/WORKSTREAM_OWNERSHIP.md`;
5. `docs/status/CURRENT.md`;
6. active milestone document;
7. active issue;
8. active PR, review threads, and exact-head CI.

Old chats, old branches, experiment branches, and local completion reports are not current truth.

# Command reference

## `Plan LaserX: <idea>`

Discuss product behavior, workflow, scope, priority, business model, manufacturing rules, or sequencing without writing code.

## `Lock that into LaserX`

Write an accepted decision to the smallest authoritative GitHub location: issue, milestone, requirements, ADR, ownership document, current status, or PR finding.

## `Continue LaserX`

**Use in Claude Code while `CURRENT.md` assigns Claude as implementation lead.**

Claude must:

1. read all authoritative sources;
2. identify the one active milestone, issue, current approved slice, and open PR;
3. resolve blocking review findings first;
4. otherwise repair required CI failures;
5. otherwise implement only the next approved bounded slice;
6. add tests and update documentation tied to behavior;
7. push exact-head evidence to the draft PR;
8. stop in `AWAITING_REVIEW`, `REPAIRING`, or `BLOCKED`.

`Continue LaserX` never authorizes:

- merge;
- issue closure;
- milestone advancement;
- unapproved scope;
- speculative future infrastructure;
- wholesale experiment merge;
- self-approval.

### Claude handoff

```text
LaserX M## — AWAITING_REVIEW | REPAIRING | BLOCKED
PR: #__
Head: <short SHA>
CI: green | failing | running
Work: <one-sentence result>
Blocker: none | <one-sentence blocker>
Next command: Check LaserX | Continue LaserX | Plan LaserX: <decision>
```

Detailed evidence belongs in the PR.

## `Check LaserX`

**Use in ChatGPT.**

ChatGPT must inspect:

- current milestone and issue acceptance criteria;
- exact PR head and full diff;
- review threads;
- relevant source, tests, fixtures, migrations, ADRs, and documentation;
- required workflow results on the final pushed head;
- scope control and later-gate restraint.

Detailed findings go on GitHub. The chat response is normally:

```text
LaserX M## PR #__ — READY | REPAIR | BLOCKED
CI: green | failing | running
Finding: none | <brief blocking reason>
Next command: Advance LaserX | Continue LaserX | Plan LaserX: <decision>
```

## `Advance LaserX`

**Use in ChatGPT only after `READY`.**

Before advancing, ChatGPT verifies:

1. reviewed head is unchanged;
2. required checks are green on that head or reviewed merge ref;
3. no blocking review thread remains;
4. active slice/milestone acceptance criteria are satisfied;
5. owner has authorized the advancement.

Then ChatGPT may:

1. mark PR ready if needed;
2. merge using the established method;
3. close the active slice or issue when appropriate;
4. update `CURRENT.md` with exact merge and verification evidence;
5. activate only the next owner-approved slice or milestone;
6. stop before implementation.

## `Status LaserX`

Read-only live status: active milestone/issue, active PR/head, draft state, CI, blockers, implementation owner, and next valid command.

## `Hold LaserX`

Pause new implementation. Do not merge, advance, create new branches, or start parallel production scope until explicit resume.

# Normal operating loop

```text
Owner: Plan LaserX: <idea>
ChatGPT: discuss and settle decision
Owner: Lock that into LaserX
ChatGPT: update GitHub

Owner to Claude: Continue LaserX
Claude: implement/repair one bounded slice, update draft PR, stop

Owner to ChatGPT: Check LaserX
ChatGPT: independently audit exact head and post findings

If REPAIR:
Owner to Claude: Continue LaserX

If READY:
Owner to ChatGPT: Advance LaserX
```

## Slice policy

A milestone may contain multiple capabilities, but each Claude PR should be a reviewable vertical result. Split work when one PR would combine unrelated architectures, risky migrations, or independently testable workflows.

Do not split into empty infrastructure that provides no testable value. M14's approved G0–G6 sequence is recorded in `docs/CLAUDE_EXECUTION_PLAN.md`.

## Promotional-capacity policy

Temporary Claude capacity may accelerate active approved work. It may not:

- alter milestone priority;
- authorize parallel production milestones;
- justify duplicate research;
- replace independent audit;
- expand scope because tokens or credit are available.

Use temporary capacity for active implementation, regression tests, difficult root-cause analysis, and exact evidence.

## State names

| State | Meaning | Next normal command |
| --- | --- | --- |
| `PLANNING` | Product behavior or gate is still being decided. | `Lock that into LaserX` |
| `IMPLEMENTING` | Claude is building the approved slice. | Wait, then `Check LaserX` |
| `REPAIRING` | Claude is resolving audit or CI findings. | Wait, then `Check LaserX` |
| `AWAITING_REVIEW` | Draft PR is ready for independent audit. | `Check LaserX` |
| `READY` | Exact head accepted and CI green. | `Advance LaserX` |
| `BLOCKED` | Human decision, external dependency, or failure prevents progress. | `Plan LaserX` or resume after correction |
| `HELD` | Owner intentionally paused work. | Explicit resume command |

## Final rules

- GitHub is the project record; chat is not.
- Claude implements; ChatGPT audits and advances.
- The owner never needs to courier completion reports between agents.
- No agent invents the roadmap.
- No milestone advances merely because code exists.
- No experiment branch is merged wholesale.
