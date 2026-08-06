# LaserX Design Studio Operator Protocol

## Purpose

This is the no-copy-and-paste workflow for primary-chat planning and review, Codex implementation, GitHub evidence, and owner-controlled advancement.

> **The primary operations chat decides. GitHub remembers. Codex executes the bounded task. Pull requests hold the evidence.**

One repo. One active gate. One next command.

The active implementation surface is **Codex**. The owner selects the model inside Codex for each session; the repository does not select, pin, auto-route, or fall back to a model. Only `Continue LaserX` goes to a Codex implementation session.

The **LaserX Design Studio primary operations chat** is the sole planning/review write authority. All other chats are read-only and fail closed when identity is uncertain, exactly as required by `docs/CHAT_AUTHORITY.md`.

Claude, Anthropic, Fable, and other external paid implementation, review, continuation, and fallback routes are removed from active operation.

## The seven commands

| Command | Authorized location | What it does | Normal next move |
| --- | --- | --- | --- |
| `Plan LaserX: <idea>` | Primary operations chat | Discuss product intent. No repository implementation begins. | `Lock that into LaserX` |
| `Lock that into LaserX` | Primary operations chat | Write the accepted decision to the correct GitHub source of truth. | `Continue LaserX` |
| `Continue LaserX` | Codex implementation session | Implement or repair the active bounded gate, push exact evidence, then stop. | `Check LaserX` |
| `Check LaserX` | Primary operations chat | Review the exact PR head and put detailed findings on GitHub. | `Continue LaserX` or `Advance LaserX` |
| `Advance LaserX` | Primary operations chat | After `READY`, merge, close, record, and activate the next approved gate. | `Continue LaserX` |
| `Status LaserX` | Primary operations chat | Read-only status. No implementation, review, merge, or mutation. | Use the reported command |
| `Hold LaserX` | Primary operations chat or active Codex session | Pause new work while preserving the branch and PR. | Explicit resume |

Recognizing a valid command is not authorization. Outside the designated primary operations chat, planning/review commands remain read-only and must receive the return-to-primary response in `docs/CHAT_AUTHORITY.md`.

## What Codex does when you say `Continue LaserX`

1. **Read repository truth.** Read `AGENTS.md`, this protocol, `docs/CHAT_AUTHORITY.md`, `docs/WORKSTREAM_OWNERSHIP.md`, `docs/status/CURRENT.md`, Issues #44 and #37, the active milestone, active issue, active PR, review findings, and CI.
2. **Review blockers first.** If blocking findings exist, fix only those findings, add regression tests, rerun verification, update the same draft PR, and stop.
3. **Repair required CI second.** Diagnose and repair required CI without expanding scope.
4. **Stop for review when complete.** Push exact-head evidence and stop at `AWAITING_REVIEW`.
5. **Implement only when no active PR exists.** Build the smallest complete active-gate slice, test it, open one focused draft PR, and stop.
6. **Block instead of guessing.** If repository truth conflicts or no active gate exists, report `BLOCKED` rather than inventing scope or authority.

`Continue LaserX` never means merge, close the active issue, change the active gate, approve its own work, redesign unrelated architecture, create speculative infrastructure, merge an experiment wholesale, start parallel future work, create background polling, or continue after `AWAITING_REVIEW`.

### Codex compact completion response

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

The primary operations chat reads the exact head fresh. It does not accept the implementation handoff, an earlier review, or green CI alone as proof.

Its exact verdict is `READY`, `REPAIR`, or `BLOCKED`.

## Advancement safety check

Before `Advance LaserX` changes GitHub state:

- the conversation is the designated primary operations chat;
- the reviewed head has not changed;
- the active gate's required checks are green;
- no unresolved blocking review thread remains;
- gate acceptance and exit criteria are satisfied;
- the owner explicitly issued `Advance LaserX` there;
- `CURRENT.md` will receive the exact merge and verification record;
- the next approved gate will be activated from latest `main`, then work stops.

There is no automatic routine merge. `READY` makes advancement valid; the owner command in the primary operations chat performs it.

## CI contract

Required pull-request verification is consolidated around:

- **Repository Guard / structure-and-policy** — source-of-truth, security-file, case-collision, workflow-policy, and regression enforcement;
- **Canonical Verification / exact-head** — one exact-head path that always checks patch and governance regressions and runs the complete packaged Windows suite only when the active gate or changed product paths require it.

Completed milestone workflows are historical manual evidence, not independent permanent blockers on later pull requests. Installer signing and release publication remain explicit release gates.

## Final rules

- GitHub is the project record; chat summaries are not proof.
- Codex implements and repairs; it never merges or advances.
- The primary operations chat plans, locks, reviews, reports status, holds, and advances.
- Other chats are read-only and fail closed.
- The owner retains product direction, model choice inside Codex, and advancement.
- No milestone advances merely because code exists or CI is green.
