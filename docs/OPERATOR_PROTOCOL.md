# LaserX Design Studio Operator Protocol

## Purpose

This protocol keeps the owner out of the copy-and-paste loop while preserving disciplined engineering, exact evidence, and independent verification where risk warrants it.

The durable model is:

1. the owner sets product intent and major advancement decisions;
2. the senior engineering lead inspects the live project and chooses the correct next work;
3. an approved implementation agent executes a bounded brief;
4. routine work moves through focused review and CI without unnecessary ceremony;
5. senior and independent audits occur at risk-bearing turning points;
6. GitHub stores the plan, code, evidence, findings, and state.

Issues #44 and #37 remain mandatory product context for post-M13 work.

## Roles

| Role | Responsibility |
| --- | --- |
| Owner | Product direction, major scope decisions, milestone order, pricing, and milestone advancement. |
| Senior engineering lead | Architecture, execution planning, agent assignment, integration, risk classification, review cadence, exact-head checkpoint audits, and project advancement orchestration. |
| Implementation agent | Executes the approved brief, adds tests, pushes exact-head evidence, and reports blockers. |
| Independent verifier | Reviews critical work when separation of duties is required. |
| GitHub | Durable project truth: requirements, code, evidence, CI, findings, and status. |

`docs/status/CURRENT.md` maps Claude, Codex, ChatGPT, or another approved agent to the current implementation and verification assignments. Agent names are not permanent architecture.

## Authoritative reading order

1. `AGENTS.md`;
2. `docs/status/CURRENT.md`;
3. active milestone document;
4. active GitHub issue;
5. Issues #44 and #37;
6. relevant ADRs, requirements, architecture, tests, PRs, review threads, and exact-head CI.

Old chats, local completion reports, stale PR bodies, old branches, experiment branches, and temporary worktrees are not current truth.

## Review levels

### Routine

Use focused review plus required tests and CI for narrow, low-risk work inside an approved architecture. The senior lead may integrate routine work without stopping the owner for a separate command.

### Senior checkpoint

Use an exact-head senior audit for architecture, public package contracts, major dependencies, measured performance strategy, major workflow integration, false-success repairs, and other consequential turning points.

### Critical independent checkpoint

Require separation of duties for schema/migration, canonical geometry or manufacturing truth, privileged IPC/filesystem/credentials/signing, capture evidence, release candidates, licensing/payment activation, and machine or safety work.

The senior lead may raise any change to a higher review level. Green CI never lowers required review depth.

# Command reference

## `Plan LaserX: <idea>`

The senior lead inspects relevant repository truth, then discusses product behavior, architecture, workflow, scope, priority, business model, manufacturing rules, or sequencing.

## `Lock that into LaserX`

The senior lead writes an accepted decision to the smallest authoritative GitHub location: issue, milestone, requirements, ADR, current status, ownership document, or review finding.

## `Continue LaserX`

Use with the senior engineering lead.

The senior lead must:

1. inspect current milestone, issue, branch/PR state, exact head, review findings, CI, and relevant architecture;
2. determine the next correct implementation or repair;
3. write or update a bounded execution brief;
4. assign an implementation agent and define acceptance, non-goals, and verification;
5. inspect the result at the review level required by risk;
6. merge routine work inside the active approved gate when exact-head evidence is sufficient;
7. keep implementation moving without requiring the owner to courier agent reports;
8. stop only for a product decision, critical checkpoint, milestone advancement, or genuine blocker.

When issued directly to an implementation agent, `Continue LaserX` means execute only the currently approved brief. It never authorizes roadmap invention, unapproved scope, merge, milestone advancement, or self-approval of critical work.

### Implementation-agent handoff

```text
LaserX M## <gate> — AWAITING_REVIEW | REPAIRING | BLOCKED
PR: #__
Branch: <branch>
Head: <full SHA>
Working tree: clean | dirty: <summary>
CI: green | failing | running
Work: <one-sentence result>
Blocker: none | <one-sentence blocker>
```

Detailed evidence belongs in the PR. Exact-head evidence belongs in an updated comment or generated check, not in a PR-body snapshot that silently becomes stale.

## `Check LaserX`

Force a senior audit of the live project and active work.

The senior lead inspects:

- product and milestone direction;
- active issue acceptance criteria;
- current branch, PR, and exact head;
- full diff and neighboring architecture;
- review threads and prior findings;
- relevant tests, fixtures, migrations, ADRs, and documentation;
- exact-head CI and packaged evidence;
- local/worktree state when available;
- scope control, shortcuts, regressions, and later-gate restraint.

When approval is being judged, the verdict is `READY`, `REPAIR`, or `BLOCKED`. Detailed findings go to GitHub.

## `Advance LaserX`

Authorize a state change reserved for the owner: a critical checkpoint merge, architecture gate transition, milestone transition, release transition, or other explicitly held advancement.

Before advancing, the senior lead verifies:

1. the reviewed head is unchanged;
2. required exact-head or merge-ref checks are green;
3. blocking findings and threads are resolved;
4. acceptance and exit criteria are satisfied;
5. required independent verification is complete;
6. the owner authorized the transition.

Then the senior lead may merge, close the active gate or issue, record exact evidence, activate the next approved state, and prepare the next implementation brief.

## `Status LaserX`

Return live read-only status: active milestone/gate, current assignment, branch/PR/head, working-tree evidence available, CI, blockers, next engineering action, and next owner decision if one exists.

## `Hold LaserX`

Pause new implementation, merging, and advancement until explicitly resumed.

# Normal delivery loop

```text
Owner: Plan LaserX: <idea>
Senior lead: inspect, discuss, settle direction
Owner: Lock that into LaserX
Senior lead: update GitHub

Owner: Continue LaserX
Senior lead: define and orchestrate the next work
Implementation agent: implement, test, push evidence
Senior lead: focused review or checkpoint audit according to risk

Routine work:
Senior lead: integrate and continue inside the approved gate

Critical checkpoint or milestone transition:
Senior lead: report READY / REPAIR / BLOCKED
Owner: Advance LaserX when satisfied
```

The owner does not need to forward Claude reports to ChatGPT or manually sequence every routine PR.

## Slice and PR policy

A milestone may use multiple bounded PRs when that improves safety and reviewability. A PR should represent a coherent vertical result, not arbitrary token-sized fragments.

Split work when one change combines unrelated architectures, risky migrations, trust boundaries, or independently testable workflows. Do not split into empty infrastructure that produces no testable value.

One active production milestone remains the default. Parallel research or future-milestone work requires explicit authorization and must remain isolated.

## Merge policy

### Routine merge

The senior lead may merge routine work when:

- it is inside the active approved gate;
- the exact head and diff were inspected;
- required tests and CI are green;
- no unresolved blocking finding exists;
- no milestone or critical-boundary transition occurs.

### Checkpoint merge

A senior checkpoint requires a recorded exact-head verdict before merge.

### Critical or milestone merge

Critical work requires independent verification where defined by `AGENTS.md`. Milestone exit and advancement always require owner authorization.

## State names

| State | Meaning |
| --- | --- |
| `PLANNING` | Product behavior, architecture, or gate is being defined. |
| `IMPLEMENTING` | An implementation agent is executing the approved brief. |
| `REPAIRING` | Blocking review or CI findings are being corrected. |
| `AWAITING_REVIEW` | Work is pushed and ready for the assigned review level. |
| `READY` | Required review and evidence are complete. |
| `BLOCKED` | A decision, dependency, or failure prevents correct progress. |
| `HELD` | The owner intentionally paused work. |

## Final rules

- GitHub is the project record; chat is coordination.
- The senior lead owns delivery direction and orchestration.
- Implementation agents execute bounded work; they do not invent the roadmap.
- Review depth follows risk rather than ritual.
- Independent verification is mandatory where the senior lead would otherwise self-approve critical work.
- The owner is not an agent-report courier.
- No milestone advances merely because code exists.
- No experiment branch is merged wholesale.