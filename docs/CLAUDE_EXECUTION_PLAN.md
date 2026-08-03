# Claude Execution Plan

## Purpose

Use the owner's temporary expanded Claude capacity and promotional credit to accelerate approved LaserX milestones without allowing temporary capacity to redefine product direction.

Issues #44 and #37 determine what matters. `docs/status/CURRENT.md` determines what is active. This document determines how Claude and ChatGPT divide the work.

## Role split

### Claude

Claude is the implementation lead for the active milestone.

Claude receives one bounded slice at a time and must:

- work from current `main` on a fresh branch unless repairing an existing PR;
- use one active issue and one reviewable PR per slice;
- stay inside listed allowed paths and exclusions;
- add tests and evidence with the implementation;
- push exact-head CI evidence;
- stop at `AWAITING_REVIEW`, `REPAIRING`, or `BLOCKED`;
- never merge, close the milestone issue, or activate the next milestone.

### ChatGPT

ChatGPT is the independent planning and audit authority for now.

ChatGPT must:

- write accepted owner decisions into GitHub;
- define each Claude slice before implementation;
- inspect the exact PR head, diff, tests, CI, and review threads;
- post detailed findings on GitHub;
- return `READY`, `REPAIR`, or `BLOCKED`;
- merge and advance only after owner command and exact-head verification.

### Codex

Codex remains held unless the owner explicitly assigns a repair, comparison, or implementation task.

## Promotional-capacity rules

Use temporary Claude capacity for work that creates durable product value:

- active-milestone implementation;
- regression tests;
- difficult root-cause analysis;
- architecture work required by the active gate;
- exact evidence and documentation tied to shipped behavior.

Do not spend it on:

- duplicate research already accepted under Issues #34 or #42;
- speculative future infrastructure;
- broad repository cleanup unrelated to the active gate;
- rewriting stable packages without measured need;
- self-review presented as independent approval;
- large unsliced prompts such as `make LaserX production ready`.

## M14 Claude queue

M14 is implemented through bounded reviewed slices from fresh `main`. The accepted Issue #34 integration recommendation is the architectural basis; the experiment branch is never merged wholesale.

### Slice G0 — governance and architecture lock

- record the production physical-preview ADR;
- confirm production package boundaries;
- confirm no CAD kernel;
- confirm lazy-loading and privileged capture design;
- repair any repository prerequisite required for exact-head evidence;
- no user-facing 3D feature yet.

### Slice G1 — text-heavy scaling evidence

- add reviewed text-heavy and high-point-count fixtures;
- measure parse, scene, and Three-conversion behavior;
- decide whether a topology-only cutability entry point is justified;
- do not fork contour classification or add a second geometry truth.

### Slice G2 — pure physical scene package

- promote accepted renderer-independent scene and assembly logic into production;
- preserve exact thickness, physical-layer order, holes, cutouts, findings, determinism, and immutability;
- exclude experiment loaders, benchmark hooks, and bundled fixture payloads.

### Slice G3 — Three renderer adapter package

- create `packages/physical-preview-three/`;
- promote shape/hole extrusion, camera poses, materials, capture validation, and cleanup helpers;
- use Three.js directly for orbit controls where practical;
- keep React and Electron out of pure conversion logic.

### Slice G4 — lazy desktop integration

- add the production physical-preview screen against the open document;
- support front, back, edge, perspective, assembled, exploded, orbit, pan, zoom, reset, and layer visibility;
- show exact dimensions and truthful partial/unavailable states;
- preserve project geometry, dirty state, history, analysis, save, and exports;
- keep normal editing usable when WebGL is unavailable or lost.

### Slice G5 — privileged PNG capture

- implement typed preload/main capture and save flow;
- use deterministic filenames and explicit errors;
- keep arbitrary filesystem access out of the renderer;
- prove capture does not mutate the project or block editing.

### Slice G6 — Windows integration and milestone closure evidence

- run exact-head production package and Windows E2E;
- prove lazy bundle behavior and absence of experiment fixture payloads;
- verify high-DPI, keyboard, context loss, GPU fallback, resource cleanup, and representative real projects;
- produce a fresh private-test installer for owner hands-on validation;
- stop for ChatGPT audit.

## Review loop

1. Owner sends Claude `Continue LaserX`.
2. Claude implements or repairs only the next approved slice and stops.
3. Owner sends ChatGPT `Check LaserX`.
4. ChatGPT posts exact-head findings to GitHub.
5. On `REPAIR`, Claude continues the same PR.
6. On `READY`, owner sends ChatGPT `Advance LaserX`.
7. ChatGPT merges and activates only the next owner-approved slice or milestone.

## Later milestones

After M14, Claude remains the default implementation lead only if the owner keeps that assignment. Each later milestone receives a separate execution plan before implementation. Promotional capacity does not authorize parallel production work across multiple milestones.
