# ADR 0025: ChatGPT Implementation and Orchestration Ownership

## Status

Accepted by owner on 2026-08-04.

## Context

The post-M13 operating model assigned Claude as the default implementation agent and ChatGPT as the planning, audit, merge, and advancement authority. During the M14 G3 audit, the owner explicitly reassigned implementation responsibility to ChatGPT so one senior engineering authority can inspect the repository, set direction, implement bounded slices, and keep GitHub state synchronized.

The former role split created practical drift: handoffs and PR bodies became stale while the live branch moved, and project truth was spread across too many agent-specific documents.

The owner further clarified that ChatGPT should handle implementation end to end and perform deep senior audits at important turning points, not turn every small implementation change into a heavyweight project audit.

## Decision

ChatGPT is the active senior software engineer, implementation lead, and project orchestrator while `docs/status/CURRENT.md` records that assignment.

ChatGPT may:

- inspect and modify the active repository;
- define and implement one bounded active-gate slice at a time;
- create and update branches and pull requests;
- add tests and exact-head evidence;
- repair findings and CI failures;
- merge routine implementation PRs inside the already owner-approved active gate after unchanged-head verification and required green CI;
- advance to a new gate or milestone only after the owner's explicit command.

Claude and Codex are held by default. Either may be assigned an independent review, repair, comparison, or specialist task only when the owner explicitly says so and the assignment is recorded in GitHub.

Because the active implementation and orchestration authority are now the same agent, acceptance evidence must remain explicit and reproducible:

- every implementation uses a focused branch and reviewable PR;
- exact head SHA, changed files, tests, and CI are recorded from GitHub;
- implementation claims are not accepted from a handoff alone;
- the owner retains product-direction and milestone-advancement authority;
- a fresh focused exact-head verification is required before every merge;
- a deep senior audit is reserved for the risk-bearing turning points defined below;
- independent second-model review is used when risk, uncertainty, separation of duties, or owner direction warrants it.

## Delivery and audit cadence

Review depth follows risk. Green CI is required evidence but is never automatic approval.

### Routine implementation verification

Routine work may proceed without a separate owner review command when it remains inside the approved active gate and does not cross a critical boundary. The senior lead performs focused diff review, verifies the exact head, checks required tests and CI, confirms scope restraint, and may merge the PR under the owner's standing implementation authorization.

Routine work includes narrow documentation updates, test-only strengthening, localized refactors with unchanged contracts, straightforward UI work inside an accepted architecture, and bounded bug repairs with clear regression coverage.

Routine verification is not a full-repository or full-roadmap audit.

### Senior turning-point audit

A deep senior exact-head and project-direction audit is required when work changes or proves:

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

A separate verifier is required when the load-bearing implementation was authored by the senior lead and the change affects:

- project schema or migrations;
- canonical units, geometry, cutability, physical-layer truth, or manufacturing export;
- filesystem, IPC, credentials, signing, updating, installation, or other privileged boundaries;
- capture evidence claimed as proof;
- AI credential or provider-security boundaries;
- licensing enforcement, payments, or public distribution;
- machine control, hardware, simulator, operator review, or safety;
- contested evidence, material disagreement between agents, or an explicit owner request.

The verifier may be Claude, Codex, another capable model, a human reviewer, or a combination, but must not have authored the load-bearing implementation being approved.

### Owner checkpoints

The owner's explicit command remains required for:

- changing product direction or milestone order;
- expanding the active milestone beyond its accepted contract;
- advancing to a new milestone;
- public release, pricing activation, or public distribution;
- machine-control or safety-gate activation.

The owner is not required to courier routine implementation reports or approve every small PR inside an already approved active gate.

## M14 consequence

G3 is complete. G4 is implemented in bounded sub-slices rather than one large desktop rewrite:

1. **G4A — renderer-safe integration foundation:** remove renderer-source Node coupling, harden resource ownership, establish worker/fingerprint/cache/cancellation contracts, and prove stale-result rejection.
2. **G4B — lazy open-document preview screen:** connect the current document to the derived scene and Three adapter without mutating project state; implement loading, progress, partial, empty, and unavailable states.
3. **G4C — interaction and failure behavior:** front/back/edge/perspective, assembled/exploded, orbit/pan/zoom/reset, presentation-only visibility, WebGL fallback, context-loss recovery, cleanup, accessibility, and desktop evidence.

G5 owns the complete capture transaction: same-frame RGBA readback and PNG encoding, content validation, deterministic naming, typed Electron IPC, overwrite/error handling, and filesystem save. G4 may expose the renderer capability required by G5 but does not save or independently validate captures.

G4A completion is a senior turning-point audit because it establishes the responsive worker/cache/cancellation architecture. G4B may contain routine implementation PRs, but completion of the open-document workflow is a senior checkpoint. G4C completion, G5, and G6 require deep audits; G5 and G6 also require independent verification at their critical boundaries.

## Consequences

- `docs/status/CURRENT.md` is the live assignment source.
- The legacy `docs/CLAUDE_EXECUTION_PLAN.md` path remains for compatibility but records the current implementation model.
- Agent-specific instructions are subordinate to the owner assignment recorded here and in `CURRENT.md`.
- Routine implementation can move without making the owner a report courier.
- Full audits concentrate on architecture, truth, security, milestone, and release risk.
- GitHub remains project truth; chat summaries remain non-authoritative.
