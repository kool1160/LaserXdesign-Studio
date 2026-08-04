# Current Project Status

## Active gate

**M14 — Production Physical 3D Preview Integration**

- Active issue: #30
- Active milestone specification: `docs/milestones/M14-production-physical-3d-preview.md`
- Implementation and orchestration lead: ChatGPT
- Owner authority: product direction and milestone advancement
- Claude: held unless explicitly assigned independent review, repair, comparison, or specialist work
- Codex: held unless explicitly assigned independent review, repair, comparison, or specialist work
- Current slice: **G4 — lazy desktop integration**
- Current implementation sub-slice: **G4A — renderer-safe integration foundation**

The owner explicitly reassigned implementation responsibility to ChatGPT on 2026-08-04. ADR 0025 records the durable ownership change and supersedes the former Claude-first assignment while this status remains active.

`Continue LaserX` authorizes ChatGPT to inspect and implement only the next bounded active sub-slice. It does not authorize Issue #30 closure, M15 activation, wholesale experiment merge, or later-milestone scope. `Advance LaserX` still requires an exact-head `READY` verdict and explicit owner authorization.

## Mandatory product interpretation

Every agent must read GitHub Issues #44 and #37 before planning or implementing post-M13 work.

LaserX is an affordable, premium-feeling, machine-independent idea-to-manufacturable-product platform.

Locked interpretation:

- first-time usability is central;
- deterministic sign creation works without AI;
- AI is optional and user-supplied;
- physical 3D is a major feature but remains derived and non-mutating;
- Inkscape and downstream machine software are companions;
- premium experience and generous pricing are product requirements;
- the interface is workflow-first and uses contextual controls with progressive disclosure;
- large finding sets are grouped into repair decisions, with **Fix safe problems** as the primary repair action when deterministic eligible repairs exist;
- research reduces uncertainty but does not authorize wholesale merges or set priority by itself.

## M13 completion record

M13 — Windows Installer, Packaging, and Private Beta Hardening — is complete. Its reviewed installer, persistence repair, case-collision guard, and owner private-install validation remain the accepted base for M14.

## M14 completed slice record

### G0 — governance and architecture lock — complete

- PR #54
- Final reviewed head: `350214a70b3c9e5c1fe0a9855d703135f57c9959`
- Review verdict: `READY`
- Exact-head workflows: 12/12 green
- Squash merge: `a3481541a7dd246a7c3d8074f6516de09bd5af75`
- ADR: `docs/decisions/0024-production-physical-3d-preview-boundary.md`

G0 locked the authoritative 2D boundary, pure scene package, Three adapter package, no-CAD-kernel and no-drei decisions, lazy-loading boundary, privileged PNG capture boundary, component-by-component promotion, and production exclusion of research fixtures and hooks.

### G1 — text-heavy scaling and topology-cost evidence — complete

- PR #55
- Final reviewed head: `1adbfbacd872f4a24e3947b5b4d18eba40d9123a`
- Review verdict: `READY`
- Exact-head workflows: 12/12 green
- Squash merge: `0a9dd63e31fdc7e15918c8c4651492d9d1ee44ec`
- Evidence: `docs/experiments/m14-physical-3d-preview/G1_SCALING_EVIDENCE.md`

G1 proved that realistic outlined-text cost is dominated by cutability analysis. Worker offload, fingerprint-keyed caching, progress, cancellation, and stale-result rejection are mandatory before arbitrary-document desktop wiring. View, mode, camera, and presentation-only visibility changes must not recompute topology.

### G2 — pure physical scene package — complete

- PR #56
- Final reviewed head: `8ecf0fb002d712bd1110cade5b1d67e3ad34122e`
- Review verdict: `READY`
- Exact-head workflows: 12/12 green
- Squash merge: `e8b10c67d61decd310ccf1d5a7ad76100047babb`
- Production package: `packages/physical-preview-3d/`
- Focused verification: 43 tests across four files

G2 promoted the renderer-independent physical scene and assembly contract with exact thickness, authoritative layer order, holes, findings, deterministic fingerprints, source immutability, verified versus declared-incomplete depth, fail-closed invalid geometry, and renderer-safe boundaries.

### G3 — Three renderer adapter — complete

- PR #57
- Final reviewed head: `9785216183535917d8ab0c7f51f37e75ed8e7503`
- Review verdict: `READY`
- Exact-head workflows: 12/12 green, no rerun
- Focused verification: 162 tests across five files on Windows
- Squash merge: `f0769507abfac2c7a999f509fad8ae348de8b86b`
- Production package: `packages/physical-preview-three/`

G3 delivered exact-thickness Three geometry with genuine holes and nested islands, authoritative placement, solved camera fitting, presentation-only materials, content-bound capture validation helpers, source-attributed exception safety, deterministic output, and bounded resource cleanup. It stayed outside React desktop UI, Electron IPC, G5 save behavior, the M16 material catalog, and M15.

## Active G4A scope

G4A establishes the renderer-safe and responsive integration foundation before a full production preview screen is wired.

Required implementation:

- remove Node-only production fallback and Node global typing from renderer-bound `packages/physical-preview-three/src`;
- keep Node-only PNG test utilities in tests only;
- expose readonly resource collections while retaining private internal disposal ownership;
- define typed worker request, progress, success, failure, and cancellation contracts for physical scene construction from immutable project snapshots;
- execute measured expensive scene analysis outside the renderer/UI thread;
- cache completed scene results by deterministic physical-scene fingerprint;
- reject stale results after project changes or superseding requests;
- preserve bounded progress and cancellation;
- prove front/back/edge/perspective, camera, assembled/exploded mode, and presentation-only visibility changes do not trigger topology recomputation;
- prove worker or analysis failure does not mutate the project or block editing and saving;
- add focused coordination, boundary, and regression tests.

Allowed paths are the smallest necessary set under:

- `packages/physical-preview-three/`;
- `packages/physical-preview-3d/` only if a pure serializable worker contract requires a backward-compatible export;
- `apps/desktop/src/features/physical-preview/`;
- `apps/desktop/src/workers/` or the existing reviewed worker location;
- `apps/desktop/tests/`;
- narrowly required build, audit, and documentation files.

G4A does not include the complete production preview screen, capture saving, Electron filesystem IPC, material-catalog promotion, M15 onboarding, or later-milestone work.

## Locked G4/G5 ownership boundary

G4 owns rendering, lazy loading, open-document integration, progress, controls, visibility, WebGL fallback, context recovery, and renderer cleanup.

G5 owns the complete capture transaction:

- same-frame RGBA readback and PNG encoding;
- content and dimension binding;
- deterministic naming;
- typed sender-checked preload/main IPC;
- path and overwrite validation;
- atomic filesystem save and explicit error handling.

G4 may expose renderer capability needed by G5 but does not save files or independently claim capture success.

## M14 research basis

Issue #34 is accepted at exact head `9a4a90c6fa891ed0d9baf9bc8c99d41b04d54136`.

Issue #42 is accepted at exact head `76fa77a8ed976b46e8e345a4a232b938768b3f` and remains isolated except for approved current-material presentation behavior.

Issue #39 and draft PR #40 remain isolated inputs for M16 and are not production-merge-authorized during M14.

## M14 approved execution order

1. **G0 — governance and architecture lock** — complete
2. **G1 — text-heavy scaling evidence** — complete
3. **G2 — pure physical scene package** — complete
4. **G3 — Three renderer adapter** — complete
5. **G4 — lazy desktop integration** — active
   - G4A renderer-safe integration foundation — active
   - G4B lazy open-document preview screen — held
   - G4C interaction, fallback, and cleanup — held
6. **G5 — privileged PNG capture** — held
7. **G6 — exact-head Windows evidence and owner retest** — held

Full execution rules: `docs/CLAUDE_EXECUTION_PLAN.md` and ADR 0025.

## M14 exit rule

Do not advance to M15 until:

- every M14 acceptance test passes;
- required exact-head workflows are green;
- no blocking finding remains;
- the final private installer passes owner hands-on validation;
- Issue #30 is closed;
- the exact merge and evidence are recorded;
- the owner explicitly authorizes M15.

## Later roadmap

M15 through M23 preserve the workflow-first platform direction from Issues #44 and #37. M24 and M25 preserve the post-Version-1 machine-platform path behind explicit safety gates.

## Private-testing boundary

LaserX remains private test software until a later milestone explicitly approves outside distribution. Trusted public signing, publication, pricing activation, and public support do not belong in M14.
