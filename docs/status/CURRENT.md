# Current Project Status

Updated: 2026-08-04

## Active milestone

**M14 — Production Physical 3D Preview Integration**

- Active issue: #30
- Milestone specification: `docs/milestones/M14-production-physical-3d-preview.md`
- Senior engineering lead and orchestrator: ChatGPT
- Current implementation agent: Claude, held until the strengthened G4 brief is merged and issued
- Independent verifier: assigned by risk; Codex is available but not automatically active
- Owner: product direction and milestone advancement
- Current gate: **G4 — Lazy desktop integration**
- Current state: **PLANNING — senior architecture brief being locked**

## G3 completion record

- PR: #57 — `M14 G3 — Three renderer-adapter package`
- Branch: `feat/m14-g3-three-adapter`
- Exact reviewed head: `9785216183535917d8ab0c7f51f37e75ed8e7503`
- Squash merge: `f0769507abfac2c7a999f509fad8ae348de8b86b`
- Review verdict: `READY`
- Exact-head workflows: 12/12 successful
- Focused package verification: 162/162 tests passed on the Windows package gate
- Changed files: 18
- Scope status: correctly bounded to G3

Delivered production package: `packages/physical-preview-three/`.

G3 established deterministic exact-thickness extrusion, real holes and nested islands, authoritative assembled/exploded placement, solved camera fitting, presentation-only materials, source-attributed conversion failure, content-bound PNG validation primitives, deterministic filenames, renderer-package boundaries, and idempotent resource cleanup.

G3 did not include React/R3F desktop UI, open-document wiring, workers, WebGL fallback/context-loss UI, privileged PNG save, Electron IPC, material-catalog promotion, G4 implementation, or M15 work.

## Active governance update

Branch: `governance/senior-engineering-orchestration`

The owner directed a senior-led delivery model on 2026-08-04:

- ChatGPT owns engineering direction, architecture, execution briefs, integration, and review cadence;
- Claude, Codex, or another approved agent may execute bounded implementation work;
- routine work moves through focused review and CI without requiring the owner to courier reports;
- senior audits occur at architecture, performance, major integration, trust-boundary, milestone, and release turning points;
- independent verification is required where the senior lead directly authored critical work or where separation of duties is otherwise required.

The durable rules are in:

- `AGENTS.md`;
- `docs/OPERATOR_PROTOCOL.md`;
- `docs/WORKSTREAM_OWNERSHIP.md`;
- `docs/CLAUDE_EXECUTION_PLAN.md`.

The governance update must merge before G4 implementation begins so the implementation agent receives the strengthened brief rather than the older loose scope.

## Mandatory product interpretation

Every agent reads Issues #44 and #37 before planning or implementing post-M13 work.

LaserX is an affordable, premium-feeling, machine-independent idea-to-manufacturable-product platform.

Locked interpretation:

- first-time usability is central;
- deterministic sign creation works without AI;
- AI is a prominent optional creation path, not a core dependency;
- physical 3D is a major feature but remains derived and non-mutating;
- Inkscape and downstream machine software are companions;
- the interface is workflow-first with contextual controls and progressive disclosure;
- repair findings are grouped into understandable decisions;
- research reduces uncertainty but does not authorize wholesale merges or determine priority by itself;
- Version 1 should prove an excellent flat-cut sign workflow before broadening into general CAD or machine control.

## M14 completed gates

### G0 — governance and architecture lock

- PR #54
- Reviewed head: `350214a70b3c9e5c1fe0a9855d703135f57c9959`
- Squash merge: `a3481541a7dd246a7c3d8074f6516de09bd5af75`
- Result: ADR 0024, production boundaries, no CAD kernel, no drei, lazy preview, privileged capture, and research-exclusion guards.

### G1 — text-heavy scaling evidence

- PR #55
- Reviewed head: `1adbfbacd872f4a24e3947b5b4d18eba40d9123a`
- Squash merge: `0a9dd63e31fdc7e15918c8c4651492d9d1ee44ec`
- Result: realistic text-heavy cost is dominated by cutability analysis, requiring worker offload, fingerprint caching, cancellation, stale-result rejection, and progress before arbitrary-document desktop wiring.

### G2 — pure physical scene package

- PR #56
- Reviewed head: `8ecf0fb002d712bd1110cade5b1d67e3ad34122e`
- Squash merge: `e8b10c67d61decd310ccf1d5a7ad76100047babb`
- Result: deterministic renderer-independent scene/assembly contract with exact thickness, authoritative layer order, fail-closed geometry, findings, fingerprints, and source immutability.

### G3 — Three renderer adapter

- PR #57
- Reviewed head: `9785216183535917d8ab0c7f51f37e75ed8e7503`
- Squash merge: `f0769507abfac2c7a999f509fad8ae348de8b86b`
- Result: production Three adapter contract with deterministic geometry, camera, material, failure, capture-validation, and cleanup primitives.

Detailed history remains available in merged PRs, Issue #30, milestone documentation, ADRs, experiment evidence, and Git history. `CURRENT.md` is intentionally a live control panel rather than a duplicate historical archive.

## Active G4 direction

G4 is the lazy production desktop integration against the currently open document.

It must provide:

- front, back, edge, and perspective views;
- assembled and exploded modes;
- orbit, pan, zoom, reset, and layer visibility;
- exact dimension readouts and truthful partial/unavailable states;
- no project mutation, dirty-state change, history change, save change, analysis change, or export change from preview interaction;
- lazy loading and bounded chunk-load failure;
- WebGL unavailable and context-loss behavior that leaves editing usable.

Measured-performance requirements:

- expensive preview/cutability work off the renderer/UI thread;
- fingerprint-keyed caching;
- cancellation and stale-result rejection;
- visible progress;
- coalescing/debouncing rapid document changes;
- no topology recomputation for camera, view, mode, visibility, or orbit changes;
- cleanup on project change, preview close, retry, and context loss;
- representative text-heavy real-render/GPU and draw-call evidence.

Renderer-safety hardening before wiring:

- no Node-only globals or `node:` imports in production renderer-bound source;
- production and test TypeScript environments must not hide renderer coupling;
- UI-facing resource collections should be readonly while disposal ownership remains internal.

G4 is a senior architecture and workflow checkpoint. The senior lead must issue a bounded implementation brief after the governance update merges. Claude must not begin from the older general G4 bullet list.

## G5 locked capture boundary

G4 owns the renderer and stable frame access. G5 owns the one-transaction capture and privileged save path:

- PNG bytes and RGBA evidence from the same frame/readback transaction;
- structure, dimension, and non-background validation;
- deterministic filename;
- typed, sender-checked preload/main IPC;
- path and overwrite validation;
- explicit failure reporting;
- no arbitrary renderer filesystem access;
- no project mutation or blocked editing.

G5 is a critical independent checkpoint.

## M14 execution order

1. G0 — complete
2. G1 — complete
3. G2 — complete
4. G3 — complete
5. G4 — planning, implementation not started
6. G5 — not started
7. G6 — not started

## M14 exit rule

Do not advance to M15 until:

- every M14 acceptance criterion passes;
- required exact-head and packaged workflows are green;
- no critical defect or unresolved blocking review remains;
- G5 has independent verification;
- G6 Windows and representative-project evidence is complete;
- the private installer passes owner hands-on validation;
- Issue #30 is closed;
- exact merge and evidence are recorded;
- the owner explicitly authorizes M15.

## Later roadmap correction

After M15 builds the structural workflow and onboarding system, establish an early private-user validation checkpoint before committing months to M16–M19 assumptions.

M22 remains final release-wide usability validation and bounded correction, not the first serious discovery of whether the core workflow works.

## Private-testing boundary

LaserX remains private test software until a later milestone explicitly approves outside distribution. Trusted public signing, publication, active licensing, pricing activation, and public support do not belong in M14.

## Next engineering action

Merge the senior-orchestration governance update, then issue the strengthened G4 execution brief. Do not start G4 implementation before both are in GitHub.