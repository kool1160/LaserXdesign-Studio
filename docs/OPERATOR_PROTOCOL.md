# LaserX Design Studio Operator Protocol

## Purpose

This protocol removes the owner from the copy-and-paste loop between planning chat, Codex, GitHub, and code review.

The durable workflow is:

1. discuss product intent in the planning chat;
2. record accepted decisions in GitHub;
3. let Codex execute the active gate from repository truth;
4. keep detailed review findings on the pull request;
5. return only a short verdict and next command to the owner.

A PDF or chat handoff is a human-readable snapshot. It is never more authoritative than the repository sources listed below.

## Roles

| Role | Responsibility |
| --- | --- |
| Owner | Decides what LaserX should do and authorizes milestone advancement. |
| Planning/review assistant | Converts accepted product decisions into GitHub requirements, issues, milestone edits, ADRs, and focused PR reviews. |
| Codex | Implements or repairs the active gate, verifies it, updates the draft PR, and stops for review. |
| GitHub | Stores the durable plan, code, evidence, review findings, CI state, and milestone status. |

## Authoritative sources

When product or implementation instructions conflict, use the order in `AGENTS.md`.

For normal operation, read:

1. `AGENTS.md`;
2. `docs/OPERATOR_PROTOCOL.md`;
3. `docs/status/CURRENT.md`;
4. the active milestone document;
5. the active GitHub issue;
6. the active pull request, review threads, and final-head CI evidence.

Do not use an old handoff, old Codex working directory, stale chat recap, or previous milestone branch as current truth.

# Command reference

## `Plan LaserX: <idea>`

**Use in:** the planning chat.

**Purpose:** discuss a feature, workflow, design change, priority, concern, or manufacturing requirement without changing the repository yet.

**Result:** a clear product decision, unresolved question, or rejected idea.

Planning may cover user experience, scope, acceptance behavior, manufacturing rules, sequencing, risks, or non-goals. It should not produce a new implementation handoff merely because a conversation occurred.

## `Lock that into LaserX`

**Use in:** the planning chat after a decision is accepted.

**Purpose:** make the decision durable in GitHub.

The planning/review assistant places the decision in the smallest correct authoritative location:

- product behavior or acceptance criteria -> active/future issue or milestone specification;
- product scope or non-goal -> product requirements or milestone specification;
- architecture or ownership change -> ADR plus affected architecture documentation;
- immediate defect or review requirement -> active PR review/comment;
- future idea not yet approved for implementation -> clearly blocked future issue or roadmap entry.

The assistant reports only what changed and where. The owner should not have to carry markdown into Codex.

## `Continue LaserX`

**Use in:** Codex.

**Purpose:** continue the active gate from the repository's actual state.

Codex must perform this state check in order:

1. Read the authoritative sources listed above.
2. Identify the one active milestone and its active issue.
3. Find any open pull request for that issue.
4. If unresolved blocking review findings exist, address only those findings, add regression coverage, rerun required verification, update the same draft PR, and stop.
5. Otherwise, if required CI is failing, diagnose and repair the failure without expanding scope, rerun verification, update the same draft PR, and stop.
6. Otherwise, if an implementation PR exists and the final pushed head is green with no unresolved blockers, make the PR evidence current and stop in `AWAITING_REVIEW` state.
7. Otherwise, if no implementation PR exists, implement the smallest complete vertical slice allowed by the active gate, add tests, run verification, open a draft PR, and stop in `AWAITING_REVIEW` or `BLOCKED` state.
8. If repository truth is contradictory or no gate is active, do not invent work. Record the conflict and stop in `BLOCKED` state.

`Continue LaserX` never means:

- merge the PR;
- close the active issue;
- activate or begin the next milestone;
- redesign unrelated architecture;
- create speculative future infrastructure;
- paste a giant duplicate project recap into chat.

### Codex completion handoff

Put detailed implementation evidence in the PR. The user-facing completion response should be compact:

```text
LaserX M## - AWAITING_REVIEW | BLOCKED
PR: #__
Head: <short SHA>
CI: green | failing | running
Work: <one-sentence result>
Blocker: none | <one-sentence blocker>
Next command: Check LaserX | Continue LaserX | Plan LaserX: <decision needed>
```

## `Check LaserX`

**Use in:** the planning/review chat.

**Purpose:** review the actual active PR without requiring the owner to paste Codex's report.

The reviewer must inspect:

- current milestone and issue acceptance criteria;
- exact PR head and diff;
- existing review threads;
- relevant source, tests, fixtures, migrations, and documentation;
- required GitHub workflow results on the final pushed head;
- scope control and next-gate restraint.

Detailed findings belong on GitHub. The chat response should normally be:

```text
LaserX M## PR #__ - READY | REPAIR | BLOCKED
CI: green | failing | running
Finding: none | <one or two short blocking reasons>
Next command: Advance LaserX | Continue LaserX | Plan LaserX: <decision needed>
```

Do not fill the planning chat with a complete code-review transcript unless the owner explicitly asks for it.

## `Advance LaserX`

**Use in:** the planning/review chat after a `READY` verdict.

**Purpose:** finish the reviewed gate and activate the next one.

Before advancing, the assistant must verify:

1. the reviewed head has not changed;
2. all required checks are green on that head or the reviewed merge ref;
3. no unresolved blocking review thread remains;
4. the active issue and milestone exit criteria are satisfied.

Then:

1. mark the PR ready when necessary;
2. merge using the repository's established method;
3. confirm the active issue closes;
4. update `docs/status/CURRENT.md` with the exact merge commit and verification record;
5. activate the next existing milestone issue from latest `main`;
6. stop before implementing the next milestone.

If any precondition fails, do not merge. Return `REPAIR` or `BLOCKED` and the next command.

## `Status LaserX`

**Use in:** the planning/review chat.

**Purpose:** obtain a read-only status without beginning implementation or performing a full code review.

Return only:

- active milestone and issue;
- active PR and exact head;
- draft/ready state;
- CI state;
- unresolved blocker count;
- next valid command.

## `Hold LaserX`

**Use in:** either chat when the owner wants work paused.

**Purpose:** stop new implementation while preserving current work.

Do not merge, advance, create a new milestone branch, or begin additional scope. Record the reason in the active issue or PR when it affects future work. Resume only after an explicit `Continue LaserX`, `Check LaserX`, or revised product decision.

# Normal operating loop

```text
Owner: Plan LaserX: <idea>
Planning chat: discuss and settle the product decision
Owner: Lock that into LaserX
Planning chat: update GitHub and report the changed locations

Owner to Codex: Continue LaserX
Codex: implement/repair active gate, update draft PR, stop

Owner to review chat: Check LaserX
Review chat: place detailed findings on GitHub, return READY/REPAIR/BLOCKED

If REPAIR:
Owner to Codex: Continue LaserX

If READY:
Owner to review chat: Advance LaserX

After advancement:
Owner to Codex: Continue LaserX
```

# Review and handoff rules

- GitHub is the project record; chat is not.
- Detailed code-review findings stay on the PR.
- Accepted product decisions must be written to GitHub before Codex relies on them.
- The owner should never need to paste a Codex completion report into the review chat.
- The owner should never need a fresh milestone markdown handoff when the active issue and repository documents are current.
- Do not repeat stale milestone summaries after every action.
- Do not report success from local tests alone when GitHub workflows are required.
- Do not advance from a draft branch or stale reviewed head.
- Do not let Codex invent the product roadmap. Codex executes the approved queue.

# State names

| State | Meaning | Next normal command |
| --- | --- | --- |
| `PLANNING` | Product behavior is still being decided. | `Lock that into LaserX` |
| `IMPLEMENTING` | Codex is building the active gate. | Wait, then `Check LaserX` |
| `REPAIRING` | Codex is resolving PR review or CI findings. | Wait, then `Check LaserX` |
| `AWAITING_REVIEW` | Draft PR is updated and ready for review. | `Check LaserX` |
| `READY` | Reviewed head is accepted and required CI is green. | `Advance LaserX` |
| `BLOCKED` | A human decision, external dependency, or unresolved failure prevents progress. | `Plan LaserX: <decision>` or `Continue LaserX` after correction |
| `HELD` | Owner intentionally paused work. | Explicit resume command |

# Scope-size rule

A milestone may contain multiple capabilities, but each implementation PR should remain a reviewable vertical result whenever practical. Split work when one PR would combine unrelated architectures, multiple risky migrations, or too many independently testable user workflows.

Do not split work into empty infrastructure pieces that provide no usable or testable result.