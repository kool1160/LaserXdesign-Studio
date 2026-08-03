# M14 — Production Physical 3D Preview Integration

## User-visible outcome

A user finishes a sign, opens a dedicated physical preview, and sees the authoritative design become a truthful interactive object with exact thickness, holes, cutouts, material layers, assembled and exploded views, and customer-preview capture.

The feature must create the emotional payoff described in Issue #44 without becoming a second design model or a fake decorative mockup.

## Activation gate

M14 is active only when `docs/status/CURRENT.md` names it and Issue #30 is open as the active delivery issue.

Claude is the implementation lead. ChatGPT performs independent exact-head audits. Codex remains held unless the owner explicitly reassigns work.

## Governing evidence

- Issue #44 — product interpretation and 3D vision;
- Issue #37 — post-milestone product direction;
- Issue #34 — accepted physical-preview research;
- Issue #42 — accepted material-aware rendering research;
- accepted integration recommendation at experiment head `9a4a90c6fa891ed0d9baf9bc8c99d41b04d54136`;
- `docs/CLAUDE_EXECUTION_PLAN.md`.

The experiment branch is never merged wholesale.

## Included

- accepted renderer-independent physical scene and assembly contracts promoted into production;
- a new `packages/physical-preview-three/` renderer-adapter package;
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
- exact-head packaged Windows evidence and owner private-installer validation.

## Architecture boundary

- Manufacturing geometry, project state, cutability evidence, SVG/DXF, and production packages remain authoritative.
- Preview state is derived, read-only, and non-persistent unless a later migration explicitly changes that contract.
- Preview interaction cannot change geometry, dirty state, Undo/Redo, selection, analysis, save behavior, or manufacturing output.
- No CAD kernel is justified for M14.
- No experiment fixture registry, lab shell, benchmark hook, or bundled research fixture payload may ship in production.
- PNG capture must use a privileged typed boundary rather than browser-anchor filesystem behavior.

## Implementation gates

1. **G0 — ADR and repository prerequisites.**
2. **G1 — text-heavy scaling and topology-cost evidence.**
3. **G2 — pure physical scene package promotion.**
4. **G3 — Three renderer adapter package.**
5. **G4 — lazy desktop integration.**
6. **G5 — privileged PNG capture.**
7. **G6 — exact-head Windows validation and owner retest.**

Each gate should be a bounded reviewable PR or an explicitly reviewed slice. Claude stops after each for ChatGPT audit.

## Acceptance tests

1. Gauge, fractional-inch, and millimeter stock preview at exact canonical thickness.
2. Multi-layer assemblies preserve document order, per-layer material identity, thickness, holes, cutouts, assembled depth, and exploded placement.
3. Open, self-intersecting, ambiguous, empty, or unsupported physical layers fail visibly without invented solids.
4. Identical project snapshots produce identical scene fingerprints and geometry output.
5. Preview and renderer conversion leave the supplied project structurally unchanged.
6. Front, back, edge, perspective, assembled, exploded, orbit, pan, zoom, reset, and visibility controls work with mouse and keyboard.
7. Preview interaction does not change geometry, dirty state, history, analysis, save, SVG/DXF, or production-package output.
8. WebGL unavailable and context-loss states preserve normal editing, project readouts, and saving.
9. Generated geometries, materials, listeners, and capture resources do not grow without bound during repeated use.
10. PNG capture uses deterministic naming, validates non-empty output, reports failures, and crosses only the typed privileged boundary.
11. Production bundles lazy-load preview code and contain no lab-only symbol or research fixture payload.
12. Representative text-heavy projects meet documented measured bounds on the reference environment without claiming universal performance.
13. Packaged Windows E2E and a fresh private installer pass on the exact reviewed head.
14. Owner hands-on validation confirms a real project can be previewed, manipulated, captured, saved, reopened, and exported without mutation.

## Exit checklist

- [ ] G0–G6 are reviewed and merged.
- [ ] Production ADR is accepted.
- [ ] Pure scene and Three adapter packages pass focused and root tests.
- [ ] Desktop preview is lazy-loaded and non-mutating.
- [ ] Capture uses typed Electron IPC.
- [ ] Accessibility, high-DPI, GPU fallback, context loss, performance, and cleanup evidence pass.
- [ ] Exact-head CI is green.
- [ ] Fresh private installer passes owner hands-on validation.
- [ ] Issue #30 is closed only after ChatGPT exact-head audit and owner advancement.
- [ ] Status advances to M15 only after explicit owner approval.

## Explicitly excluded

No guided onboarding system, broad material-catalog schema integration, process-aware profiles, target-software export profiles, new AI capability, licensing, public beta, general-purpose 3D CAD, mesh editing, bends, welds, bevels, embossing, STL/STEP/IGES/3MF export, CAM, nesting, G-code, or machine control belongs in M14.
