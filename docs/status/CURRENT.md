# Current Project Status

## Active gate

**M14 — Production Physical 3D Preview Integration**

- Active issue: #30
- Active milestone specification: `docs/milestones/M14-production-physical-3d-preview.md`
- Implementation lead: Claude
- Independent planning/review/advancement: ChatGPT
- Codex: held unless explicitly reassigned
- Current slice: **G1 — text-heavy and high-point-count scaling evidence**

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
- Exact-head workflows: 13/13 green
- Squash merge: `a3481541a7dd246a7c3d8074f6516de09bd5af75`
- ADR: `docs/decisions/0024-production-physical-3d-preview-boundary.md`
- Added mechanical audits:
  - `pnpm audit:physical-preview`
  - `pnpm audit:physical-preview-guard`

G0 locked the authoritative 2D boundary, pure scene package, Three adapter package, no-CAD-kernel decision, no-drei decision, lazy-loading boundary, privileged PNG capture boundary, component-by-component promotion rule, and production exclusion of research fixtures, selectors, registries, benchmark hooks, and forbidden package couplings.

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

## Current G1 scope

G1 must produce realistic scaling evidence before arbitrary-document desktop wiring:

- outlined text-heavy fixtures with many glyph contours;
- materially larger/high-point-count fixtures beyond the research baseline;
- repeated parse, scene-conversion, and Three-conversion timings reported as min, median, p95, and max;
- memory/resource observations sufficient to identify obvious scaling regressions;
- evidence about whether cost is dominated by reused cutability topology work or renderer conversion;
- a decision on whether a narrow topology-only cutability entry point is justified.

If a topology-only entry point is proposed, it must reuse the accepted region-classification algorithm rather than fork it, preserve fail-visible findings, receive a separate architecture decision, and remain optional. G1 does not promote production scene packages, add desktop UI, or begin G2.

## M14 approved execution order

1. **G0 — governance and architecture lock** — complete
2. **G1 — text-heavy scaling evidence** — active
3. **G2 — pure physical scene package promotion**
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
