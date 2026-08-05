# M14 — Production Physical 3D Preview Integration

## Status

**Complete.** The owner accepted M14 on 2026-08-05 after exact-head machine evidence, a fresh private Windows installer, hands-on validation, submitted screenshots, and final closure audit. Issue #30 is the durable evidence record.

Status advances to M15 only after explicit owner approval. That approval was issued on 2026-08-05.

## User-visible outcome

A user finishes a sign, opens a dedicated physical preview, and sees the authoritative design become a truthful interactive object with exact thickness, holes, cutouts, material layers, assembled and exploded views, and customer-preview capture.

The feature creates the emotional payoff described in Issue #44 without becoming a second design model or a fake decorative mockup.

## Governing evidence

- Issue #44 — product interpretation and 3D vision;
- Issue #37 — post-milestone product direction;
- Issue #34 — accepted physical-preview research;
- Issue #42 — accepted material-aware rendering research;
- accepted integration recommendation at experiment head `9a4a90c6fa891ed0d9baf9bc8c99d41b04d54136`;
- ADR 0024 — production physical-preview architecture boundary;
- ADR 0026 — implementation and orchestration ownership;
- Issue #30 — implementation, review, validation, installer, owner retest, and closure evidence.

The experiment branch is never merged wholesale.

## Delivered architecture

- accepted renderer-independent physical scene and assembly contracts promoted into production;
- `packages/physical-preview-three/` as the renderer-adapter package;
- Three.js plus React Three Fiber, lazy-loaded only when preview is opened;
- exact extrusion from canonical `thicknessMm`;
- explicit physical manufacturing layers in authoritative document order;
- truthful holes, cutouts, partial states, invalid-geometry findings, and unavailable states;
- front, back, edge, perspective, assembled, exploded, orbit, pan, zoom, reset, keyboard operation, and presentation-only layer visibility;
- exact dimensions and verified versus declared-incomplete depth language;
- bounded current-material presentation without inventing unsupported identity;
- high-DPI, DPR bounds, WebGL unavailable, runtime context-loss, and cleanup behavior;
- typed Electron preload/main PNG capture and save flow;
- worker offload, deterministic physical-content caching, cancellation, stale-result rejection, and progress;
- exact-head packaged Windows evidence and owner private-installer validation.

## Architecture boundary

- Manufacturing geometry, project state, cutability evidence, SVG/DXF, and production packages remain authoritative.
- Preview state is derived, read-only, and non-persistent.
- Preview interaction cannot change geometry, dirty state, Undo/Redo, selection, analysis, save behavior, or manufacturing output.
- No CAD kernel is justified for M14.
- No experiment fixture registry, lab shell, benchmark hook, or bundled research fixture payload ships in production.
- Renderer-bound production source does not depend on unrestricted Node or filesystem behavior.
- PNG capture uses a privileged typed boundary rather than browser-anchor filesystem behavior.

## Completed implementation gates

1. **G0 — ADR and repository prerequisites** — PR #54, merge `a3481541a7dd246a7c3d8074f6516de09bd5af75`.
2. **G1 — text-heavy scaling and topology-cost evidence** — PR #55, merge `0a9dd63e31fdc7e15918c8c4651492d9d1ee44ec`.
3. **G2 — pure physical scene package promotion** — PR #56, merge `e8b10c67d61decd310ccf1d5a7ad76100047babb`.
4. **G3 — Three renderer adapter package** — PR #57, merge `f0769507abfac2c7a999f509fad8ae348de8b86b`.
5. **G4 — lazy desktop integration** — complete.
   - **G4A — renderer-safe integration foundation** — PR #61, merge `9ca320fe3cb7d82ad2d9c3a458790b7defbfded3`.
   - **G4B — lazy open-document preview screen** — PR #63, merge `cba0fbba3385f47cf59f4a026823256f91560639`.
   - **G4C — interaction, fallback, and cleanup** — PR #64, merge `c79f4b1ccce0b54fce26d0cdf1687cc79818f5bb`.
6. **G5 — privileged PNG capture** — PR #65, accepted head `d34c9cca2b7552551cfcd1efcd6fccd7baaa6a58`, merge `3f0d8dba70e0c218308d28d1917cd5584c928bd6`.
7. **G6 — exact-head Windows validation and owner retest** — accepted on exact `main` `078d4637fe0660792ebe1513aebb31b6a8593c1f`.

## G5 — capture ownership

G5 delivered the complete capture transaction:

- same-frame RGBA and PNG evidence;
- complete PNG structure validation and real decode;
- compressed-byte and decoded-pixel resource limits;
- blank/background-only rejection;
- deterministic content- and dimension-bound filenames;
- typed sender-checked Electron IPC;
- validated destination, overwrite, cancellation, and explicit failure behavior;
- atomic writes and stale-status rejection;
- non-mutation evidence across project and manufacturing outputs.

## G6 — exact-head closure evidence

Machine-verifiable evidence on the accepted production base included:

- fresh package and complete packaged Windows E2E passing;
- lazy-load and production-boundary audits;
- no Three.js in the main editor entry and no lab/research payloads;
- worker, caching, cancellation, stale-result, interaction, fallback, cleanup, and non-mutation coverage;
- a fresh NSIS private installer from a true short physical clone outside OneDrive.

Installer provenance:

- source head: `078d4637fe0660792ebe1513aebb31b6a8593c1f`;
- workspace: `C:\dev\laserx`;
- Node: `v24.18.1`;
- pnpm: `11.18.0`;
- build command: `pnpm --filter @laserx/desktop package:installer`;
- build exit code: `0`;
- byte size: `113120438`;
- SHA-256: `e98788e589c81255f8cab2dc1aa751e773429579f3958379fe00d2fbf097e689`;
- final Git status: clean.

## Owner acceptance

The owner reported that everything worked very well and that the 3D experience was intuitive and simple. The submitted retest archive contained seven screenshots covering import, front, edge, perspective, exploded view, layer hide/show, and orbit/pan/zoom.

Owner verdict: **M14 PASS**.

## Acceptance results

- [x] Exact canonical thickness across supported stock representations.
- [x] Layer order, holes, cutouts, material identity, depth semantics, assembled and exploded placement.
- [x] Invalid, ambiguous, empty, unsupported, and over-limit geometry fails visibly.
- [x] Deterministic scene and renderer output.
- [x] Worker progress, cancellation, stale-result rejection, and caching.
- [x] View, mode, camera, and visibility changes avoid topology recomputation.
- [x] Mouse and keyboard interaction paths.
- [x] Preview and capture remain non-mutating across editor and manufacturing surfaces.
- [x] WebGL unavailable, chunk failure, and context-loss behavior preserve normal editing and saving.
- [x] Geometry, material, renderer, listener, worker, cache, and capture resources remain bounded.
- [x] Same-frame PNG capture, deterministic naming, explicit failures, and typed privileged IPC.
- [x] Lazy production bundles exclude lab-only payloads and Three.js from the main editor entry.
- [x] Packaged Windows E2E and fresh private installer pass.
- [x] Owner hands-on validation passes.
- [x] Final exact-head closure audit finds no blocker.
- [x] Issue #30 closes after owner advancement.
- [x] Status advances to M15 after explicit owner approval.

## Explicitly excluded

No guided onboarding system, broad material-catalog schema integration, process-aware profiles, target-software export profiles, new AI capability, licensing, public beta, general-purpose 3D CAD, mesh editing, bends, welds, bevels, embossing, STL/STEP/IGES/3MF export, CAM, nesting, G-code, or machine control entered M14.
