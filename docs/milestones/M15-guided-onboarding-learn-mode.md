# M15 — Guided Onboarding, Workflow-First UI, and Learn Mode

## Status

**Active.** The owner explicitly advanced LaserX to M15 on 2026-08-05 after M14 passed owner validation and the final closure audit.

Active issue: #45.

Current slice: **G3 — vector import and raster trace contextual guidance**.

G0 is accepted through PR #67, the governance/CI prerequisite through PR #70, G1 through PR #71, and G2 through PR #72 at squash merge `c9a834a811db831207da6ca695ee8c46d6a88ca4`.

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

Vector import and manufacturing review must not dump hundreds or thousands of raw findings into the main interface. G4 owns grouped repair categories and **Fix safe problems**; G3 must not pre-implement them.

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
4. **G3 — vector import and raster trace contextual guidance** — **active**.
5. **G4 — grouped repair decisions and Fix safe problems workflow** — held.
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
- Proven outcomes: real size/material, physical-layer content, whole-design cutability evidence, ADR 0027 resolution rules, required rendered/unavailable physical 3D route, Save/Save As, and successful SVG/DXF export.

ADR 0027 remains binding for the goals, linear step definitions, contextual-control matrix, skip/back/resume/replay/cancel/failure semantics, run identity, project replacement, transient recovery, resolution checkpoint behavior, persistence shape, and non-mutation boundary.

## Active G3 contract — vector import and raster trace contextual guidance

G3 completes the **Import My Own Design** guided path using the real source-specific import systems. One stable source-preparation checkpoint may present different vector or raster controls based on live selected-file state, consistent with ADR 0027; guidance identity does not fork merely because the file type changes.

### Required journey

1. **Choose the source**
   - Start from **Import My Own Design** in the accepted chooser.
   - Before file selection, present a generic bring-in-a-file action. Do not expose raster trace controls before a raster source is known.

2. **Prepare and commit the source**
   - **SVG/DXF:** use the existing vector-import preview and commit path, including source units, scale/fit, proposed document size, layers, warnings/findings, preview, accept, and cancel. Raster trace controls stay hidden.
   - **PNG/JPEG:** expose the existing preprocessing and trace controls only after raster selection. Use the existing raster preview/commit path and require accepted editable geometry before advancing.
   - Accept/commit advances. Cancel/reject returns to source selection without claiming completion.
   - Vector/raster preview state is transient. Resume from an interrupted preview returns to source selection rather than reopening vanished transient state.

3. **Physical setup and cutability**
   - Once editable geometry is committed, reuse existing physical-layer material/thickness assignment.
   - Run whole-design cutability against the exact current document; stale, selection-only, or layer-only evidence must not satisfy the guided checkpoint.
   - Preserve ADR 0027 resolution behavior. Do not add G4 safe-fix classification, grouped repair, or batch repair.

4. **3D and export**
   - Require the existing physical 3D preview or its truthful explicit unavailable/failure route.
   - Use existing Save/Save As and SVG/DXF export.
   - Complete the import goal only after a real successful export.

### G3 integration rules

- Reuse authoritative import/raster, project, geometry, cutability, physical-preview, save, and export systems.
- Do not create parallel preview, geometry, or project truth inside guidance.
- Preserve undo/history and existing accept/cancel semantics.
- Preserve G1/G2 exact-project resume, fresh run tokens, project-replacement invalidation, contextual controls, security boundaries, and non-trapping Exit guidance.
- Native DWG remains out of scope.

### G3 verification

Required evidence includes:

- unit/integration tests for source classification, transient recovery, truthful commit/cancel progression, and stale evidence refusal;
- packaged Windows E2E for at least one SVG/DXF import and one PNG/JPEG trace path;
- packaged proof that SVG/DXF does not expose trace controls and that trace controls appear only after raster selection;
- at least one cancel/reject or stale-preview recovery case proving the user is not trapped and authoritative geometry is not falsely committed;
- exact-head Repository Guard and Canonical Verification;
- one focused draft PR that stops at `AWAITING_REVIEW`.

### G3 non-goals

No G4 grouped repair/**Fix safe problems**, G5 full Learn Mode/replay content, G6 owner-observed usability validation, new AI capability, material-catalog expansion, process profiles, export profiles, licensing, public beta, analytics platform, general-purpose CAD, CAM, machine control, or native DWG support.

## Milestone acceptance tests

1. A clean first launch presents the three clear goal paths without exposing a blank unexplained workspace as the only choice.
2. A user can complete a deterministic first sign through dimensions, content, material, cutability, physical 3D preview, save, and export.
3. SVG/DXF import shows scale, units, layers, findings, preview, and accept/cancel without exposing raster trace controls.
4. PNG/JPEG import shows preprocessing and trace controls only after raster input is selected.
5. A representative broken DXF with a large finding count is summarized into understandable repair decisions by G4.
6. **Fix safe problems** behavior is proven in G4.
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
- [ ] Vector-import and raster-trace guided paths pass.
- [ ] SVG/DXF import does not expose irrelevant trace controls.
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
