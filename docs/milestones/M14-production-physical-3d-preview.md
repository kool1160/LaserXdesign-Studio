# M14 — Production Physical 3D Preview Integration

## User-visible outcome

A user finishes a sign, opens a dedicated physical preview, and sees the authoritative design become a truthful interactive object with exact thickness, holes, cutouts, material layers, assembled and exploded views, and customer-preview capture.

The feature must create the emotional payoff described in Issue #44 without becoming a second design model or a fake decorative mockup.

## Activation gate

M14 is active only when `docs/status/CURRENT.md` names it and Issue #30 is open as the active delivery issue.

Claude is the implementation agent. ChatGPT is the senior software engineer, project orchestrator, exact-head auditor, and acceptance authority under ADR 0026. Codex remains held unless the owner records an explicit assignment.

## Governing evidence

- Issue #44 — product interpretation and 3D vision;
- Issue #37 — post-milestone product direction;
- Issue #34 — accepted physical-preview research;
- Issue #42 — accepted material-aware rendering research;
- accepted integration recommendation at experiment head `9a4a90c6fa891ed0d9baf9bc8c99d41b04d54136`;
- ADR 0024 — production physical-preview architecture boundary;
- ADR 0026 — implementation and orchestration ownership;
- `docs/CLAUDE_EXECUTION_PLAN.md` — active implementation and validation plan.

The experiment branch is never merged wholesale.

## Included

- accepted renderer-independent physical scene and assembly contracts promoted into production;
- `packages/physical-preview-three/` as the renderer-adapter package;
- Three.js plus React Three Fiber, lazy-loaded only when preview is opened;
- exact extrusion from canonical `thicknessMm`;
- explicit physical manufacturing layers in authoritative document order;
- truthful holes, cutouts, partial states, invalid-geometry findings, and unavailable states;
- front, back, edge, perspective, assembled, exploded, orbit, pan, zoom, reset, and presentation-only layer visibility;
- exact dimensions and verified versus declared-incomplete depth language;
- neutral current-material appearances without inventing unsupported material identity;
- keyboard, high-DPI, DPR bounds, WebGL unavailable, runtime context-loss, and cleanup behavior;
- typed Electron preload/main PNG capture and save flow;
- text-heavy and high-point-count scaling evidence before arbitrary document wiring;
- worker offload, deterministic fingerprint caching, cancellation, stale-result rejection, and progress for measured expensive preview analysis;
- exact-head packaged Windows evidence and owner private-installer validation.

## Architecture boundary

- Manufacturing geometry, project state, cutability evidence, SVG/DXF, and production packages remain authoritative.
- Preview state is derived, read-only, and non-persistent unless a later migration explicitly changes that contract.
- Preview interaction cannot change geometry, dirty state, Undo/Redo, selection, analysis, save behavior, or manufacturing output.
- No CAD kernel is justified for M14.
- No experiment fixture registry, lab shell, benchmark hook, or bundled research fixture payload may ship in production.
- Renderer-bound production source must not depend on Node-only globals, `node:` imports, Electron, or unrestricted filesystem behavior.
- PNG capture must use a privileged typed boundary rather than browser-anchor filesystem behavior.

## Implementation gates

1. **G0 — ADR and repository prerequisites — complete.**
2. **G1 — text-heavy scaling and topology-cost evidence — complete.**
3. **G2 — pure physical scene package promotion — complete.**
4. **G3 — Three renderer adapter package — complete.**
5. **G4 — lazy desktop integration — complete.**
6. **G5 — privileged PNG capture — complete.** PR #65 accepted at `d34c9cca2b7552551cfcd1efcd6fccd7baaa6a58`, merge `3f0d8dba70e0c218308d28d1917cd5584c928bd6`.
7. **G6 — exact-head Windows validation and owner retest — active.**

Each gate is a bounded reviewable PR or explicitly reviewed evidence slice. G6 is validation and closure evidence, not feature expansion.

## G4A — renderer-safe integration foundation

Required outcome, completed:

- renderer-safe adapter source;
- typed worker request/progress/result/error protocol;
- deterministic physical-content caching;
- cancellation and stale-result rejection;
- reuse of cached topology/geometry for view, mode, camera, and presentation-only visibility changes;
- proof that expensive topology/scene work does not block the renderer thread.

## G4B — lazy open-document preview screen

Required outcome, completed:

- lazy-load the complete preview feature and Three/R3F chunk only when opened;
- consume the current open document through a stable immutable snapshot;
- show bounded loading, progress, empty, partial, failed, and unavailable states;
- render exact thickness, holes, layer order, assembled/exploded placement, and exact readouts;
- preserve editing, saving, analysis, SVG/DXF, and production export when preview fails;
- prove preview does not dirty or mutate the project.

## G4C — interaction, fallback, and cleanup

Required outcome, completed:

- front, back, edge, perspective view presets;
- assembled and exploded modes;
- orbit, pan, zoom, reset;
- presentation-only layer visibility;
- keyboard operation, focus behavior, accessible labels, high DPI, and bounded DPR;
- WebGL unavailable and runtime context-loss behavior;
- bounded cleanup of geometry, materials, renderers, controls, listeners, workers, and caches;
- packaged desktop evidence.

## G5 — capture ownership

G5 is complete and owns the merged capture transaction:

- obtain RGBA evidence and encoded PNG from the same rendered frame and readback transaction;
- validate signature, complete chunk structure, real decode, dimensions, content, and deterministic filename;
- enforce compressed-byte and decoded-pixel resource limits before privileged decode/write;
- cross only a typed, sender-checked Electron preload/main IPC boundary;
- validate destination path and overwrite policy;
- write atomically and report cancellation or failure explicitly;
- prevent stale capture status from describing later preview content;
- prove capture does not dirty or mutate the project and does not block normal editing.

## G6 — validation and closure ownership

G6 must:

- validate the exact merged `main` head and record the SHA;
- run production packaging and the complete packaged Windows E2E suite;
- prove lazy loading and absence of lab/research payloads;
- exercise representative real projects, exact dimensions and thickness, every view and mode, mouse and keyboard controls, visibility, high DPI, GPU/WebGL fallback, context loss, and repeated resource cleanup;
- verify preview/capture remain non-mutating across editor state and manufacturing outputs;
- generate a fresh private Windows installer with exact provenance;
- stop for owner hands-on validation of preview, manipulation, capture, save, reopen, export, and controlled failures;
- complete the exact-head milestone closure audit.

A defect found during G6 receives the smallest bounded repair with regression coverage and exact-head review. G6 does not authorize redesign or new product scope.

## Acceptance tests

1. Gauge, fractional-inch, and millimeter stock preview at exact canonical thickness.
2. Multi-layer assemblies preserve document order, per-layer material identity, thickness, holes, cutouts, assembled depth, and exploded placement.
3. Open, self-intersecting, ambiguous, empty, unsupported, or over-limit physical layers fail visibly without invented solids.
4. Identical project snapshots produce identical scene fingerprints and geometry output.
5. Preview and renderer conversion leave the supplied project structurally unchanged.
6. Expensive scene analysis executes off the renderer thread, reports progress, supports cancellation, rejects stale completion, and reuses fingerprint-keyed results.
7. View, mode, camera, and visibility changes do not trigger topology recomputation.
8. Front, back, edge, perspective, assembled, exploded, orbit, pan, zoom, reset, and visibility controls work with mouse and keyboard.
9. Preview interaction does not change geometry, dirty state, history, analysis, save, SVG/DXF, or production-package output.
10. WebGL unavailable, lazy-chunk failure, and context-loss states preserve normal editing, project readouts, and saving.
11. Generated geometries, materials, renderers, listeners, workers, caches, and capture resources do not grow without bound during repeated use.
12. PNG capture uses one-frame evidence, deterministic naming, explicit errors, and only the typed privileged boundary.
13. Production bundles lazy-load preview code, exclude Three.js from the main entry chunk, and contain no lab-only symbol or research fixture payload.
14. Representative text-heavy projects meet documented measured bounds on the reference environment without claiming universal performance.
15. Packaged Windows E2E and a fresh private installer pass on the exact reviewed head.
16. Owner hands-on validation confirms a real project can be previewed, manipulated, captured, saved, reopened, and exported without mutation.

## Exit checklist

- [x] G0–G5 are reviewed and merged.
- [x] Production ADR is accepted.
- [x] Pure scene and Three adapter packages pass focused and root tests.
- [ ] G6 exact-head machine evidence passes.
- [ ] Fresh private installer passes owner hands-on validation.
- [ ] Final exact-head closure audit finds no blocker.
- [ ] Issue #30 is closed after owner advancement.
- [ ] Status advances to M15 only after explicit owner approval.

## Explicitly excluded

No guided onboarding system, broad material-catalog schema integration, process-aware profiles, target-software export profiles, new AI capability, licensing, public beta, general-purpose 3D CAD, mesh editing, bends, welds, bevels, embossing, STL/STEP/IGES/3MF export, CAM, nesting, G-code, or machine control belongs in M14.
