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

## M15 implementation queue

M15 makes the existing depth of LaserX feel simple and obvious. It does not replace the authoritative project, geometry, cutability, save, export, security, or physical-preview systems.

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

### Slice G1 — first-launch goal chooser and resumable guidance shell — held

Will implement the calm first-launch surface, goal choice, guidance shell, orientation, and resume/replay foundations only after G0 is accepted.

### Slice G2 — Create My First Sign guided vertical slice — held

Will guide one deterministic sign from dimensions and text through material, cutability, 3D, save, and export.

### Slice G3 — vector import and raster trace contextual guidance — held

Will separate SVG/DXF import from PNG/JPEG tracing and expose only relevant controls and explanations.

### Slice G4 — grouped repair decisions and Fix safe problems workflow — held

Will group findings into **Safe to fix**, **Suggested fix**, and **Needs your decision**, with preview, acceptance, undo, and fixed/skipped/remaining counts.

### Slice G5 — Learn Mode, replay, recovery, and contextual explanations — held

Will add reusable explanations and replayable teaching without turning the product into a disconnected slideshow.

### Slice G6 — packaged accessibility and owner-observed first-session validation — held

Will prove complete packaged flows, accessibility, recovery, and the documented ten-minute owner-observed fixture set before M15 closure.

## Operating loop

1. Owner gives Claude `Continue LaserX` or `Repair LaserX`.
2. Claude reads live GitHub state and performs only active M15 G0 work or an explicitly assigned repair.
3. Claude records exact evidence and stops at `AWAITING_REVIEW`, `REPAIRING`, or `BLOCKED`.
4. ChatGPT audits the exact head, full diff, tests, review threads, and CI.
5. A routine accepted PR may merge inside the active slice after exact-head verification.
6. A new M15 slice activates only after owner advancement and synchronized GitHub status.
7. Issue #45 closes only after all M15 acceptance evidence, owner-observed usability evidence, final audit, and explicit owner advancement pass.
8. M16 and draft PR #40 remain blocked throughout M15.

## Restraint

Do not spend implementation capacity on speculative visual rewrites, duplicate onboarding systems, broad cleanup, material expansion, wholesale experiment merges, later-milestone work, or architecture changes unrelated to the active guided-workflow boundary. One complete learnable workflow beats a large cosmetic redesign.
