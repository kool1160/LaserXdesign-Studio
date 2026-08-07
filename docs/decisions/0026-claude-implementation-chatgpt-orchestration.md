# ADR 0026: Claude Implementation with ChatGPT Orchestration and Audit Authority

## Status

Superseded on 2026-08-06 by the Codex-only G1 governance reset recorded in `docs/status/CURRENT.md`, `docs/CHAT_AUTHORITY.md`, and `docs/CODEX_EXECUTION_PLAN.md`. Retained as historical evidence only; it carries no current implementation, review, continuation, fallback, or routing authority.

Originally accepted by owner on 2026-08-04 and superseded ADR 0025 the same day.

## Context

ADR 0025, accepted earlier on 2026-08-04, reassigned implementation responsibility to ChatGPT so one senior engineering authority could inspect the repository, implement bounded slices, and keep GitHub state synchronized end to end.

The owner subsequently clarified that this was not the intended durable operating model. The intended model — in effect before ADR 0025 and confirmed again on 2026-08-04 — is:

> Claude implements and repairs the code. ChatGPT acts as senior software engineer, project orchestrator, exact-head auditor, and acceptance authority. The owner controls product direction and milestone advancement.

ADR 0025 is not deleted. Its file, decision text, and rationale remain in the repository and in git history exactly as accepted, so the reasoning that motivated the temporary reassignment stays inspectable. It is marked superseded rather than removed.

This ADR restores and durably records the Claude-implementation model, incorporating the parts of ADR 0025 that remain useful — bounded senior-audit cadence, independent-checkpoint rules for critical trust boundaries, and the G4/G5 gate boundary — without carrying forward the ChatGPT-implements assumption those sections were written against.

## Decision

**Claude is the active implementation agent.** ChatGPT is the senior software engineer, project orchestrator, exact-head auditor, and acceptance authority. The owner retains product direction and milestone-advancement authority.

### Claude — implementation agent

Claude must:

- work only on the one active milestone and the one approved bounded slice recorded in `docs/status/CURRENT.md`;
- start fresh implementation slices from current `main` unless a reviewed repair continues an existing PR;
- use one focused branch and one reviewable PR per bounded slice;
- inspect live GitHub state, neighboring code, tests, and accepted ADRs before editing;
- implement the smallest complete vertical result with regression coverage and exact-head evidence in the same change;
- run required local verification and inspect exact-head CI before reporting a result;
- push or update a draft PR and stop at `AWAITING_REVIEW`, `REPAIRING`, or `BLOCKED`;
- never merge, close the milestone issue, activate the next gate, or approve its own work;
- never treat its own earlier summary, or another agent's handoff, as proof without re-reading the exact GitHub head.

Implementation responsibility does not authorize speculative rewrites, duplicate research, broad cleanup outside the active slice, parallel future-milestone scope, or self-directed advancement.

### ChatGPT — senior engineer, orchestrator, exact-head auditor, acceptance authority

ChatGPT must:

- convert accepted owner decisions into GitHub issues, milestone documents, ADRs, and status changes;
- inspect the exact PR head, full diff, review threads, tests, fixtures, and required CI before forming a verdict;
- post detailed findings to GitHub rather than only chat;
- return `READY`, `REPAIR`, or `BLOCKED` for each reviewed head;
- perform the deep senior turning-point audit at the risk-bearing checkpoints defined below;
- assign independent verification at the critical checkpoints defined below;
- merge and advance a gate or milestone only after an unchanged reviewed head, required green CI, and the owner's explicit advancement command;
- never treat Claude's report as proof without independently checking GitHub evidence;
- never implement the load-bearing change it is about to audit in the same review.

### Codex — held unless explicitly reassigned

Codex remains held from default implementation or audit duty. It is available for an explicit independent review, repair, comparison, or specialist task recorded in `CURRENT.md`, the active issue, or the active PR.

### Owner authority

The owner controls product direction, milestone order, pricing philosophy, trial policy, and milestone advancement. An exact-head `READY` verdict from ChatGPT is necessary but not sufficient for advancement; the owner's explicit command remains required.

## Delivery and audit cadence

Carried forward from ADR 0025 because it remains correct regardless of which agent implements: review depth follows risk, and green CI is required evidence but never automatic approval.

### Routine implementation verification

Routine work inside the already-approved active gate — narrow documentation, test-only strengthening, localized refactors with unchanged contracts, accepted-architecture UI work, and bounded bug repairs with regression coverage — receives focused exact-head diff/test/CI verification from ChatGPT. It does not require a separate owner review command or a full senior audit for every PR.

### Senior turning-point audit

A deep senior exact-head and project-direction audit from ChatGPT is required when work changes or proves:

1. an ADR, package architecture, or cross-package public contract;
2. a major integration boundary or milestone-defining user workflow;
3. worker, caching, cancellation, concurrency, or measured performance strategy;
4. a major runtime dependency, bundling boundary, or platform assumption;
5. a repair for false success, silent incorrect output, data loss, or resource leakage;
6. evidence that could materially change the remaining roadmap;
7. completion of a risk-bearing gate;
8. milestone exit or activation of the next milestone;
9. a private or public release candidate.

### Critical independent checkpoint

A verifier who did not author the load-bearing implementation is required when the change affects:

- project schema or migrations;
- canonical units, geometry, cutability, physical-layer truth, or manufacturing export;
- filesystem, IPC, credentials, signing, updating, installation, or other privileged boundaries;
- capture evidence claimed as proof;
- AI credential or provider-security boundaries;
- licensing enforcement, payments, or public distribution;
- machine control, hardware, simulator, operator review, or safety;
- contested evidence, material disagreement between agents, or an explicit owner request.

The verifier may be Claude, Codex, another capable model, a human reviewer, or a combination — whichever party did not author the change under review. Because Claude is now the default implementation agent, this checkpoint typically assigns Codex or another model rather than Claude for changes Claude authored.

### Owner checkpoints

The owner's explicit command remains required for changing product direction or milestone order, expanding the active milestone beyond its accepted contract, advancing to a new milestone, public release or pricing activation, and machine-control or safety-gate activation. The owner is not required to courier routine implementation reports or approve every small PR inside an already-approved active gate.

## M14 consequence

G0 through G3 are complete and unaffected by this correction — they were implemented under the Claude-first model already. G4A, currently `REPAIRING` on PR #61, continues under Claude implementation; only the governance record was wrong, not the code.

The G4/G5 boundary ADR 0025 established remains correct and is restated here rather than left only in a superseded document:

- **G4** owns rendering, lazy loading, open-document integration, progress, controls, visibility, WebGL fallback, context recovery, and renderer cleanup, split into G4A (renderer-safe integration foundation), G4B (lazy open-document preview screen), and G4C (interaction, fallback, and cleanup);
- G5 owns the complete capture transaction: same-frame RGBA readback and PNG encoding, content and dimension binding, deterministic naming, typed sender-checked preload/main IPC, path and overwrite validation, and atomic filesystem save;
- G4 may expose the renderer capability G5 needs but does not save files or independently claim capture success.

G4A completion remains a senior turning-point audit. G4B may contain routine implementation PRs, but completion of the open-document workflow is a senior checkpoint. G4C completion, G5, and G6 require deep audits; G5 and G6 also require independent verification at their critical boundaries, per the schedule above.

## Consequences

- `docs/status/CURRENT.md` is the live assignment source and now records Claude as implementation lead.
- `docs/CLAUDE_EXECUTION_PLAN.md`, `docs/OPERATOR_PROTOCOL.md`, `docs/WORKSTREAM_OWNERSHIP.md`, and `AGENTS.md` are realigned to this ADR in the same governance change.
- ADR 0025 remains in the repository, marked superseded, so the reasoning behind the temporary reassignment and its reversal both stay inspectable.
- GitHub remains project truth; chat summaries remain non-authoritative.
- No milestone advances merely because code exists or CI is green.
- No experiment branch is merged wholesale.

## Alternatives considered

- **Deleting ADR 0025** was rejected: it would erase the record of a real owner decision and its reversal, making the history harder to audit, not easier.
- **Amending ADR 0025 in place** was rejected: overwriting an accepted decision record breaks the append-only discipline every other ADR in this repository follows, and the governance correction itself required a visible, dated, reviewable change.
- **Leaving ChatGPT as implementer with Claude added as a second implementer** was rejected: the owner's clarification was specific about restoring the single-implementer, single-orchestrator split, not about adding a second implementation agent.
