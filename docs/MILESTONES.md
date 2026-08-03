# Milestone Index

Milestones are large, testable delivery gates. The active milestone is controlled by `docs/status/CURRENT.md`. Each milestone must leave a usable vertical slice and must pass its exit criteria before later work begins.

> **Mandatory post-milestone planning context:** GitHub Issue #37 is the canonical owner direction for guided onboarding and Learn Mode, broader materials, AI-first creation, downstream flat-cut workflows, and community beta planning. It predates the isolated R&D streams and must be reviewed before interpreting, proposing, or sequencing work beyond the active milestone. It does not activate a future gate or authorize experiment merges.

| ID | Name | User-visible result |
|---|---|---|
| M00 | Foundation | Codex-ready repository, architecture, policies, and CI guardrails |
| M01 | Desktop shell | Launchable Windows desktop app with new/open/save/recovery skeleton |
| M02 | Document and viewport | Exact-size document rendered with pan, zoom, rulers, grid, and units |
| M03 | Editing core | Select, transform, group, layer, undo, and redo real objects |
| M04 | Text and fonts | Browse fonts, edit text, control spacing, and convert text to paths |
| M05 | Geometry editing | Node editing, joins, splits, booleans, offsets, and contour repair |
| M06 | SVG and DXF | Dimensionally correct import/export with golden round-trip fixtures |
| M07 | Raster tracing | PNG/JPEG preprocessing, tracing, smoothing, and editable path output |
| M08 | Cutability | Detect islands and bad geometry, add bridges, preview retained metal |
| M09 | Sign tools | Borders, holes, backing plates, templates, arcs, and sign helpers |
| M10 | AI generation | Prompt/image concepts converted to editable validated designs |
| M11 | UI, branding, and product polish | Website-aligned identity, clearer workflows, accessibility, and commercial desktop finish |
| M12 | Layered production | Explicit manufacturing-layer separation, assembly preview, and organized export packages |
| M13 | Windows installer and beta hardening | Signed installer, shortcuts, clean uninstall, versioned beta releases, recovery, performance, and release gates |
| M14 | Beta validation and Version 1.0 release | Real-job beta validation, release-defect closure, final documentation, and signed Version 1.0 publication |
| M15 | Machine platform foundation | Simulator-first machine profiles, privileged host, deterministic job plans, safety states, and future controller boundaries |
| M16 | First LaserX controller vertical slice | One explicitly approved controller, machine, and process validated through dry run, hardware-in-the-loop safety tests, and one supervised job |

Detailed scope and exit criteria live in `docs/milestones/Mxx-*.md`.

## Post-milestone planning boundary

When the owner opens the next planning boundary, Issue #37 must be evaluated alongside the completed milestone record and accepted research. The future sequence must compare, rather than automatically combine:

- production integration of the physical 3D preview;
- guided onboarding and Learn Mode;
- acrylic, wood, MDF, plywood, and mixed-material expansion;
- process-aware manufacturability profiles;
- AI idea-to-manufacturable-design onboarding;
- community beta distribution and real-user usability testing;
- broader flat-cut market launch preparation.

Experiments reduce uncertainty; they do not establish implementation priority, activate a milestone, or bypass owner approval.
