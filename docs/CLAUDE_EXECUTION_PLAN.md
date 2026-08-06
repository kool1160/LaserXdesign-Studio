# Claude Execution Plan

## Purpose

Keep LaserX moving through one bounded, reviewable active-gate slice at a time while preventing agent handoff drift, speculative scope, and stale evidence.

Issues #44 and #37 determine product direction. `docs/status/CURRENT.md` determines the active milestone, slice, and implementation owner.

## Current role split

### Claude

Claude is the active implementation agent while `docs/status/CURRENT.md` records that assignment under ADR 0026.

Claude must:

- inspect current `main`, active issues, open PRs, neighboring code, tests, accepted ADRs, and packaged behavior before editing;
- implement only the active bounded slice recorded in `CURRENT.md`;
- use a focused branch and reviewable PR;
- add regression coverage and exact-head evidence;
- distinguish implementation evidence from acceptance judgment;
- stop at `AWAITING_REVIEW`, `OWNER_RETEST_REQUIRED`, `REPAIRING`, or `BLOCKED`;
- never merge, close the milestone issue, activate the next gate, or approve its own work;
- keep GitHub status, issues, PR evidence, and code synchronized.

### ChatGPT

ChatGPT is the senior software engineer, project orchestrator, exact-head auditor, and acceptance authority under ADR 0026.

ChatGPT defines bounded repairs and next slices, independently checks exact-head code and evidence, merges routine work inside an already-approved slice, and advances or closes gates only after the owner's explicit command.

### Codex

Codex is held by default. It remains available for explicit independent audit, repair, comparison, environment, or specialist work.

### Owner

The owner controls product direction, milestone order, advancement, and hands-on acceptance. Green CI alone never advances a gate.

## Evidence rules

Every implementation or repair PR records:

- exact base and head SHAs;
- changed-file count;
- focused and root test results;
- required exact-head CI or reviewed merge-ref evidence;
- unresolved findings and limitations;
- later-gate work deliberately excluded.

PR bodies contain stable scope and architecture. Final exact-head comments or reviews contain volatile evidence. A handoff is never proof by itself.

## M14 completion record

M14 is complete. Its component-by-component promotion path remains the accepted production history:

- Slice G0 — governance and architecture lock — complete;
- Slice G1 — text-heavy scaling evidence — complete;
- Slice G2 — pure physical scene package — complete;
- Slice G3 — Three renderer adapter package — complete;
- Slice G4 — lazy desktop integration — complete;
  - G4A — renderer-safe integration foundation — complete;
  - G4B — lazy open-document preview screen — complete;
  - G4C — interaction, fallback, and cleanup — complete;
- Slice G5 — privileged PNG capture — complete;
- Slice G6 — exact-head Windows evidence and owner retest — complete.

Issue #30 records the exact heads, merges, machine evidence, private installer provenance, owner screenshots, owner pass, and final closure audit. M14 must not be reopened or broadened through M15 work.

## M15 binding operating contract

M15 makes the existing depth of LaserX feel simple and obvious. It does not replace the authoritative project, geometry, cutability, save, export, security, or physical-preview systems.

After reviewed merge, `docs/milestones/M15-workflow-first-product-amendment.md` is binding on G1-G6.

The standing implementation direction is:

- guided workflow is the default product experience;
- Advanced Workspace and Exit Guidance remain direct escape paths;
- feature surfaces are isolated incrementally instead of through a broad `App.tsx` rewrite;
- physical 3D is a required guided checkpoint before export unless a truthful unavailable path is acknowledged;
- repair is a flagship workflow with grouped confidence and Fix Safe Problems;
- early first-time-user observation occurs during G2-G4;
- G6 performs a minimum five-participant packaged cohort with at least four ten-minute successes;
- AI remains optional and user-supplied;
- machine control and later-milestone work remain excluded.

## M15 implementation queue

### Slice G0 — guided-workflow architecture and first-run contract — active

G0 is an architecture and contract slice. It must establish one coherent workflow system before user-facing onboarding is implemented piecemeal.

Claude must:

- inspect the packaged application and map the current first-launch, empty-state, create, vector-import, raster-trace, repair, 3D, save, and export flows;
- document where unrelated controls, unclear next actions, or stale technical language compete with the user's current goal;
- define a tutorial/guidance state machine separated from feature logic and authoritative project state;
- lock the first-run goals **Create My First Sign**, **Import My Own Design**, and **Describe What I Want With AI — Optional**;
- define a contextual-control matrix for create, vector import, raster trace, repair, 3D, save, and export;
- define one clear primary action per step whenever practical;
- define skip, back, resume, replay, cancel, failure, and recovery behavior that cannot trap the user;
- define local/privacy-respecting first-session evidence and the owner-observed ten-minute fixture set;
- define keyboard, focus, high-DPI, reduced-motion, screen-reader, and non-color-only behavior;
- record the architecture in an ADR and add mechanical checks where they genuinely prevent drift;
- make only the smallest implementation or harness change needed to prove the boundary;
- open one focused draft PR and stop at `AWAITING_REVIEW`.

G0 does not implement the full first-run shell, tutorial content, grouped repair engine, material expansion, process profiles, export profiles, new AI capability, licensing, public beta, or M16 work.

The workflow-first amendment does not alter PR #67 acceptance or add work to G0.

### Slice G1 — default goal chooser and resumable guided shell — held

After G0 is accepted and the owner advances G1, Claude must implement only the guidance shell and its minimum surface-control foundation:

- first-launch goal chooser;
- Resume Previous Workflow when a valid snapshot exists;
- Advanced Workspace and Exit Guidance;
- local onboarding preference and resumable-state persistence;
- fresh run-token generation and caller-side uniqueness tests required by ADR 0027;
- keyboard/focus ownership;
- a feature-surface controller for Create, Import, Trace, Analyze/Repair, Text, Sign, AI, Editing, 3D, Save, and Export;
- only the smallest incremental extraction needed to prove surface visibility and one-primary-action behavior.

Forbidden in G1:

- no complete create/import/repair journey;
- no grouped repair engine;
- no broad `App.tsx` rewrite;
- no whole-application styling pass;
- no later-milestone feature work.

### Slice G2 — Create My First Sign guided vertical slice — held

After G1 acceptance and owner advancement, Claude must deliver one complete deterministic create journey:

1. basic sign type;
2. text;
3. exact dimensions;
4. current supported material and thickness;
5. applicable backing/border/layer structure;
6. manufacturing analysis;
7. finding resolution or acknowledgment;
8. save;
9. focused physical 3D;
10. guided preview completion or truthful unavailable acknowledgment;
11. export.

Export does not become the guided primary action before the 3D checkpoint.

Before G2 closure, one owner-approved first-time participant must attempt the path without direct coaching. Record time, hesitation, wrong clicks, language confusion, 3D completion, export result, and repaired blockers.

### Slice G3 — vector import and raster trace contextual guidance — held

After G2 acceptance and owner advancement, Claude must deliver distinct source-aware paths:

- generic file selection with Trace hidden while source type is unknown;
- SVG/DXF vector review with units, scale, layers, grouped findings, accept/cancel, analysis, 3D, save, and export;
- PNG/JPEG preprocessing and trace controls only after raster selection;
- cancellation/rejection returning to source selection or a named recovery state without claiming import success;
- truthful failure paths without invented geometry.

Before G3 closure:

- one owner-approved first-time vector-import observation is recorded;
- one owner-approved first-time raster-import/trace observation is recorded.

The same participant may cover both paths if evidence remains distinct.

### Slice G4 — flagship grouped repair and Fix Safe Problems — held

After G3 acceptance and owner advancement, Claude must deliver the bounded repair product:

- **Safe to fix**;
- **Suggested fix**;
- **Needs your decision**;
- grouped plain-language summaries rather than default raw entity lists;
- before/after preview;
- no geometry mutation before acceptance;
- one undoable batch when technically practical;
- fixed, skipped, and remaining counts;
- truthful analysis invalidation/rerun;
- reject and undo paths;
- advanced Details for entity-level diagnostics.

Every repair class must record its deterministic eligibility, affected geometry, change, remaining uncertainty, undo semantics, and analysis consequences.

Required fixtures include duplicate geometry, zero-length entities, redundant collinear points, approved near-closures, unsafe open contours, self-intersections, overlaps, islands/containment ambiguity, unit/scale ambiguity, and one large-finding broken DXF.

Before G4 closure, one owner-approved first-time participant must import a broken file, understand the summary, preview and accept Fix Safe Problems, undo and reapply it, work remaining decisions, reach 3D, and export.

### Slice G5 — Learn Mode, replay, recovery, and contextual explanations — held

After G4 acceptance and owner advancement, Claude must add contextual teaching through the same workflow-surface system.

Learn Mode must answer in normal shop language:

- what the control or concept is;
- why it matters;
- what changes;
- whether it can be skipped or undone;
- whether it affects geometry, presentation, or downstream settings;
- why LaserX is warning the user.

Required topics include layers, materials/thickness, bridges, islands, cutability, repair confidence, Fix Safe Problems, 3D, save/export, downstream software ownership, and optional AI.

Help must be available inside create, import, trace, repair, 3D, and export. Replay must not overwrite project work. Guidance failure must leave normal editing, saving, analysis, 3D, and export usable. Users can disable Learn Mode without disabling core capability.

### Slice G6 — packaged accessibility and first-session cohort — held

After G5 acceptance and owner advancement, Claude must prepare exact-head packaged evidence for:

- minimum five owner-approved first-time participants;
- at least four completing one documented primary workflow within ten minutes without direct coaching;
- coverage of create, vector import, raster trace, broken-file repair, AI disconnected, physical 3D, export, and realistic mistake recovery;
- keyboard, focus, screen reader, `aria-live`, reduced motion, non-color-only guidance, high-DPI, and supported Windows scaling;
- no trapped workflow state;
- no hidden destructive edits;
- no regression to a permanent wall of unrelated controls.

Record time to success, stuck points, incorrect clicks, undiscovered features, misunderstood terminology, understanding of LaserX versus machine software, understanding that AI is optional, 3D completion, export scale, recovery, and blocker disposition.

M15 closes only after exact-head packaged evidence, owner acceptance, issue closure, and explicit owner advancement.

## M22 carry-forward

M22 remains the broader final Version 1 usability and visual-polish gate.

M22 must begin by reviewing all M15 observation evidence and verify that M16-M21 did not reintroduce permanent tool walls, competing primary actions, optional 3D bypass, raw repair overload, technical-language drift, AI dependency, inaccessible guidance, or create/import/repair/3D/export workflow drift.

## Operating loop

1. Owner gives Claude `Continue LaserX` or `Repair LaserX`.
2. Claude reads live GitHub state and performs only the active M15 slice or an explicitly assigned repair.
3. Claude records exact evidence and stops at `AWAITING_REVIEW`, `REPAIRING`, or `BLOCKED`.
4. ChatGPT audits the exact head, full diff, tests, review threads, and CI.
5. A routine accepted PR may merge inside the active slice after exact-head verification.
6. A new M15 slice activates only after owner advancement and synchronized GitHub status.
7. Issue #45 closes only after all M15 acceptance evidence, owner-observed usability evidence, final audit, and explicit owner advancement pass.
8. M16 and draft PR #40 remain blocked throughout M15.

## Restraint

Do not spend implementation capacity on speculative visual rewrites, duplicate onboarding systems, broad cleanup, material expansion, wholesale experiment merges, later-milestone work, or architecture changes unrelated to the active guided-workflow boundary.

One complete learnable workflow beats a large cosmetic redesign. One incrementally isolated surface beats a risky whole-application rewrite.
