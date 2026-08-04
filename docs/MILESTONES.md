# Milestone Index

Milestones are large, testable delivery gates. The active milestone is controlled by `docs/status/CURRENT.md`. Each milestone must leave a usable vertical result and pass its exit criteria before later work begins.

> **Mandatory planning context:** GitHub Issues #44 and #37 define the product direction for usability, deterministic sign creation, optional AI, physical 3D, broader materials, downstream workflows, pricing, trial, community beta, and market positioning. Experiments reduce uncertainty; they do not establish implementation priority or authorize wholesale merges.

| ID | Name | User-visible result |
|---|---|---|
| M00 | Foundation | Repository, architecture, policies, and CI guardrails |
| M01 | Desktop shell | Launchable Windows app with project lifecycle and recovery skeleton |
| M02 | Document and viewport | Exact-size document with pan, zoom, rulers, grid, and units |
| M03 | Editing core | Select, transform, group, layer, undo, and redo real objects |
| M04 | Text and fonts | Browse fonts, edit text, control spacing, and convert text to paths |
| M05 | Geometry editing | Node editing, joins, splits, booleans, offsets, and contour repair |
| M06 | SVG and DXF | Dimensionally correct import/export with round-trip fixtures |
| M07 | Raster tracing | PNG/JPEG preprocessing, tracing, smoothing, and editable path output |
| M08 | Cutability | Detect islands and bad geometry, add bridges, preview retained material |
| M09 | Sign tools | Borders, holes, backing plates, templates, arcs, and deterministic sign helpers |
| M10 | Optional AI generation | User-supplied AI concepts converted to editable validated designs |
| M11 | UI, branding, and product polish | Website-aligned identity, clearer workflows, accessibility, and commercial finish |
| M12 | Layered production | Physical-layer separation, assembly preview, and organized export packages |
| M13 | Windows installer and private beta hardening | Installable private beta with recovery, clean uninstall, packaging, and release gates |
| M14 | Production physical 3D preview integration | A finished sign becomes a truthful interactive physical object inside the desktop app |
| M15 | Guided onboarding, workflow-first UI, and Learn Mode | A first-time user sees only relevant controls, repairs safe problems, and finishes a usable sign without outside instruction |
| M16 | Material catalog and wood/acrylic expansion | Truthful material identity, nominal/measured thickness, and material-aware preview for broader maker workflows |
| M17 | Process-aware manufacturability profiles | Plasma, laser, router, waterjet, and other reviewed workflows receive bounded process-specific guidance without machine control |
| M18 | Downstream software export profiles | Deterministic target-aware handoff for LightBurn, plasma CAM, router, waterjet, fiber, and generic consumers |
| M19 | Optional AI idea-to-cuttable onboarding | The optional AI path turns a plain-language idea into editable, validated, manufacturable sign geometry |
| M20 | Licensing, trial, and purchase experience | A generous full-product trial and owner-approved affordable purchase model work without degrading the product |
| M21 | Community beta distribution readiness | Outside users can install, learn, report problems, and complete real projects through a controlled beta |
| M22 | Real-user usability validation and final interface polish | Real users prove the ten-minute workflow and the complete app receives its final simple, clean, workflow-aware refinement |
| M23 | Version 1.0 release and broader-market launch | LaserX ships as a supported, signed, documented, premium-feeling Version 1.0 product |
| M24 | Machine platform foundation | Simulator-first profiles, privileged host, deterministic job plans, and safety-state contracts |
| M25 | First LaserX controller vertical slice | One explicitly approved controller, machine, and process validated through HIL and one supervised job |

Detailed scope and exit criteria live in `docs/milestones/Mxx-*.md`.

## Sequencing rationale

The roadmap follows the product logic in Issue #44:

1. **M14 integrates physical 3D first** because the guided first-run experience is expected to end in truthful preview and export.
2. **M15 makes first-time usability, contextual controls, and guided repair a standalone gate**, not documentation buried inside release work. It implements the rule that LaserX presents the next useful decision rather than every possible tool.
3. **M16–M18 broaden physical truth and downstream usefulness** without turning LaserX into machine software.
4. **M19 strengthens the optional AI path** while preserving complete non-AI sign creation.
5. **M20–M21 establish commercial trial and controlled-beta readiness.**
6. **M22 uses real-user evidence to close usability blockers and performs the final app-wide interface polish pass** after the major Version 1 surfaces exist.
7. **M23 publishes Version 1.0** only after the workflow, repair experience, and complete interface have passed owner and independent review.
8. **M24–M25 preserve the owner’s future machine-platform path** after Version 1.0, behind explicit safety gates.

## Locked interaction direction

LaserX uses an Apple-like product philosophy without copying Apple branding or controls:

- simple, clean, calm, and restrained;
- one clear primary action for the current task;
- contextual tools instead of permanent button walls;
- advanced capability available through progressive disclosure;
- SVG/DXF import never shows raster trace controls;
- large finding sets become grouped repair decisions with a primary **Fix safe problems** action;
- ambiguous problems are walked one at a time rather than dumped as thousands of raw messages.

`docs/PRODUCT_REQUIREMENTS.md`, `docs/DESKTOP_DESIGN_SYSTEM.md`, M15, and M22 contain the enforceable requirements.

## Agent assignment

- Claude is the default implementation lead for the active milestone while the owner uses expanded Claude capacity and promotional credit.
- ChatGPT performs independent exact-head audits, posts findings to GitHub, and controls merge/advancement after owner command.
- Codex remains held unless the owner explicitly assigns a task.

Capacity never overrides milestone order, issue scope, acceptance criteria, or owner approval.
