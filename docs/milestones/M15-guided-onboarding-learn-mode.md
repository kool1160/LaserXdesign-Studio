# M15 — Guided Onboarding, Workflow-First UI, and Learn Mode

## Status

**Active.** The owner explicitly advanced LaserX to M15 on 2026-08-05 after M14 passed owner validation and the final closure audit.

Active issue: #45.

Current slice: **G2 — Create My First Sign guided vertical slice**.

G0 architecture/contract work is accepted and merged through PR #67. The G1 governance/CI prerequisite is accepted and merged through PR #70. The G1 first-launch/resumable guidance shell is accepted through PR #71 at `41e572a017a82f66f9586ab6e34253d914bc31e2` after the owner explicitly resolved the post-merge acceptance hold with `Advance LaserX` in the designated primary operations chat on 2026-08-07.

## User-visible outcome

A first-time user opens LaserX, chooses a real goal, sees only the controls relevant to that goal, follows clear shop-language guidance, repairs the problems LaserX can safely fix, completes a usable sign, views it in 3D, and exports it without needing the owner, CAD knowledge, or an external tutorial.

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
- advanced actions remain discoverable through contextual inspectors, menus, More/Advanced surfaces, or command search;
- empty states explain the next useful action rather than presenting an unexplained blank professional workspace;
- create, vector import, raster trace, repair, 3D, and export each present only the controls relevant to that workflow by default;
- SVG/DXF import never presents raster trace controls;
- raster import presents trace controls only after a raster source is selected;
- physical 3D hides editing/import tools and concentrates on the finished physical object;
- export concentrates on target, scale, included content, warnings, destination, and one clear export action.

The interaction philosophy is Apple-like without copying Apple visual assets or operating-system controls: strong defaults, calm hierarchy, restrained visual noise, and advanced capability that is available without dominating the screen.

### Guided repair and broken-file recovery

Vector import and manufacturing review must not dump hundreds or thousands of raw findings into the main interface.

LaserX groups findings by problem class, affected scope, repair confidence, and required user decision:

1. **Safe to fix**
2. **Suggested fix**
3. **Needs your decision**

The main repair workflow includes a prominent **Fix safe problems** action that previews deterministic eligible repairs, leaves authoritative geometry unchanged until accepted, applies accepted batch repairs as one undoable transaction whenever technically practical, reports fixed/skipped/remaining counts, preserves reject/undo, and never claims automated repair proves cut readiness or physical safety.

Safe eligibility requires deterministic rules and regression tests. Initial expected safe classes include exact duplicate geometry, zero-length entities, redundant collinear points, and eligible near-closures only within an explicit approved tolerance. Any additional class requires evidence before being labeled safe.

### Learn Mode and recovery

- a reusable tutorial state machine separated from feature logic;
- skip, replay, resume, and Help/Learn access;
- plain shop-language explanations for layers, bridges, islands, cutability, materials, thickness, repair confidence, 3D preview, and export;
- deterministic non-AI sign creation as the default path;
- AI path hidden or clearly optional when no provider is connected;
- sample projects that teach real workflows rather than disconnected slides;
- progress and recovery behavior that cannot corrupt the project or trap the user;
- measurable first-session instrumentation that is local/privacy-respecting unless a later explicit opt-in design is accepted.

## Approved implementation gates

1. **G0 — guided-workflow architecture and first-run contract** — merged and accepted.
2. **G1 — first-launch goal chooser and resumable guidance shell** — merged and accepted.
3. **G2 — Create My First Sign guided vertical slice** — **active**.
4. **G3 — vector import and raster trace contextual guidance** — held.
5. **G4 — grouped repair decisions and Fix safe problems workflow** — held.
6. **G5 — Learn Mode, replay, recovery, and contextual explanations** — held.
7. **G6 — packaged accessibility and owner-observed first-session validation** — held.

Each gate requires exact-head review and explicit owner advancement before the next gate becomes active. A merge alone does not advance a gate.

## Completion records

### G0

G0 locked the architecture and first-run contract in ADR 0027 and implemented the pure guided-workflow state machine without visible onboarding UI. PR #67 was accepted and merged at `90946f7db42ac2cc2be3532bf49bdcdfe0d885ed`.

### G1 prerequisite

PR #70 normalized Codex-only execution, primary-chat write authority, and required CI. It was accepted and merged at `84a3ffad4973ed8830c1e9fc2e1f026183a1a30c`.

### G1

PR #71 implemented the clean first-launch three-goal chooser, atomic onboarding preferences, resumable/exact-project guidance, contextual shell visibility, native-menu gating, project-replacement invalidation, and packaged recovery coverage.

- Reviewed head: `ae7c4e79509611a0704649d9c667886a98bcdcbd`
- Squash merge: `41e572a017a82f66f9586ab6e34253d914bc31e2`
- Exact-head Repository Guard: success
- Exact-head Canonical Verification: success, including packaged Windows verification
- Result: accepted after READY review and explicit owner `Advance LaserX` in the designated primary operations chat on 2026-08-07
- Governance note: the explicit owner command resolved the post-merge owner-acceptance hold; earlier premature G2 activation records remain superseded.

ADR 0027 remains binding for the three goals, linear step definitions, contextual-control matrix, skip/back/resume/replay/cancel/failure semantics, run identity, project replacement, transient recovery, resolution checkpoint behavior, persistence shape, and non-mutation boundary.

## Active G2 contract — Create My First Sign guided vertical slice

G2 proves one complete deterministic user journey through real LaserX features. The guidance layer must coordinate and observe existing authoritative behavior; it must never create a parallel project model or treat a button press as proof that the underlying product outcome succeeded.

### Required journey

1. **Start**
   - Begin from **Create My First Sign** in the G1 chooser.
   - Preserve current run token, resume, Back, Exit guidance, project-replacement, and contextual-control behavior.

2. **Choose size and material**
   - Use the existing document/stock-size path and existing manufacturing material/thickness state.
   - The step completes only when real authoritative state satisfies the requirement.
   - Do not add a material-catalog expansion in G2.

3. **Add the sign content**
   - Reuse existing Create, Text, and Sign capabilities.
   - The step completes only after at least one real document object exists.
   - No hidden geometry creation or duplicate editor state.

4. **Check the design**
   - Run the existing cutability analysis.
   - Only a current analysis matching the exact document may satisfy the checkpoint.
   - Stale analysis must not unlock progression.

5. **Resolve findings**
   - Keep the ADR 0027 resolution checkpoint.
   - Auto-complete unseen only when `shouldAutoCompleteResolution` is true — nothing actionable remains.
   - User Continue is allowed only when `canCompleteResolution` permits it — no blocking findings remain.
   - G2 must not invent G4's safe-fix classifier, grouped-repair engine, batch repair, or **Fix safe problems** implementation.

6. **Review the 3D result**
   - Use the existing physical 3D preview system.
   - The checkpoint completes only after a real rendered preview or a truthful explicit unavailable/failure state defined by the existing system.
   - The 3D checkpoint remains required and non-skippable.

7. **Save and export**
   - Use existing Save/Save As and SVG/DXF export behavior.
   - Expose actual export success/failure.
   - Mark the `create-first-sign` goal completed only after a real successful export.

### G2 integration rules

- Step progression must be tied to actual feature outcomes/state transitions. A generic Continue action must not falsely claim a required product action happened.
- Existing security, IPC validation, geometry, units, undo/history, cutability, physical-preview, save, and export boundaries remain authoritative.
- No hidden destructive edits.
- No bypass of existing validation.
- No change to native project/file semantics merely for tutorial convenience.
- Save remains available when a document exists; Exit guidance remains globally reachable.
- Resume must remain exact-project/document/fingerprint aware.
- A true project replacement ends guidance before replacement state is observable to queued guidance work.

### G2 verification

Required evidence includes:

- focused unit/integration tests for truthful completion signals and stale-state refusal;
- packaged Windows E2E from clean first launch through a deterministic first sign, size/material, content, cutability, resolution, physical 3D, save/export, and completed guidance;
- at least one packaged negative/non-trapping test proving a required checkpoint cannot be falsely advanced;
- exact-head Repository Guard and Canonical Verification;
- one focused draft PR that stops at `AWAITING_REVIEW`.

### G2 non-goals

No G3 vector/raster guided integration, G4 grouped repair/**Fix safe problems**, G5 full Learn Mode/replay content, G6 owner-observed usability validation, new AI capability, material-catalog expansion, process profiles, export profiles, licensing, public beta, analytics, CAD/CAM, or machine control.

## Milestone acceptance tests

1. A clean first launch presents the three clear goal paths without exposing a blank unexplained workspace as the only choice.
2. A user can complete a deterministic first sign through dimensions, text/content, material, cutability, physical 3D preview, save, and export.
3. SVG/DXF import shows scale, units, layers, grouped conversion/repair findings, preview, and accept/cancel without exposing raster trace controls.
4. PNG/JPEG import shows preprocessing and trace controls only after raster input is selected.
5. A representative broken DXF with a large finding count is summarized into a small number of repair categories rather than an unstructured entity-level list.
6. **Fix safe problems** previews deterministic eligible repairs, changes nothing before acceptance, commits accepted repairs as one undoable action when practical, and reports fixed/skipped/remaining counts.
7. Remaining ambiguous findings are navigable by grouped category and affected geometry without requiring the user to scan thousands of raw messages.
8. A user can import SVG or DXF, understand conversion/repair findings, assign physical information, preview, and export.
9. The optional AI path remains unavailable or clearly optional without breaking the normal product.
10. Tutorials can be skipped, replayed, resumed, and reopened.
11. Guidance never performs hidden destructive edits or bypasses existing validation.
12. Each primary workflow maintains one obvious next action and keeps unrelated tool categories hidden or visually subordinate.
13. Advanced controls remain discoverable without being permanently prominent.
14. Keyboard, high-DPI, focus, screen-reader labels, and non-color-only progress states pass.
15. Packaged E2E proves users cannot become permanently trapped in tutorial or repair state.
16. Structured owner-observed usability sessions show the primary workflow can be completed within ten minutes on the documented fixture set.

## Exit checklist

- [x] Tutorial architecture and state boundaries are documented.
- [x] Workflow-aware contextual-control architecture is documented.
- [ ] Create, vector-import, raster-trace, repair, 3D, export, and optional-AI guided paths pass.
- [ ] SVG/DXF import does not expose irrelevant trace controls.
- [ ] Grouped repair confidence and **Fix safe problems** preview/accept/undo behavior pass.
- [ ] Large finding sets reduce to understandable repair decisions.
- [ ] Learn Mode covers the core manufacturing and repair concepts.
- [ ] Skip/replay/resume/recovery pass in the integrated product.
- [ ] Accessibility and packaged Windows evidence pass.
- [ ] Owner-observed first-session evidence is recorded.
- [ ] Status advances to M16 only after exact-head audit, merge, issue closure, and owner approval.

## Explicitly excluded

No broad material expansion, new process profiles, export-profile system, new AI provider capability, licensing, public beta, analytics platform, general-purpose CAD, CAM, or machine control belongs in M15.

M15 may add only the geometry-repair capability required to deliver the approved grouped safe/suggested/decision workflow. It must not become an open-ended geometry-engine rewrite or silently broaden the definition of a safe repair.
