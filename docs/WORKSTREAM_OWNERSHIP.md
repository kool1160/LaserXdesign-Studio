# LaserX Design Studio Workstream Ownership

## Status and authority

This document records the owner's post-M13 implementation and review directive dated **2026-08-03**.

It supplements `AGENTS.md`, Issues #44 and #37, `docs/OPERATOR_PROTOCOL.md`, and `docs/status/CURRENT.md`. It does not weaken any milestone gate.

## Current delivery gate

**M14 — Production Physical 3D Preview Integration** is the active product milestone under GitHub Issue #30 and `docs/milestones/M14-production-physical-3d-preview.md`.

M13 is complete. M15 and all later milestones remain blocked until M14 is independently audited, merged, closed, recorded complete, and explicitly advanced by the owner.

## Claude implementation ownership

Claude is the designated implementation lead for the active M14 milestone while the owner uses expanded Claude capacity and promotional credit.

Claude may implement only the next bounded M14 slice recorded in:

- `docs/milestones/M14-production-physical-3d-preview.md`;
- `docs/CLAUDE_EXECUTION_PLAN.md`;
- Issue #30;
- the active PR and its review findings.

Claude must:

- start fresh slices from current `main`;
- use one branch, one issue, and one reviewable PR per bounded slice;
- preserve authoritative manufacturing geometry and non-mutation boundaries;
- add tests and exact evidence;
- stop for independent audit;
- never merge, close Issue #30, activate M15, or approve its own work.

Temporary capacity is an execution resource, not product authority. It does not allow speculative scope, duplicate research, parallel future milestones, or broad rewrites.

## ChatGPT planning and audit ownership

ChatGPT is the independent planning, review, merge, and advancement authority for now.

ChatGPT owns:

- translating owner decisions into GitHub requirements, milestones, ADRs, issues, and status;
- defining the next bounded Claude slice;
- exact-head PR review;
- CI, test, migration, architecture, security, scope, and acceptance audits;
- posting detailed findings to GitHub;
- returning `READY`, `REPAIR`, or `BLOCKED`;
- merging and recording advancement only after owner command.

ChatGPT must not treat Claude's report as proof without inspecting GitHub evidence.

## Codex hold boundary

Codex is held from default post-M13 implementation.

Codex may not begin M14 or another product milestone unless the owner explicitly assigns it a task and `docs/status/CURRENT.md` or the active issue records that assignment.

Codex remains available for a future independent repair, comparison, audit experiment, or machine-platform task only after explicit authorization.

## M14 physical-preview authority

The accepted research basis is:

- Issue #34 at exact head `9a4a90c6fa891ed0d9baf9bc8c99d41b04d54136`;
- Issue #42 at exact head `76fa77a8edeb976b46e8e345a4a232b938768b3f`;
- the accepted integration recommendation under `docs/experiments/m14-physical-3d-preview/`.

Production direction:

- promote `packages/physical-preview-3d/` component by component;
- create `packages/physical-preview-three/` for renderer conversion;
- use Three.js plus React Three Fiber;
- do not add a CAD kernel;
- rewrite the production React UI against the open document;
- use typed Electron preload/main IPC for PNG capture;
- lazy-load the entire feature;
- do not merge the experiment branch wholesale;
- do not ship lab shell, benchmark hooks, fixture registry, or research fixture payloads.

## M14 approved slice order

1. G0 — governance, ADR, and repository prerequisites.
2. G1 — text-heavy scaling and topology-cost evidence.
3. G2 — pure scene package promotion.
4. G3 — Three renderer-adapter package.
5. G4 — lazy desktop integration.
6. G5 — privileged PNG capture.
7. G6 — exact-head Windows validation and owner retest.

Claude stops after every slice. ChatGPT audits before the next slice is authorized or merged.

## Later workstreams

The roadmap order is authoritative in `docs/MILESTONES.md`:

- M15 guided onboarding and Learn Mode;
- M16 material catalog and wood/acrylic expansion;
- M17 process-aware manufacturability;
- M18 downstream export profiles;
- M19 optional AI idea-to-cuttable onboarding;
- M20 licensing, trial, and purchase;
- M21 community beta readiness;
- M22 real-user usability validation;
- M23 Version 1.0 release and launch;
- M24 simulator-first machine platform;
- M25 first approved controller vertical slice.

No later workstream is active merely because research or a draft PR exists.

## Material research boundary

Issue #39 and draft PR #40 remain isolated inputs for M16. They are not production-merge-authorized during M14.

Material-aware 3D research from Issue #42 may inform M14's current supported appearances and M16's broader truth model, but M14 must not silently absorb the M16 schema/catalog scope.

## Durable operating loop

1. Owner sends Claude `Continue LaserX`.
2. Claude implements or repairs one approved slice and stops.
3. Owner sends ChatGPT `Check LaserX`.
4. ChatGPT posts findings to GitHub.
5. Claude repairs on `REPAIR`.
6. Owner sends ChatGPT `Advance LaserX` on `READY`.
7. ChatGPT merges and records only the owner-approved next state.

## Explicit exclusions

No wholesale experiment merge, parallel product milestone, CAD kernel, general-purpose 3D CAD, solid-model export, broad CAM, machine control, licensing work, public beta work, or material-schema expansion belongs in M14 unless the M14 specification explicitly requires it.
