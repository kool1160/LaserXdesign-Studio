# M15 — Guided Onboarding, Workflow-First UI, and Learn Mode

## Status

**Active.** Active issue: #45.

Current slice: **G4 — grouped repair decisions and Fix safe problems workflow**.

G3 and its post-merge physical-confirmation repair are accepted and merged. G5 and G6 remain held.

## User-visible outcome

A first-time user chooses a real goal, sees only relevant controls, completes real LaserX actions, understands repair decisions, views physical 3D, and exports without needing CAD knowledge or an external tutorial.

## Approved implementation gates

1. **G0 — guided-workflow architecture and first-run contract** — merged and accepted.
2. **G1 — first-launch goal chooser and resumable guidance shell** — merged and accepted.
3. **G2 — Create My First Sign guided vertical slice** — merged and accepted.
4. **G3 — vector import and raster trace contextual guidance** — merged and accepted; post-merge physical-confirmation repair PR #74 merged and accepted.
5. **G4 — grouped repair decisions and Fix safe problems workflow** — **active**.
6. **G5 — Learn Mode, replay, recovery, and contextual explanations** — held.
7. **G6 — packaged accessibility and owner-observed first-session validation** — held.

Each gate requires exact-head review and explicit owner advancement before the next gate becomes active. A merge alone does not advance a gate.

## Completion records

### G0

PR #67 locked ADR 0027 and the pure guided-workflow state machine. Squash merge: `90946f7db42ac2cc2be3532bf49bdcdfe0d885ed`.

### G1 prerequisite

PR #70 normalized Codex-only execution, primary-chat write authority, and required CI. Squash merge: `84a3ffad4973ed8830c1e9fc2e1f026183a1a30c`.

### G1

PR #71 implemented the clean first-launch chooser, atomic onboarding preferences, resumable exact-project guidance, contextual shell visibility, native-menu gating, project-replacement invalidation, and packaged recovery coverage. Squash merge: `41e572a017a82f66f9586ab6e34253d914bc31e2`.

### G2

PR #72 completed **Create My First Sign** through real size/material, content, whole-design analysis, ADR 0027 resolution rules, required physical 3D, Save/Save As, and successful SVG/DXF export. Squash merge: `c9a834a811db831207da6ca695ee8c46d6a88ca4`.

### G3

PR #73 completed source-aware **Import My Own Design** guidance across SVG/DXF and PNG/JPEG, transient source recovery, non-destructive cancel/reject, physical assignment, whole-design analysis, required physical 3D, and export. Squash merge: `f2a54d732ec9ee661c921d421da08e2b83c01b14`.

### G3 post-merge repair

PR #74 fixed the late P1 where assigning a physical role could populate default material/thickness and auto-advance **Set physical details** before review.

- Reviewed head: `66dab265b3073145e48667639b0a303691733f7b`
- Squash merge: `df0d3463470afb7f69724ca808c25df0b8317d87`
- Repository Guard: success
- Canonical Verification: success, including packaged Windows verification
- Review result: READY
- Result: accepted on explicit owner `Advance LaserX` on 2026-08-08

The user now remains on **Set physical details** through role/material/thickness edits and advances only through explicit guided confirmation after validation.

## Active G4 contract — grouped repair decisions and Fix safe problems

G4 must:

- group current findings into **Safe to fix**, **Suggested fix**, and **Needs your decision** with truthful affected scope/counts;
- limit deterministic safe eligibility to exact duplicate geometry, zero-length entities, redundant collinear points, and eligible near-closures within an explicit approved tolerance;
- make **Fix safe problems** preview-first and non-mutating until acceptance;
- refuse stale proposals if their document/finding basis changes;
- apply accepted safe repairs as one coherent undoable transaction whenever technically practical and report fixed/skipped/remaining counts;
- re-run current analysis after acceptance and preserve unresolved suggested/decision findings;
- never claim safe repair proves cut readiness or physical safety;
- never silently apply suggested fixes, bridge/island decisions, ambiguous near-closures, or unproven safe classes;
- reuse authoritative geometry/history/cutability and the accepted guided resolution checkpoint;
- preserve exact-project resume, run tokens, project replacement, contextual controls, security, Save/Export, and Exit guidance;
- add unit/integration plus packaged Windows evidence for preview non-mutation, safe/ambiguous separation, accept/reject/undo, grouped large-finding presentation, reanalysis, stale-proposal refusal, and non-trapping recovery;
- open one focused draft PR and stop `AWAITING_REVIEW`.

## G4 non-goals

No G5 full Learn Mode/replay content, G6 owner-observed usability validation, broad geometry-engine rewrite, speculative safe classifications, new AI capability, material-catalog expansion, process profiles, export profiles, licensing, public beta, analytics platform, general-purpose CAD, CAM, machine control, or native DWG support.

## Milestone acceptance tests

1. Clean first launch presents the three goal paths.
2. Create My First Sign completes through real physical/cutability/3D/export outcomes.
3. SVG/DXF import stays isolated from raster trace controls.
4. PNG/JPEG exposes preprocessing/trace only after raster selection.
5. Large finding sets become understandable grouped repair decisions.
6. **Fix safe problems** is preview-first, deterministic, undoable, and truthfully reported.
7. Ambiguous findings remain user decisions.
8. Optional AI remains optional and non-blocking.
9. Guidance can be exited and cannot permanently trap the user.
10. G6 closes accessibility and owner-observed usability evidence.

## Exit checklist

- [x] Tutorial architecture and state boundaries are documented.
- [x] Workflow-aware contextual-control architecture is documented.
- [x] Create My First Sign guided vertical slice passes.
- [x] Vector-import and raster-trace guided paths pass, including PR #74 physical-confirmation repair.
- [ ] Grouped repair confidence and **Fix safe problems** preview/accept/undo behavior pass.
- [ ] Large finding sets reduce to understandable repair decisions.
- [ ] Learn Mode covers core manufacturing and repair concepts.
- [ ] Skip/replay/resume/recovery pass across the integrated product.
- [ ] Accessibility and packaged Windows evidence pass.
- [ ] Owner-observed first-session evidence is recorded.
- [ ] Status advances to M16 only after exact-head audit, merge, issue closure, and owner approval.

## Explicitly excluded

No broad material expansion, new process profiles, export-profile system, new AI provider capability, licensing, public beta, analytics platform, general-purpose CAD, CAM, machine control, or native DWG support belongs in M15.
