# Current Project Status

## Active gate

**M14 — Production Physical 3D Preview Integration**

- Active issue: #30
- Active milestone specification: `docs/milestones/M14-production-physical-3d-preview.md`
- Implementation lead: Claude
- Independent planning/review/advancement: ChatGPT
- Codex: held unless explicitly reassigned
- Current slice: **G2 — pure physical scene package promotion**

The owner explicitly activated M14 on 2026-08-03 after M13 completion and the Issue #44 planning reset.

`Continue LaserX` authorizes Claude to implement or repair only the next approved M14 slice. It does not authorize merge, Issue #30 closure, M15 activation, wholesale experiment merge, or later-milestone scope.

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

M13 — Windows Installer, Packaging, and Private Beta Hardening — is complete.

### Installer implementation

- PR #33
- Final reviewed head: `6cdfaf4fbf68e8c078b4b0b0cda095ea1fcad30f`
- Merge commit: `1231a0127a59fe87b38824d3fa11039c3a028422`
- Verification: 290 unit/integration tests and 31/31 applicable packaged Windows Electron E2E scenarios

### Persistence repair

- PR #35
- Final reviewed head: `e642aa56cb70d6876a9af43024920349f0c8ab7a`
- Merge commit: `5cf799273d55a2bc6df544d47b0fcc75d32c5d56`
- Root cause: visible unaccepted preview geometry could be saved as a blank underlying document
- Repair: save is blocked while vector, raster, sign-tool, or AI preview geometry remains unaccepted

### Repository maintenance

- PR #38
- Merge commit: `a95a90e702ebc96ea4db46b918324327b118f5ef`
- Windows case-colliding tracked paths resolved and guarded

### Owner private-installer validation

The owner installed the repaired build, accepted the expected trust warning, launched from Start Menu, imported and accepted a DXF preview, analyzed it, saved and reopened a non-empty `.laserx` project, confirmed identity/path/geometry, exported DXF, and completed assisted uninstall.

M13 closed through commit `04404690c1c089a46986915ea16628bb39a8fe94`.

## M14 completed slice record

### G0 — governance and architecture lock — complete

- PR #54
- Final reviewed head: `350214a70b3c9e5c1fe0a9855d703135f57c9959`
- Review verdict: `READY`
- Exact-head workflows: 12/12 pull-request workflows green; one additional push-triggered case-collision run green
- Squash merge: `a3481541a7dd246a7c3d8074f6516de09bd5af75`
- ADR: `docs/decisions/0024-production-physical-3d-preview-boundary.md`
- Added mechanical audits:
  - `pnpm audit:physical-preview`
  - `pnpm audit:physical-preview-guard`

G0 locked the authoritative 2D boundary, pure scene package, Three adapter package, no-CAD-kernel decision, no-drei decision, lazy-loading boundary, privileged PNG capture boundary, component-by-component promotion rule, and production exclusion of research fixtures, selectors, registries, benchmark hooks, and forbidden package couplings.

### G1 — text-heavy scaling and topology-cost evidence — complete

- PR #55
- Final reviewed head: `1adbfbacd872f4a24e3947b5b4d18eba40d9123a`
- Review verdict: `READY`
- Exact-head workflows: 12/12 pull-request workflows green
- Squash merge: `0a9dd63e31fdc7e15918c8c4651492d9d1ee44ec`
- Evidence:
  - `docs/experiments/m14-physical-3d-preview/G1_SCALING_EVIDENCE.md`
  - `docs/experiments/m14-physical-3d-preview/g1-results.json`

G1 established that realistic outlined-text preview cost is dominated by existing cutability analysis rather than Three conversion. The only measured safely skippable work is the spacing/manufacturing-advisory phase, approximately 36.2%–45.1%. A future preview/region-classification entry point must preserve every validity and ambiguity check, fail closed, reuse the accepted classifier, remain deterministic, and receive a separate ADR. Worker offload, fingerprint-keyed caching, progress, and cancellation remain required before arbitrary-document desktop wiring.

## M14 research basis

### Physical 3D research

Issue #34 is complete and accepted at exact head:

`9a4a90c6fa891ed0d9baf9bc8c99d41b04d54136`

Accepted production direction:

- promote `@laserx/physical-preview-3d` component by component;
- create `@laserx/physical-preview-three`;
- use Three.js plus React Three Fiber;
- do not add a CAD kernel;
- rewrite the production UI against the open document;
- use typed Electron preload/main IPC for PNG capture;
- lazy-load the feature;
- keep lab shell, benchmark hooks, fixture registry, and bundled research fixtures out of production;
- never merge the experiment branch wholesale.

### Material-aware rendering research

Issue #42 is accepted at exact head:

`76fa77a8edeb976b46e8e345a4a232b938768b3f`

It remains isolated. M14 may use approved current-material presentation behavior, but broad catalog/schema promotion belongs to M16.

### Material catalog research

Issue #39 and draft PR #40 remain isolated inputs for M16. They are not production-merge-authorized during M14.

## Current G2 scope

G2 promotes the accepted renderer-independent physical scene contract into production as `packages/physical-preview-3d/`.

Required behavior:

- consume authoritative project/document snapshots without mutation;
- preserve exact canonical `thicknessMm`, physical-layer order, holes, cutouts, parent/depth topology, declared-incomplete versus verified depth, findings, and deterministic fingerprints;
- fail closed for open, duplicate, overlapping, self-intersecting, cross-intersecting, ambiguous, empty, or unsupported geometry and never invent solids;
- include exact negative tests proving source immutability on the object actually passed through conversion;
- remain independent from Three, React, Electron, DOM, filesystem, GPU, and the future M16 material catalog;
- promote only reviewed components from accepted research; never merge or cherry-pick the experiment branch wholesale;
- exclude the lab shell, fixture registry, URL selectors, benchmark hooks, research fixture payloads, and material-catalog research.

The G1 optimization decision is conditional. G2 may add a separate ADR and a narrow preview/region-classification API only if exact tests prove parity for every validity and ambiguity-producing check and the accepted `classifyRegions` implementation is reused. Otherwise G2 must use the existing full cutability-analysis path. No worker, desktop UI, Three adapter, PNG capture, G3, or M15 work belongs in G2.

## M14 approved execution order

1. **G0 — governance and architecture lock** — complete
2. **G1 — text-heavy scaling evidence** — complete
3. **G2 — pure physical scene package promotion** — active
4. **G3 — Three renderer adapter package**
5. **G4 — lazy desktop integration**
6. **G5 — privileged PNG capture**
7. **G6 — exact-head Windows evidence and owner retest**

Full execution rules: `docs/CLAUDE_EXECUTION_PLAN.md`.

Claude must stop after each bounded slice for ChatGPT audit.

## M14 exit rule

Do not advance to M15 until:

- every M14 acceptance test passes;
- required exact-head workflows are green;
- no blocking review thread remains;
- the final private installer passes owner hands-on validation;
- Issue #30 is closed;
- the exact merge and evidence are recorded;
- the owner explicitly authorizes M15.

## Later roadmap

M15 through M23 implement the product direction from Issues #44 and #37:

- guided onboarding, workflow-first UI, grouped repair, and Learn Mode;
- material truth and wood/acrylic expansion;
- process-aware manufacturability;
- downstream export profiles;
- optional AI onboarding;
- licensing/trial;
- community beta;
- real-user usability validation and final app-wide interface polish;
- Version 1.0 release and broader-market launch.

M24 and M25 preserve the post-Version-1 machine-platform path behind explicit safety gates.

## Private-testing boundary

LaserX remains private test software until a later milestone explicitly approves outside distribution. Trusted signing, public publication, pricing activation, and public support do not belong in M14.
