# LaserX Physical 3D Preview Lab

## Status and authority

This is an isolated research program for GitHub Issue #34.

It does **not** activate M14, modify the active M13 gate, or authorize product integration. M13 remains authoritative through `docs/status/CURRENT.md` and Issue #13. The future product scope remains Issue #30 and `docs/milestones/M14-beta-validation-v1-release.md`.

Experiment branch:

`experiment/m14-physical-3d-preview-lab`

Starting source commit:

`6836ab37aa6f68ef78044c5668e92ba3c515c161`

Use a separate local Git worktree. Do not reuse any M13 implementation branch or directory.

## Product intent

LaserX already owns the authoritative 2D design, manufacturing metadata, cutability evidence, SVG/DXF output, and production-package behavior. The experiment must prove that those existing contracts can drive a trustworthy physical preview of a finished sign.

This is not a second editor and not a general-purpose 3D CAD system.

The useful product result is a fabricator/customer preview that accurately shows:

- front, back, and edge appearance;
- exact material thickness;
- visible through-holes and interior cutouts;
- ordered physical manufacturing layers;
- assembled and exploded stacks;
- per-layer materials and stock designations;
- overall physical width, height, and depth;
- visible failure when authoritative geometry cannot form a trustworthy preview.

## Required reading

Before changing code, read:

1. `AGENTS.md`
2. root `CLAUDE.md`
3. `docs/OPERATOR_PROTOCOL.md`
4. `docs/status/CURRENT.md`
5. `docs/milestones/M14-beta-validation-v1-release.md`
6. GitHub Issues #34, #30, and #13
7. `docs/ARCHITECTURE.md`
8. `docs/FILE_FORMATS.md`
9. `docs/TESTING.md`
10. `docs/SECURITY.md`
11. `docs/PRODUCTION_PACKAGES.md`
12. `docs/decisions/0022-explicit-manufacturing-layers-and-atomic-production-packages.md`
13. relevant domain, geometry, cutability, project-format, and production-export packages and tests
14. representative fixtures under `fixtures/projects` and `fixtures/production`

Do not rely on old schema-v3 or M03 handoffs. Inspect current repository truth. The current native project format includes later schema and manufacturing metadata.

## Repository structure

The experiment should create and own only these areas unless an explicit interface proposal is approved:

```text
apps/physical-3d-preview-lab/
packages/physical-preview-3d/
docs/experiments/m14-physical-3d-preview/
fixtures/physical-preview/
```

Existing production packages may be imported, but should not be modified during the initial prototype.

## Architectural boundary

The required data flow is one-way:

```text
Validated LaserX project snapshot
  -> authoritative physical-layer and contour extraction
  -> pure renderer-independent preview scene description
  -> Three.js / React Three Fiber adapter
  -> interactive physical preview
```

`packages/physical-preview-3d` owns the pure deterministic scene contract and conversion.

It may depend on current LaserX domain, geometry, project-format, cutability, and production-export contracts where appropriate.

It must not depend on React, Electron, Three.js, browser globals, filesystem APIs, or GPU APIs.

`apps/physical-3d-preview-lab` owns the experimental browser UI, Three.js renderer, interaction, view presets, materials, accessibility, screenshots, and performance instrumentation.

React components must consume the scene description. They must not calculate authoritative manufacturing geometry.

## Technology strategy

### Do not build a custom engine

Use mature existing libraries for rendering and CAD-kernel behavior.

### Preferred visualization stack

Evaluate and normally prefer:

- Three.js;
- React Three Fiber;
- Drei or another narrowly selected helper package only when justified;
- existing LaserX geometry and production contracts as the source of truth.

Three.js is expected to own cameras, rendering, lighting, materials, meshes, interaction support, and image capture. LaserX owns the meaning and dimensions of every part.

### CAD-kernel decision

Do not add a CAD kernel to the main prototype merely because it is impressive.

Evaluate RepliCAD/OpenCascade.js, CascadeStudio/cascade-core, and JSCAD only against concrete blocked requirements such as:

- trustworthy contour nesting and through-holes;
- complex planar face construction;
- exact boolean subtraction needed for preview fidelity;
- deterministic triangulation limitations;
- future solid interoperability that is explicitly outside current M14 scope.

The engine evaluation must compare:

- license compatibility;
- browser and Windows/Electron support;
- bundle/WASM size;
- cold and warm startup time;
- worker support;
- memory use;
- deterministic behavior;
- support for holes and nested contours;
- failure behavior on invalid geometry;
- maintenance health;
- integration complexity;
- whether it adds product value beyond Three.js visualization.

The default decision should remain Three.js/R3F unless measured evidence proves a kernel is required.

## Phase plan

### Phase 0 — Repository and engine audit

Deliver before installing major 3D dependencies:

- current authoritative geometry/manufacturing data-flow map;
- exact fields required for physical layers, materials, stock designations, thickness, order, and contours;
- list of reusable current packages and prohibited duplicated logic;
- evaluation of Three.js/R3F and CAD-kernel candidates;
- recommended scene contract;
- risk register;
- estimated implementation slices.

Write:

`docs/experiments/m14-physical-3d-preview/ENGINE_DECISION.md`

Stop and report if current authoritative data cannot safely identify physical pieces or through-holes.

### Phase 1 — Pure scene adapter

Create `packages/physical-preview-3d` with explicit serializable types for:

- preview document identity;
- physical layer identity and order;
- material and stock designation display data;
- canonical thickness in millimeters;
- planar face/contour definitions;
- outer contours and interior cutouts;
- transforms and world bounds;
- assembled and exploded Z placement;
- warnings/findings;
- unsupported geometry;
- deterministic scene fingerprint;
- performance metrics suitable for tests.

The adapter must:

- accept a validated immutable project snapshot;
- derive only from authoritative physical manufacturing layers;
- omit non-cut preview/reference layers from physical solids;
- preserve exact X/Y dimensions and exact `thicknessMm`;
- preserve contour holes and layer ordering;
- return visible findings instead of inventing solids;
- never mutate the source snapshot;
- return the same scene and fingerprint for identical input/settings.

### Phase 2 — Browser preview lab

Create a standalone React/Vite lab under `apps/physical-3d-preview-lab`.

Required capabilities:

- reviewed project/fixture selection;
- orbit, pan, zoom, reset;
- front, back, edge, perspective, assembled, and exploded views;
- keyboard-accessible view controls;
- exact dimension and thickness readouts;
- per-layer visibility for inspection only;
- mild steel, stainless steel, aluminum, galvanized steel, acrylic, wood, and explicit fallback appearances;
- neutral studio background and optional wall preview;
- cutout and through-hole fidelity;
- visible warnings and unsupported-geometry list;
- customer-preview PNG capture;
- GPU/WebGL unavailable or failure state that leaves normal LaserX unaffected;
- high-DPI rendering and non-color-only state indicators.

### Phase 3 — Evidence and stress testing

Add:

- representative single-layer sign fixture;
- gauge-stock fixture;
- fractional-inch fixture;
- millimeter-stock fixture;
- multi-layer sign with different materials/thicknesses;
- holes and nested cutouts;
- invalid/open/self-intersecting/unsupported cases;
- representative high-complexity fixture.

Measure:

- conversion time;
- render startup;
- frame rate or bounded interaction metric;
- memory use where practical;
- screenshot generation;
- exploded-view regeneration;
- deterministic repeated conversion.

### Phase 4 — Integration recommendation

Write:

`docs/experiments/m14-physical-3d-preview/INTEGRATION_RECOMMENDATION.md`

The recommendation must be one of:

- adopt;
- revise and re-test;
- reject.

It must identify:

- exact packages/files suitable for later M14 integration;
- interfaces requiring an ADR;
- dependencies and licenses;
- expected installer impact;
- performance budgets;
- GPU fallback behavior;
- schema changes, preferably none;
- work that must wait until M14 activation;
- experiment code that should be discarded.

## Correctness rules

- Canonical millimeters remain authoritative.
- User-facing gauge, fractional-inch, millimeter, or custom designation is presentation metadata; exact extrusion uses normalized `thicknessMm`.
- Physical layer order comes from authoritative manufacturing metadata.
- Hidden/nonphysical/reference layers do not silently become solids.
- Do not silently close open contours.
- Do not silently repair, union, subtract, scale, simplify, discard, or reinterpret geometry.
- Do not infer holes merely from visual overlap. Use authoritative contour topology or fail visibly.
- Invalid or ambiguous geometry must produce specific findings tied to source IDs/layers.
- Preview interaction must not change project geometry, dirty state, history, selection, analysis evidence, SVG/DXF, production packages, or saves.
- No renderer or GPU result is manufacturing evidence.

## Explicit exclusions

Do not implement:

- general-purpose 3D CAD;
- arbitrary solid or mesh editing;
- 3D sketching;
- bends, welds, bevels, embossing, engraving depth, or machining features;
- STL, STEP, IGES, 3MF, or production-solid export;
- CAM, nesting, toolpaths, G-code, or machine control;
- project schema changes;
- active M13 installer/release changes;
- M14 milestone activation or Version 1.0 release work.

## Testing requirements

### Pure package tests

- exact width and height;
- exact per-layer thickness;
- assembled depth;
- exploded layer order;
- transforms and world placement;
- outer contour and interior cutout preservation;
- nonphysical-layer exclusion;
- invalid/open/ambiguous geometry findings;
- deterministic scene fingerprint;
- source project immutability;
- no effect on serialized project, production package, or export evidence.

### Browser tests

- launch and load fixture;
- all required view presets;
- mouse and keyboard orbit/pan/zoom/reset;
- assembled/exploded mode;
- material appearances and text labels;
- exact dimensions;
- visible invalid-geometry warnings;
- high-DPI behavior;
- WebGL/GPU unavailable state;
- PNG capture.

### Existing verification

Do not weaken existing tests. Run relevant existing repository verification after adding workspace packages. The experiment must report any test intentionally unavailable on the current machine.

## Delivery and Git rules

- Commit only to `experiment/m14-physical-3d-preview-lab`.
- Keep commits focused.
- Never merge automatically.
- Do not update `docs/status/CURRENT.md`.
- Do not close Issues #13, #30, or #34.
- Do not claim M14 is active.
- Do not open a normal product PR.
- An experimental draft PR is permitted only after all prototype evidence exists and must be labeled clearly as non-merge-ready research.

## Claude credit discipline

Use the high-capability model for architecture decisions, difficult geometry analysis, and final review. Use the next model down for implementation, tests, and routine iteration.

Avoid repeatedly rereading the entire repository. Maintain concise research notes and use targeted file inspection after the initial audit.

Stop and report rather than spending credits implementing a broad custom CAD system or duplicating existing LaserX geometry logic.
