# Claude Execution Plan

## Purpose

Keep LaserX moving through one bounded, reviewable active-gate slice at a time while preventing agent handoff drift, speculative scope, and stale evidence.

Issues #44 and #37 determine product direction. `docs/status/CURRENT.md` determines the active milestone, slice, and implementation owner.

## Current role split

### Claude

Claude is the active implementation agent while `docs/status/CURRENT.md` records that assignment under ADR 0026.

Claude must:

- inspect current `main`, active issues, open PRs, neighboring code, tests, and accepted ADRs before editing;
- implement or validate only the active bounded slice recorded in `CURRENT.md`;
- use a focused branch and reviewable PR for any repair or durable evidence change;
- add regression coverage and exact-head evidence with repairs;
- distinguish implementation evidence from acceptance judgment;
- push exact-head evidence and stop at `AWAITING_REVIEW`, `OWNER_RETEST_REQUIRED`, `REPAIRING`, or `BLOCKED`;
- never merge, close the milestone issue, activate the next gate, or approve its own work;
- keep GitHub status, issues, PR evidence, and code synchronized.

### ChatGPT

ChatGPT is the senior software engineer, project orchestrator, exact-head auditor, and acceptance authority under ADR 0026.

ChatGPT performs fresh exact-head review, defines bounded repairs, verifies evidence, merges routine work inside the active gate, and advances or closes gates only after the owner's explicit command.

### Codex

Codex is held by default. It remains available for explicit independent audit, repair, comparison, or specialist work.

### Owner

The owner controls product direction, milestone order, advancement, and hands-on acceptance. Green CI alone never advances a gate.

## Evidence rules

Every repair or evidence PR records:

- exact base and head SHAs;
- changed-file count;
- focused and root test results;
- required exact-head CI or reviewed merge-ref evidence;
- unresolved findings and limitations;
- later-gate work deliberately excluded.

PR bodies contain stable scope and architecture. Final exact-head comments or reviews contain volatile evidence. A handoff is never proof by itself.

## M14 implementation queue

M14 is implemented component by component from current `main`. The accepted experiment branch is never merged wholesale.

### Slice G0 — governance and architecture lock — complete

Production preview architecture, package boundaries, no-CAD-kernel decision, lazy loading, privileged capture boundary, and production exclusions are accepted.

### Slice G1 — text-heavy scaling evidence — complete

Realistic outlined-text and high-point-count evidence established worker, caching, progress, cancellation, and stale-result requirements.

### Slice G2 — pure physical scene package — complete

Renderer-independent scene and assembly contracts, exact thickness, order, holes, findings, determinism, immutability, and fail-closed behavior are merged.

### Slice G3 — Three renderer adapter package — complete

Deterministic Three geometry, placement, camera fit, current-material appearance, capture helpers, and bounded cleanup are merged.

### Slice G4 — lazy desktop integration — complete

#### G4A — renderer-safe integration foundation — complete

Worker protocol, physical-content caching, in-flight coalescing, cancellation, stale-result rejection, progress, and renderer-safe boundaries are merged.

#### G4B — lazy open-document preview screen — complete

The current document is wired to a lazily loaded, bounded, non-mutating preview screen.

#### G4C — interaction, fallback, and cleanup — complete

Views, modes, orbit/pan/zoom/reset, visibility, keyboard/high-DPI behavior, WebGL/context handling, and cleanup are merged.

### Slice G5 — privileged PNG capture — complete

PR #65 was accepted at head `d34c9cca2b7552551cfcd1efcd6fccd7baaa6a58` and squash-merged as `3f0d8dba70e0c218308d28d1917cd5584c928bd6`.

G5 delivered same-frame capture evidence, deterministic content-bound naming, typed sender-checked IPC, complete PNG validation and real decode, resource bounds, blank-image rejection, path/overwrite/cancellation handling, atomic writes, stale-status lifetime control, and non-mutation evidence.

### Slice G6 — exact-head Windows evidence and owner retest — active

G6 is validation and closure evidence, not feature expansion.

Claude must:

- start from current `main` and record its exact SHA;
- run the production package and complete packaged Windows E2E suite;
- prove the preview remains lazy-loaded, Three.js is absent from the main editor entry, and no lab/research fixture or hook ships;
- exercise representative real projects, exact thickness/dimensions, all views and modes, mouse and keyboard interaction, layer visibility, high DPI, GPU/WebGL fallback, context loss, and repeated cleanup;
- verify preview and capture remain non-mutating across project geometry, dirty state, history, selection, analysis, save, SVG/DXF, and production packages;
- generate a fresh private Windows installer with exact provenance;
- prepare a compact owner retest checklist covering preview, manipulation, capture, save, reopen, export, and controlled failures;
- stop at `OWNER_RETEST_REQUIRED` once machine-verifiable evidence is complete;
- after owner results are recorded, stop at `AWAITING_REVIEW` for the final milestone closure audit.

If validation finds a concrete defect, create the smallest bounded G6 repair PR with regression coverage. Do not turn G6 into cleanup, redesign, or new capability work.

G6 excludes M15 onboarding, M16 material expansion and draft PR #40, process/export profiles, new AI work, licensing, public beta, Version 1, CAD/CAM, nesting, G-code, and machine control.

## Operating loop

1. Owner gives Claude `Continue LaserX` or `Repair LaserX`.
2. Claude reads live GitHub state and performs only the active G6 evidence or bounded repair work.
3. Claude records exact evidence and stops at `OWNER_RETEST_REQUIRED`, `AWAITING_REVIEW`, `REPAIRING`, or `BLOCKED`.
4. ChatGPT audits the exact head and evidence.
5. Issue #30 closes only after machine evidence passes, owner hands-on validation passes, no blocker remains, and the owner explicitly advances.
6. M15 remains blocked until a separate owner command after M14 closure.

## Restraint

Do not spend implementation capacity on duplicate research, speculative future infrastructure, broad cleanup unrelated to the active slice, wholesale experiment merges, or later-milestone work. One complete vertical result beats a large half-integrated rewrite.
