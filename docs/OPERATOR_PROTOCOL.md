# LaserX Design Studio Operator Protocol

## Purpose

This is the no-copy-and-paste workflow for planning, SOL High implementation, GitHub, review, and milestone advancement.

> **Chat decides. GitHub remembers. SOL High executes. Pull requests hold the evidence. The owner receives the verdict and next command.**

One repo. One active gate. One next command.

The implementation model is **SOL High**, the owner-selected OpenAI coding model running at High reasoning in the Codex coding workspace. Only `Continue LaserX` goes to that implementation thread. All planning, decision locking, review, status, holds, and advancement stay in the planning/review chat.

Claude and paid Anthropic models are held unless the owner explicitly authorizes one named, bounded task in GitHub.

## The seven commands

| Command | Use it with | What it does | Normal next move |
| --- | --- | --- | --- |
| `Plan LaserX: <idea>` | Planning/review chat | Discuss product intent. No repository implementation begins. | `Lock that into LaserX` |
| `Lock that into LaserX` | Planning/review chat | Write the accepted decision to the correct GitHub source of truth. | `Continue LaserX` |
| `Continue LaserX` | SOL High implementation thread | Implement or repair the active gate, update exact evidence, then stop. | `Check LaserX` |
| `Check LaserX` | Planning/review chat | Review the real exact PR head and put details on GitHub. | `Continue LaserX` or `Advance LaserX` |
| `Advance LaserX` | Planning/review chat | After `READY`, merge, close, record, and activate the next issue or gate. | `Continue LaserX` |
| `Status LaserX` | Planning/review chat | Read-only status. No implementation, review, merge, or mutation. | Use the reported command |
| `Hold LaserX` | Either chat | Pause new work while preserving the branch and PR. | Explicit resume |

## Command details

### `Plan LaserX: <idea>`

**Use:** Planning/review chat.

**Purpose:** Discuss a feature, workflow, concern, priority, business model, architecture choice, or manufacturing rule without changing implementation.

**Result:** A clear decision, open question, or rejected idea.

### `Lock that into LaserX`

**Use:** Planning/review chat.

**Purpose:** Write the accepted decision into the smallest correct GitHub location: active issue, milestone, requirements file, ADR, ownership document, status file, or PR finding.

**Result:** SOL High discovers it from GitHub. The owner carries no markdown between chats.

### `Continue LaserX`

**Use:** SOL High implementation thread.

**Purpose:** Read the active gate and live PR state, then implement, repair review findings, or repair required CI.

**Result:** The draft PR is updated to `AWAITING_REVIEW` or the work stops `BLOCKED`.

### `Check LaserX`

**Use:** Planning/review chat.

**Purpose:** Review the exact PR head, full relevant diff, acceptance criteria, tests, review state, and required CI.

**Result:** `READY`, `REPAIR`, or `BLOCKED`. Detailed findings stay on GitHub.

### `Advance LaserX`

**Use:** Planning/review chat.

**Purpose:** After `READY`, verify the unchanged head and green CI, merge, close the issue when appropriate, update `CURRENT.md`, and activate the next approved gate from latest `main`.

**Result:** The next gate is active; its implementation has not started.

### `Status LaserX`

**Use:** Planning/review chat.

**Purpose:** Read the milestone, issue, PR, head, CI, blocker, implementation model, and next valid command without reviewing or changing anything.

**Result:** Compact status plus the next valid command.

### `Hold LaserX`

**Use:** Either chat.

**Purpose:** Pause implementation, merging, and advancement while preserving the current branch and PR.

**Result:** `HELD` until the owner explicitly resumes.

## What SOL High does when you say `Continue LaserX`

1. **Read repository truth.** Read `AGENTS.md`, this protocol, `docs/status/CURRENT.md`, active milestone, active issue, active PR, review findings, and CI.
2. **Review blockers first.** If blocking findings exist, fix only those findings, add regression tests, rerun verification, update the same draft PR, and stop.
3. **Repair CI second.** If required CI is failing, diagnose and repair it without expanding scope, update the same draft PR, and stop.
4. **Stop for review when green.** If the PR is green with no unresolved blocker, refresh exact-head evidence and stop at `AWAITING_REVIEW`.
5. **Implement only when no active PR exists.** Build the smallest complete active-gate vertical slice, test it, open a draft PR, and stop.
6. **Block instead of guessing.** If repository truth conflicts or no active gate exists, record the problem and stop.

`Continue LaserX` never means:

- merge the pull request;
- close the active issue;
- activate or begin the next milestone or gate;
- redesign unrelated architecture;
- create speculative future infrastructure;
- merge an experiment branch wholesale;
- start parallel future work;
- create scheduled heartbeats or background polling;
- keep a session alive after `AWAITING_REVIEW`;
- dump a giant duplicate project report into chat.

### SOL High compact completion response

```text
LaserX M## — AWAITING_REVIEW | BLOCKED
PR: #__
Head: <full SHA>
CI: green | failing | running
Work: <one-sentence result>
Blocker: none | <one-sentence blocker>
Next command: Check LaserX | Continue LaserX | Plan LaserX: <decision>
```

## What `Check LaserX` returns

```text
LaserX M## PR #__ — READY | REPAIR | BLOCKED
Head: <full SHA>
CI: green | failing | running
Finding: none | <one or two short blocking reasons>
Next command: Advance LaserX | Continue LaserX | Plan LaserX: <decision>
```

The planning/review chat reads the exact head fresh. It does not accept the implementation handoff, an earlier review, or green CI alone as proof.

## Advancement safety check

Before `Advance LaserX` changes GitHub state:

- the reviewed head has not changed;
- required GitHub workflows are green;
- no unresolved blocking review thread remains;
- the active gate or milestone acceptance and exit criteria are satisfied;
- the owner explicitly issued `Advance LaserX`;
- `CURRENT.md` will receive the exact merge and verification record;
- the next issue or gate will be activated from latest `main`, then work stops.

There is no automatic routine merge. `READY` makes advancement valid; the owner command performs it.

## Complete operating loop

1. **Decide:** `Plan LaserX: <idea>`
2. **Record:** `Lock that into LaserX`
3. **Build or repair:** `Continue LaserX`
4. **Review:** `Check LaserX`
5. **If REPAIR:** `Continue LaserX`
6. **If READY:** `Advance LaserX`
7. **Start the next gate:** `Continue LaserX`

## Final rules

- GitHub is the project record; chat is not.
- SOL High implements and repairs; it never merges or advances.
- Planning/review chat plans, locks, reviews, reports status, holds, and advances.
- The owner retains product direction, model choice, and advancement.
- No agent invents the roadmap.
- No milestone advances merely because code exists.
- No paid Anthropic work occurs without a new explicit owner authorization.
