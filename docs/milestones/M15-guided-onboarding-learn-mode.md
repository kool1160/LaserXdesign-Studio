# M15 — Guided Onboarding, Workflow-First UI, and Learn Mode

## User-visible outcome

A first-time user opens LaserX, chooses a real goal, sees only the controls relevant to that goal, follows clear shop-language guidance, repairs the problems LaserX can safely fix, completes a usable sign, views it in 3D, and exports it without needing the owner, CAD knowledge, or an external tutorial.

LaserX should feel simple and obvious despite the depth of the underlying geometry and manufacturing systems.

## Activation gate

M15 remains blocked until M14 is reviewed, merged, closed, recorded complete, and explicitly advanced by the owner.

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

## Exit checklist

- [ ] Tutorial architecture and state boundaries are documented.
- [ ] Workflow-aware contextual-control architecture is documented.
- [ ] Create, vector-import, raster-trace, repair, 3D, export, and optional-AI guided paths pass.
- [ ] SVG/DXF import does not expose irrelevant trace controls.
- [ ] Grouped repair confidence and **Fix safe problems** preview/accept/undo behavior pass.
- [ ] Large finding sets reduce to understandable repair decisions.
- [ ] Learn Mode covers the core manufacturing and repair concepts.
- [ ] Skip/replay/resume/recovery pass.
- [ ] Accessibility and packaged Windows evidence pass.
- [ ] Owner-observed first-session evidence is recorded.
- [ ] Status advances to M16 only after exact-head audit, merge, issue closure, and owner approval.

## Explicitly excluded

No broad material expansion, new process profiles, export-profile system, new AI provider capability, licensing, public beta, analytics platform, general-purpose CAD, CAM, or machine control belongs in M15.

M15 may add only the geometry-repair capability required to deliver the approved grouped safe/suggested/decision workflow. It must not become an open-ended geometry-engine rewrite or silently broaden the definition of a safe repair.
