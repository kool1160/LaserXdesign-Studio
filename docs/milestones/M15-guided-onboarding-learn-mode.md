# M15 — Guided Onboarding, Workflow-First UI, and Learn Mode

## Status

**Active.** The owner explicitly advanced LaserX to M15 on 2026-08-05 after M14 passed owner validation and the final closure audit.

Active issue: #45.

Current slice: **G0 — guided-workflow architecture and first-run contract**.

## User-visible outcome

A first-time user opens LaserX, chooses a real goal, sees only the controls relevant to that goal, follows clear shop-language guidance, repairs the problems LaserX can safely fix, completes a usable sign, views it in 3D, and exports it without needing the owner, CAD knowledge, or an external tutorial.

LaserX should feel simple and obvious despite the depth of the underlying geometry and manufacturing systems.

## Owner-approved workflow-first operating amendment

`docs/milestones/M15-workflow-first-product-amendment.md` is binding on M15 G1-G6 after its reviewed merge.

The locked operating direction is:

- guided workflow is the default first-launch and task-oriented product experience;
- the complete editor remains available through a clear **Advanced Workspace** or **Exit Guidance** action;
- feature surfaces are isolated incrementally as the active slice needs them, with no one-shot `App.tsx` or whole-application rewrite;
- physical 3D is a required guided checkpoint before export unless a truthful unavailable/failure path is explicitly acknowledged;
- broken-file repair and **Fix safe problems** are flagship workflows rather than buried diagnostics;
- focused first-time-user observation occurs during G2, G3, and G4 instead of waiting until the end of the roadmap;
- G6 performs a minimum five-participant packaged first-session cohort, with at least four participants completing a documented primary workflow within ten minutes without direct coaching;
- M22 must review M15 evidence and prove later milestones did not reintroduce permanent tool walls, workflow drift, repair overload, or AI dependency.

This amendment does not alter the exact acceptance of active G0 / PR #67, activate G1, or authorize later-milestone implementation.

## Included

### Guided first-run paths

- **Create My First Sign**
- **Import My Own Design**
- **Describe What I Want With AI — Optional**

Guided steps highlight the exact control, explain what it does and why it matters, dim or hide unrelated areas, confirm completion, and preserve orientation between screens.

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

The main repair workflow includes a prominent **Fix safe problems** action that:

- summarizes the problem classes and counts it will repair;
- previews the before/after result;
- leaves authoritative geometry unchanged until accepted;
- applies accepted batch repairs as one undoable transaction whenever technically practical;
- reports fixed, skipped, and remaining findings separately;
- preserves a reject/undo path;
- never claims automated repair proves cut readiness or physical safety.

Safe eligibility requires deterministic rules and regression tests. Initial expected safe classes include exact duplicate geometry, zero-length entities, redundant collinear points, and eligible near-closures only within an explicit approved tolerance. Any additional class requires evidence before being labeled safe.

After safe repair, the user receives a useful summary such as:

> **1,899 safe problems fixed. Six decisions remain.**

Remaining ambiguous decisions are grouped and visually navigable one category or affected area at a time. Entity-level diagnostics remain available through Details for advanced users and support.

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

1. **G0 — guided-workflow architecture and first-run contract** — active.
2. **G1 — first-launch goal chooser and resumable guidance shell** — held.
3. **G2 — Create My First Sign guided vertical slice** — held.
4. **G3 — vector import and raster trace contextual guidance** — held.
5. **G4 — grouped repair decisions and Fix safe problems workflow** — held.
6. **G5 — Learn Mode, replay, recovery, and contextual explanations** — held.
7. **G6 — packaged accessibility and owner-observed first-session validation** — held.

Each gate requires exact-head review and explicit owner advancement before the next gate becomes active.

The detailed G1-G6 slice contracts, early observation checkpoints, five-participant G6 cohort, incremental extraction rule, mandatory guided 3D checkpoint, and M22 carry-forward requirements are defined in `docs/milestones/M15-workflow-first-product-amendment.md`.

## Active G0 contract

G0 is architecture and contract lock only. It must establish one coherent guided-workflow system before visible onboarding is implemented in separate screens.

Required outcome:

- inspect the packaged application and inventory the current first-launch, empty-state, create, vector-import, raster-trace, repair, 3D, save, and export flows;
- document where unrelated controls, unclear next actions, or technical language compete with the user's goal;
- define a tutorial/guidance state machine separated from feature logic and authoritative project state;
- lock the three first-run goal contracts;
- define a contextual-control matrix for every primary workflow;
- define one clear primary action per guided step whenever practical;
- define skip, back, resume, replay, cancel, failure, and recovery behavior that cannot trap the user;
- define local/privacy-respecting evidence and the owner-observed ten-minute fixture set;
- define keyboard, focus, high-DPI, reduced-motion, screen-reader, and non-color-only guidance requirements;
- record the architecture in an ADR and add mechanical checks where they genuinely prevent drift;
- make only the smallest implementation or harness change needed to prove the boundary;
- open one focused draft PR and stop at `AWAITING_REVIEW`.

G0 does not implement the complete first-launch shell, tutorial content, grouped repair engine, broad visual redesign, material expansion, process profiles, export profiles, new AI capability, licensing, public beta, or M16 work.

## Acceptance tests

1. A clean first launch presents the three clear goal paths without exposing a blank unexplained workspace as the only choice.
2. A user can complete a deterministic first sign through dimensions, text, material, cutability, physical 3D preview, save, and export.
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
17. Guided workflow is the default experience while Advanced Workspace and Exit Guidance remain directly available.
18. The guided path reaches a confirmed physical 3D checkpoint before export, or records a truthful acknowledged unavailable path.
19. G2, G3, and G4 record focused first-time-user observation evidence before advancement.
20. G6 records at least five first-time participants and at least four successful ten-minute primary workflows without direct coaching.
21. Feature-surface extraction remains incremental and does not become a broad one-shot application rewrite.

## Exit checklist

- [ ] Tutorial architecture and state boundaries are documented.
- [ ] Workflow-aware contextual-control architecture is documented.
- [ ] Guided workflow is the default experience and Advanced Workspace / Exit Guidance remain available.
- [ ] Incremental feature-surface extraction is complete for the M15 paths without a broad application rewrite.
- [ ] Create, vector-import, raster-trace, repair, 3D, export, and optional-AI guided paths pass.
- [ ] SVG/DXF import does not expose irrelevant trace controls.
- [ ] Grouped repair confidence and **Fix safe problems** preview/accept/undo behavior pass.
- [ ] Large finding sets reduce to understandable repair decisions.
- [ ] The guided create, import, and AI paths reach 3D before export or record a truthful unavailable route.
- [ ] Learn Mode covers the core manufacturing and repair concepts.
- [ ] Skip/replay/resume/recovery pass.
- [ ] G2, G3, and G4 early observation evidence is recorded and blocking findings are repaired.
- [ ] Accessibility and packaged Windows evidence pass.
- [ ] The five-participant G6 first-session cohort and ten-minute success evidence are recorded.
- [ ] Owner-observed first-session evidence is accepted.
- [ ] Status advances to M16 only after exact-head audit, merge, issue closure, and owner approval.

## Explicitly excluded

No broad material expansion, new process profiles, export-profile system, new AI provider capability, licensing, public beta, analytics platform, general-purpose CAD, CAM, or machine control belongs in M15.

M15 may add only the geometry-repair capability required to deliver the approved grouped safe/suggested/decision workflow. It must not become an open-ended geometry-engine rewrite or silently broaden the definition of a safe repair.
