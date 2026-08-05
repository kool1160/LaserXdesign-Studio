# Current Project Status

## Active gate

**M14 — Production Physical 3D Preview Integration**

- Active issue: #30
- Active milestone specification: `docs/milestones/M14-production-physical-3d-preview.md`
- Implementation lead: Claude
- Independent planning, orchestration, exact-head audit, and acceptance authority: ChatGPT
- Owner authority: product direction and milestone advancement
- Codex: held unless explicitly assigned independent review, repair, comparison, or specialist work
- Current slice: **G6 — exact-head Windows evidence and owner retest**

The owner explicitly advanced G6 on 2026-08-05 after PR #65 merged. G6 is validation and closure evidence, not permission to begin M15 or broaden M14.

`Continue LaserX` authorizes Claude to perform only the bounded G6 evidence and repair work recorded below. `Advance LaserX` is still required before Issue #30 closure or M15 activation.

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

- **G0 — governance and architecture lock** — PR #54, merge `a3481541a7dd246a7c3d8074f6516de09bd5af75`
- **G1 — text-heavy scaling evidence** — PR #55, merge `0a9dd63e31fdc7e15918c8c4651492d9d1ee44ec`
- **G2 — pure physical scene package** — PR #56, merge `e8b10c67d61decd310ccf1d5a7ad76100047babb`
- **G3 — Three renderer adapter** — PR #57, merge `f0769507abfac2c7a999f509fad8ae348de8b86b`
- **G4A — renderer-safe integration foundation** — PR #61, merge `9ca320fe3cb7d82ad2d9c3a458790b7defbfded3`
- **G4B — lazy open-document preview screen** — PR #63, merge `cba0fbba3385f47cf59f4a026823256f91560639`
- **G4C — interaction, fallback, and cleanup** — PR #64, merge `c79f4b1ccce0b54fce26d0cdf1687cc79818f5bb`

### G5 — privileged PNG capture — complete

- PR #65
- Final accepted head: `d34c9cca2b7552551cfcd1efcd6fccd7baaa6a58`
- Exact-head workflows: 13/13 green
- Squash merge: `3f0d8dba70e0c218308d28d1917cd5584c928bd6`
- Owner explicitly authorized merge after the final repair audit; G6 remained separately gated until the owner’s next command.

G5 delivered same-frame RGBA/PNG capture, content- and dimension-bound deterministic naming, typed main-frame-validated Electron IPC, real PNG decoding, decoded-pixel and decompression-bomb limits, blank-image rejection, explicit cancellation/failure, atomic writes, and non-mutation evidence.

## Active G5 scope — completed historical contract

G5 owned the complete privileged PNG capture transaction and is now merged. This heading is retained as a historical contract marker for repository-policy compatibility; it is not the active slice.

G5 did not authorize G6, M15, material-catalog work, export expansion, CAD/CAM, or machine control.

## Active G6 scope

G6 is the only active M14 slice.

Required evidence and validation:

- validate the exact merged `main` state, beginning from G5 merge `3f0d8dba70e0c218308d28d1917cd5584c928bd6` plus any explicitly reviewed G6 repair/evidence commits;
- run the production package and complete packaged Windows E2E suite on the exact reviewed head;
- prove preview code remains lazy-loaded, Three.js stays out of the main editor entry, and no research fixture, lab hook, or experiment payload ships;
- exercise representative real projects, exact dimensions and thickness, front/back/edge/perspective views, assembled/exploded modes, orbit/pan/zoom/reset, keyboard operation, layer visibility, high DPI, WebGL/GPU fallback, context loss, and repeated resource cleanup;
- verify preview and capture remain non-mutating across project geometry, dirty state, history, selection, analysis, save, SVG/DXF, and production-package output;
- create a fresh private Windows installer from the exact accepted head and record provenance;
- stop for owner hands-on validation of preview, manipulation, capture, save, reopen, export, and failure paths;
- perform the exact-head milestone closure audit and record all evidence on Issue #30.

G6 should not add product scope. A concrete defect found during validation receives the smallest bounded repair PR, exact-head regression evidence, and review before validation resumes.

Explicitly excluded: M15 onboarding, M16 material expansion and draft PR #40, process/export profiles, new AI capability, licensing, public beta, Version 1 publication, CAD/CAM, nesting, G-code, and machine control.

## M14 research basis

Issue #34 is accepted at exact head `9a4a90c6fa891ed0d9baf9bc8c99d41b04d54136`.

Issue #42 is accepted at exact head `76fa77a8edeb976b46e8e345a4a232b938768b3f` and remains isolated except for approved current-material presentation behavior.

Issue #39 and draft PR #40 remain isolated inputs for M16 and are not production-merge-authorized during M14.

## M14 approved execution order

1. **G0 — governance and architecture lock** — complete
2. **G1 — text-heavy scaling evidence** — complete
3. **G2 — pure physical scene package** — complete
4. **G3 — Three renderer adapter** — complete
5. **G4 — lazy desktop integration** — complete
   - G4A renderer-safe integration foundation — complete
   - G4B lazy open-document preview screen — complete
   - G4C interaction, fallback, and cleanup — complete
6. **G5 — privileged PNG capture** — complete
7. **G6 — exact-head Windows evidence and owner retest** — active

Full execution rules: `docs/CLAUDE_EXECUTION_PLAN.md` and ADR 0026.

## M14 exit rule

Do not advance to M15 until:

- every M14 acceptance test passes;
- required exact-head workflows are green;
- no blocking finding remains;
- the fresh private installer passes owner hands-on validation;
- Issue #30 is closed;
- the exact merge and evidence are recorded;
- the owner explicitly authorizes M15.

## Later roadmap

M15 through M23 preserve the workflow-first platform direction from Issues #44 and #37. M24 and M25 preserve the post-Version-1 machine-platform path behind explicit safety gates.

## Private-testing boundary

LaserX remains private test software until a later milestone explicitly approves outside distribution. Trusted public signing, publication, pricing activation, and public support do not belong in M14.
