# M15 — Guided Onboarding, Workflow-First UI, and Learn Mode

## Status

**Active.** The owner explicitly advanced LaserX to M15 on 2026-08-05 after M14 passed owner validation and the final closure audit.

Active issue: #45.

Current slice: **G4 — grouped repair decisions and Fix safe problems workflow**.

G0 is accepted through PR #67, the governance/CI prerequisite through PR #70, G1 through PR #71, G2 through PR #72, and G3 through PR #73 at squash merge `f2a54d732ec9ee661c921d421da08e2b83c01b14`.

## User-visible outcome

A first-time user opens LaserX, chooses a real goal, sees only the controls relevant to that goal, follows clear shop-language guidance, repairs the problems LaserX can safely fix, completes a usable sign, views it in 3D, and exports it without needing CAD knowledge or an external tutorial.

LaserX should feel simple and obvious despite the depth of the underlying geometry and manufacturing systems.

## Included

### Guided first-run paths

- **Create My First Sign**
- **Import My Own Design**
- **Describe What I Want With AI — Optional**

Guided steps highlight the exact control, explain what it does and why it matters, dim or hide unrelated areas, confirm real completion, and preserve orientation between screens.

### Workflow-first interface

- one clear primary action for the current step whenever practical;
- contextual controls rather than permanent walls of unrelated tools;
- progressive disclosure for advanced and uncommon settings;
- SVG/DXF import never presents raster trace controls;
- raster preprocessing/trace appears only after a raster source is selected;
- physical 3D hides editing/import tools and concentrates on the finished physical object;
- export concentrates on target, scale, included content, warnings, destination, and one clear export action.

### Guided repair and broken-file recovery

Vector import and manufacturing review must not dump hundreds or thousands of raw findings into the main interface. LaserX groups current repair decisions into:

1. **Safe to fix**
2. **Suggested fix**
3. **Needs your decision**

The main repair workflow includes a prominent **Fix safe problems** action that previews deterministic eligible repairs, leaves authoritative geometry unchanged until accepted, applies accepted batch repairs as one undoable transaction whenever technically practical, reports fixed/skipped/remaining counts, preserves reject/undo, re-runs analysis, and never claims automated repair proves cut readiness or physical safety.

Safe eligibility requires deterministic rules and regression tests. Initial safe classes are limited to exact duplicate geometry, zero-length entities, redundant collinear points, and eligible near-closures only within an explicit approved tolerance. Any additional class requires evidence before being labeled safe.

### Learn Mode and recovery

- reusable tutorial state separate from feature logic;
- skip, replay, resume, and Help/Learn access;
- deterministic non-AI sign creation as the default path;
- AI path hidden or clearly optional when no provider is connected;
- progress and recovery behavior that cannot corrupt the project or trap the user.

## Approved implementation gates

1. **G0 — guided-workflow architecture and first-run contract** — merged and accepted.
2. **G1 — first-launch goal chooser and resumable guidance shell** — merged and accepted.
3. **G2 — Create My First Sign guided vertical slice** — merged and accepted.
4. **G3 — vector import and raster trace contextual guidance** — merged and accepted.
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

PR #71 implemented the clean first-launch chooser, atomic onboarding preferences, resumable exact-project guidance, contextual shell visibility, native-menu gating, project-replacement invalidation, and packaged recovery coverage.

- Reviewed head: `ae7c4e79509611a0704649d9c667886a98bcdcbd`
- Squash merge: `41e572a017a82f66f9586ab6e34253d914bc31e2`
- Exact-head Repository Guard: success
- Exact-head Canonical Verification: success, including packaged Windows verification
- Result: accepted after READY review and explicit owner `Advance LaserX`

### G2

PR #72 completed **Create My First Sign** as a truthful deterministic vertical slice through existing LaserX features.

- Reviewed head: `9da334207d29da27948863bb95f21155737f65b8`
- Squash merge: `c9a834a811db831207da6ca695ee8c46d6a88ca4`
- Exact-head Repository Guard: success
- Exact-head Canonical Verification: success, including packaged Windows verification
- Result: accepted after READY review and explicit owner `Advance LaserX` on 2026-08-07

### G3

PR #73 completed **Import My Own Design** as a source-aware guided workflow over the existing SVG/DXF and PNG/JPEG systems.

- Reviewed head: `4df406869bf23c175069b9b93dda9d97b5cb8cab`
- Squash merge: `f2a54d732ec9ee661c921d421da08e2b83c01b14`
- Exact-head Repository Guard: success
- Exact-head Canonical Verification: success, including packaged Windows verification
- Result: accepted after READY review and explicit owner `Advance LaserX` on 2026-08-07
- Proven outcomes: generic source selection, source-specific vector/raster isolation, real units/fit and real raster tracing, non-destructive cancel/reject, transient resume to source selection, accepted editable geometry, physical assignment, whole-design analysis, required physical 3D, Save/Save As, successful export, and guided evidence invalidation when manufacturing-layer state changes.

ADR 0027 remains binding for the goals, linear step definitions, contextual-control matrix, skip/back/resume/replay/cancel/failure semantics, run identity, project replacement, transient recovery, resolution checkpoint behavior, persistence shape, and non-mutation boundary.

## Active G4 contract — grouped repair decisions and Fix safe problems workflow

G4 makes repair understandable and safe at scale. Large finding sets become a small number of decision categories, while geometry changes remain explicit, previewable, undoable, and mechanically bounded.

### Required journey

1. **Summarize current findings**
   - Group current repair/manufacturing findings into **Safe to fix**, **Suggested fix**, and **Needs your decision**.
   - Show counts and affected scope clearly enough that the user does not have to scan an entity-level wall.
   - Preserve the current authoritative finding data; grouping is presentation/decision structure, not a second analysis truth.

2. **Classify safe repairs deterministically**
   - Initial safe classes are limited to exact duplicate geometry, zero-length entities, redundant collinear points, and eligible near-closures only within an explicit approved tolerance.
   - Each safe class requires focused regression evidence.
   - Suggested/decision classes remain non-automatic. No bridge/island or ambiguous repair becomes safe merely because it is convenient.

3. **Preview Fix safe problems**
   - The prominent action builds a deterministic proposal from the current document/finding set.
   - Preview must not mutate authoritative geometry, dirty state, history, save/export output, or current analysis truth.
   - Stale proposals fail closed if the document/finding basis changes before acceptance.

4. **Accept or reject the safe batch**
   - Accept applies the eligible batch as one coherent undoable transaction whenever technically practical.
   - Reject leaves the document unchanged.
   - Report fixed, skipped, and remaining counts truthfully.
   - Preserve undo and reanalysis.

5. **Re-check the design**
   - Re-run current analysis after acceptance.
   - Remaining suggested/decision findings stay visible and navigable.
   - Never claim that automated repair proves cut readiness or physical safety.

### G4 integration rules

- Reuse existing geometry/history/cutability and guided-resolution systems.
- Do not create a parallel geometry model, hidden destructive edit path, or independent finding truth.
- Preserve G1–G3 exact-project resume, fresh run tokens, project-replacement invalidation, contextual controls, security boundaries, Save/Export semantics, and non-trapping Exit guidance.
- Safe-repair tolerances and eligibility are explicit product contracts, not implicit heuristics.
- Any new safe class beyond the initial set requires separate evidence before acceptance.

### G4 verification

Required evidence includes:

- focused unit tests for every initial safe class and representative non-safe/ambiguous cases;
- proof that preview is non-mutating and stale proposals are refused;
- proof that accepted repairs are undoable and reject is non-mutating;
- proof that fixed/skipped/remaining counts correspond to actual post-transaction state;
- proof that analysis is re-run and unresolved findings remain visible;
- packaged Windows E2E with a representative large-finding fixture showing grouped decisions rather than raw overload;
- packaged negative/non-trapping coverage for stale proposal, reject, or ambiguous decision behavior;
- exact-head Repository Guard and Canonical Verification;
- one focused draft PR that stops at `AWAITING_REVIEW`.

### G4 non-goals

No G5 full Learn Mode/replay content, G6 owner-observed usability validation, open-ended geometry-engine rewrite, speculative safe classes, new AI capability, material-catalog expansion, process profiles, export profiles, licensing, public beta, analytics platform, general-purpose CAD, CAM, machine control, or native DWG support.

## Milestone acceptance tests

1. A clean first launch presents the three clear goal paths without exposing a blank unexplained workspace as the only choice.
2. A user can complete a deterministic first sign through dimensions, content, material, cutability, physical 3D preview, save, and export.
3. SVG/DXF import shows scale, units, layers, findings, preview, and accept/cancel without exposing raster trace controls.
4. PNG/JPEG import shows preprocessing and trace controls only after raster input is selected.
5. A representative broken DXF with a large finding count is summarized into understandable repair decisions by G4.
6. **Fix safe problems** previews deterministic eligible repairs, changes nothing before acceptance, commits accepted repairs coherently with undo, and reports fixed/skipped/remaining counts.
7. Remaining ambiguous findings are navigable by grouped category in G4.
8. A user can import SVG or DXF, understand conversion/repair findings, assign physical information, preview, and export.
9. The optional AI path remains unavailable or clearly optional without breaking the normal product.
10. Tutorials can be skipped, replayed, resumed, and reopened by milestone completion.
11. Guidance never performs hidden destructive edits or bypasses existing validation.
12. Each primary workflow maintains one obvious next action and keeps unrelated tool categories hidden or subordinate.
13. Advanced controls remain discoverable without being permanently prominent.
14. Keyboard, high-DPI, focus, screen-reader labels, and non-color-only progress states pass by G6.
15. Packaged E2E proves users cannot become permanently trapped in tutorial or repair state.
16. Structured owner-observed usability sessions are recorded in G6.

## Exit checklist

- [x] Tutorial architecture and state boundaries are documented.
- [x] Workflow-aware contextual-control architecture is documented.
- [x] Create My First Sign guided vertical slice passes.
- [x] Vector-import and raster-trace guided paths pass.
- [x] SVG/DXF import does not expose irrelevant trace controls.
- [ ] Grouped repair confidence and **Fix safe problems** preview/accept/undo behavior pass.
- [ ] Large finding sets reduce to understandable repair decisions.
- [ ] Learn Mode covers the core manufacturing and repair concepts.
- [ ] Skip/replay/resume/recovery pass across the integrated product.
- [ ] Accessibility and packaged Windows evidence pass.
- [ ] Owner-observed first-session evidence is recorded.
- [ ] Status advances to M16 only after exact-head audit, merge, issue closure, and owner approval.

## Explicitly excluded

No broad material expansion, new process profiles, export-profile system, new AI provider capability, licensing, public beta, analytics platform, general-purpose CAD, CAM, machine control, or native DWG support belongs in M15.

M15 may add only the geometry-repair capability required to deliver the approved grouped safe/suggested/decision workflow in G4. It must not become an open-ended geometry-engine rewrite or silently broaden the definition of a safe repair.
