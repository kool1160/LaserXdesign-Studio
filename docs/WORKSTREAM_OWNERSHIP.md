# LaserX Design Studio Workstream Ownership

## Status and authority

This document records an explicit owner directive dated **2026-08-02**.

It supplements `AGENTS.md`, `docs/OPERATOR_PROTOCOL.md`, and
`docs/status/CURRENT.md`. It does not activate a blocked milestone or weaken any
milestone acceptance gate.

When an agent, planning chat, or review chat begins work, it must read this file
before assigning implementation ownership.

## Current delivery gate

**M13 — Windows installer, packaging, and beta hardening** remains the active
product milestone under GitHub Issue #13.

M14 is blocked until every M13 exit condition is satisfied, M13 is reviewed and
merged on its exact final head, Issue #13 is closed, and the owner explicitly
advances the project.

## Codex stop boundary

Codex owns completion and repair of the active M13 delivery gate.

After M13 is completed and merged, Codex must stop in
`OWNER_HANDOFF_REQUIRED` state.

Codex must not, without a new explicit owner authorization:

- begin M14 or any later milestone;
- create an M14 implementation branch or worktree;
- duplicate Claude's physical 3D preview research or implementation;
- add Three.js, React Three Fiber, RepliCAD, OpenCascade.js, JSCAD, or another
  3D/CAD dependency to the production application;
- merge or cherry-pick the experimental 3D branch into `main`;
- reinterpret `Continue LaserX` as permission to start M14 after M13.

A planning or orchestration chat must not automatically hand M14 to Codex merely
because M13 has closed. It must report that the Codex stop boundary has been
reached and request or read the owner's next direction.

## Claude physical 3D workstream

Claude is the designated lead for the **physical 3D sign-preview workstream**.

The approved product boundary is the physical preview defined by:

- GitHub Issue #30 — M14 beta validation and Version 1.0 release;
- `docs/milestones/M14-beta-validation-v1-release.md`;
- GitHub Issue #34 — parallel physical 3D sign-preview research.

Claude's current authority is **parallel research only** on:

`experiment/m14-physical-3d-preview-lab`

The research worktree and branch must remain isolated from active M13 work.
Nothing on the experiment branch is product-ready or merge-authorized merely
because it runs successfully.

Claude must understand the complete LaserX product and reuse the authoritative
contracts already present in the repository, including:

- editable 2D geometry;
- canonical millimeter units;
- physical manufacturing-layer metadata;
- material and stock designation metadata;
- exact normalized `thicknessMm`;
- contour and cutability evidence;
- SVG/DXF and production-package authority;
- project parsing and migration rules;
- Electron security and non-mutation boundaries.

Claude's write authority for this research is limited to:

- `apps/physical-3d-preview-lab/`;
- `packages/physical-preview-3d/`;
- `docs/experiments/m14-physical-3d-preview/`;
- `fixtures/physical-preview/`;
- the experiment branch's own tests and configuration required to run those
  isolated paths.

The root `CLAUDE.md` remains the repository-wide independent-audit charter. The
experiment-specific builder contract is located at:

`apps/physical-3d-preview-lab/CLAUDE.md`

## Technology direction

Claude must not build a custom 3D renderer or a general-purpose CAD kernel.

The default Phase 1 direction is:

- Three.js and React Three Fiber for rendering, cameras, interaction, lighting,
  materials, and screenshots;
- a pure renderer-independent LaserX-to-preview scene adapter in
  `packages/physical-preview-3d`;
- existing LaserX domain, geometry, project-format, cutability, and production
  contracts as authoritative input.

Claude must complete the engine decision and evidence before substantial
implementation. RepliCAD/OpenCascade.js, CascadeStudio/cascade-core, and JSCAD
may be benchmarked only where a visualization-first extrusion pipeline cannot
represent the approved preview truthfully.

A CAD kernel must not enter the production path without measured evidence,
architecture review, licensing review, bundle/startup evaluation, worker and
fallback design, and explicit owner approval.

## Approved physical-preview behavior

The research and later M14 implementation may prove or deliver:

- exact extrusion from canonical `thicknessMm`;
- material-aware appearance;
- single-layer and ordered multi-layer assemblies;
- visible through-holes and interior cutouts;
- orbit, pan, zoom, reset, front, back, edge, assembled, and exploded views;
- deterministic regeneration from an unchanged authoritative project snapshot;
- exact dimensions and assembled depth;
- visible failure for open, self-intersecting, ambiguous, unsupported, or
  nonphysical contours;
- safe GPU fallback or a clear unavailable state;
- keyboard, high-DPI, accessibility, performance, and screenshot evidence.

The preview remains read-only and non-mutating. Preview interaction must not
change:

- project geometry;
- dirty state;
- Undo/Redo history;
- selection or editor state;
- cutability evidence;
- SVG or DXF output;
- production-package output;
- native project persistence.

## Explicit exclusions

Neither the research branch nor M14 physical preview may implement:

- general-purpose 3D CAD;
- arbitrary solid or mesh editing;
- bends, welds, bevels, embossing, or machining features;
- STL, STEP, IGES, or 3MF manufacturing export;
- CAM, nesting, toolpaths, G-code, or machine control;
- a second authoritative document model;
- silent contour repair, closing, scaling, union, discard, or reinterpretation;
- schema changes invented solely for the experiment;
- M13 installer or release changes.

## Orchestration after M13

When M13 reaches a verified `READY` verdict, the planning/review assistant may
complete the normal M13 merge and status recording. It must then:

1. stop Codex;
2. report `OWNER_HANDOFF_REQUIRED`;
3. verify the live state of Issue #30, Issue #34, the experiment branch, and the
   latest Claude evidence;
4. ask the owner whether to activate M14 and whether Claude should proceed from
   research into product implementation;
5. avoid assigning M14 implementation to Codex unless the owner explicitly
   changes this directive.

If the owner activates M14 with Claude:

1. Claude first presents the engine decision, prototype evidence, known gaps,
   and integration recommendation;
2. the planning/review assistant audits that evidence;
3. accepted architecture is recorded through an ADR and M14 issue/status update;
4. Claude starts a fresh product implementation branch from the then-current
   `main`, or the experiment is rebased/promoted only through an explicitly
   reviewed plan;
5. the experiment branch is never merged wholesale merely because it exists.

## Durable GitHub locations

- Active M13 gate: Issue #13 and `docs/status/CURRENT.md`
- Future M14 gate: Issue #30 and
  `docs/milestones/M14-beta-validation-v1-release.md`
- Parallel Claude research: Issue #34
- Research branch: `experiment/m14-physical-3d-preview-lab`
- Research project brief:
  `docs/experiments/m14-physical-3d-preview/PROJECT_BRIEF.md`
- Engine decision:
  `docs/experiments/m14-physical-3d-preview/ENGINE_DECISION.md`
- Claude builder contract: `apps/physical-3d-preview-lab/CLAUDE.md`

## Planning-chat instruction

A planning or orchestrating chat receiving the instruction
**"Check GitHub for new LaserX direction"** must read, in order:

1. `AGENTS.md`;
2. `docs/OPERATOR_PROTOCOL.md`;
3. `docs/WORKSTREAM_OWNERSHIP.md`;
4. `docs/status/CURRENT.md`;
5. Issue #13;
6. Issue #30;
7. Issue #34.

It must then summarize the live active gate, Codex stop boundary, Claude
physical-preview ownership, experiment status, and next valid owner decision.
