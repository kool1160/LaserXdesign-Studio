# ADR 0025: ChatGPT Implementation and Orchestration Ownership

## Status

Accepted by owner on 2026-08-04.

## Context

The post-M13 operating model assigned Claude as the default implementation agent and ChatGPT as the planning, audit, merge, and advancement authority. During the M14 G3 audit, the owner explicitly reassigned implementation responsibility to ChatGPT so one senior engineering authority can inspect the repository, set direction, implement bounded slices, and keep GitHub state synchronized.

The former role split created practical drift: handoffs and PR bodies became stale while the live branch moved, and project truth was spread across too many agent-specific documents.

## Decision

ChatGPT is the active senior software engineer, implementation lead, and project orchestrator while `docs/status/CURRENT.md` records that assignment.

ChatGPT may:

- inspect and modify the active repository;
- define and implement one bounded active-gate slice at a time;
- create and update branches and pull requests;
- add tests and exact-head evidence;
- repair findings and CI failures;
- merge and advance only after the owner's explicit command and an unchanged-head verification.

Claude and Codex are held by default. Either may be assigned an independent review, repair, comparison, or specialist task only when the owner explicitly says so and the assignment is recorded in GitHub.

Because the active implementation and orchestration authority are now the same agent, acceptance evidence must remain explicit and reproducible:

- every implementation uses a focused branch and reviewable PR;
- exact head SHA, changed files, tests, and CI are recorded from GitHub;
- implementation claims are not accepted from a handoff alone;
- the owner retains milestone advancement authority;
- a fresh exact-head review pass is required before merge;
- independent second-model review is used when risk, uncertainty, or owner direction warrants it.

## M14 consequence

G3 is complete. G4 is implemented in bounded sub-slices rather than one large desktop rewrite:

1. **G4A — renderer-safe integration foundation:** remove renderer-source Node coupling, harden resource ownership, establish worker/fingerprint/cache/cancellation contracts, and prove stale-result rejection.
2. **G4B — lazy open-document preview screen:** connect the current document to the derived scene and Three adapter without mutating project state; implement loading, progress, partial, empty, and unavailable states.
3. **G4C — interaction and failure behavior:** front/back/edge/perspective, assembled/exploded, orbit/pan/zoom/reset, presentation-only visibility, WebGL fallback, context-loss recovery, cleanup, accessibility, and desktop evidence.

G5 owns the complete capture transaction: same-frame RGBA readback and PNG encoding, content validation, deterministic naming, typed Electron IPC, overwrite/error handling, and filesystem save. G4 may expose the renderer capability required by G5 but does not save or independently validate captures.

## Consequences

- `docs/status/CURRENT.md` is the live assignment source.
- The legacy `docs/CLAUDE_EXECUTION_PLAN.md` path remains for compatibility but records the current implementation model.
- Agent-specific instructions are subordinate to the owner assignment recorded here and in `CURRENT.md`.
- GitHub remains project truth; chat summaries remain non-authoritative.
