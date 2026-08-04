# LaserX Design Studio Workstream Ownership

## Status and authority

This document records the owner's senior-led delivery directive dated **2026-08-04**.

It supplements `AGENTS.md`, `docs/OPERATOR_PROTOCOL.md`, Issues #44 and #37, and `docs/status/CURRENT.md`. It does not weaken product requirements, architecture decisions, safety boundaries, or milestone gates.

## Durable role model

### Owner

The owner controls:

- product direction;
- milestone order and major scope changes;
- pricing, trial, licensing, and distribution philosophy;
- activation of a new milestone;
- approval of release and machine/safety transitions.

### Senior engineering lead and orchestrator

ChatGPT is the senior engineering lead and project orchestrator unless the owner explicitly changes that assignment.

The senior lead owns:

- repository and product-direction assessment;
- architecture and execution planning;
- deciding the technically correct next work;
- implementation briefs and acceptance criteria;
- assignment of implementation and verification agents;
- integration across branches, packages, issues, and milestones;
- risk classification and review cadence;
- exact-head senior audits at important turning points;
- routine merges inside an already approved active gate;
- checkpoint and milestone advancement under the owner-authorized protocol;
- preventing scope drift, weak architecture, hidden shortcuts, fake success, and excessive governance overhead.

The senior lead does not accept an implementation agent's report as proof without examining code and GitHub evidence.

### Implementation agent

The implementation agent is a role, not a permanent model identity. `docs/status/CURRENT.md` records the current assignment.

Claude is the current default implementation agent for M14 because the owner is using expanded Claude capacity. Codex remains available for explicit assignments. The senior lead may reassign a bounded task when that produces a better engineering result.

The implementation agent must:

- execute only the approved active-gate brief;
- inspect before editing;
- preserve authoritative boundaries;
- add tests and evidence with implementation;
- keep changes focused and reviewable;
- report full branch/head and working-tree state;
- stop for the assigned review level;
- never invent scope, merge without authorization, activate a new milestone, or self-approve critical work.

### Independent verifier

A separate verifier is assigned when critical work requires separation of duties or when the senior lead directly authored load-bearing implementation.

The verifier may be Claude, Codex, another capable model, a human reviewer, or a combination, provided it did not author the load-bearing work under review.

## Review ownership

Review depth follows risk.

### Routine work

The senior lead performs focused review and may integrate routine work inside the active approved gate after exact-head checks and required CI.

### Senior checkpoint work

The senior lead performs and records a full exact-head audit for architecture, major contracts, performance strategy, major workflow integrations, and important false-success repairs.

### Critical work

Independent verification is required for schema/migrations, canonical geometry or manufacturing truth, privileged IPC/filesystem/credentials/signing, capture evidence, release candidates, licensing/payment activation, and machine/safety work.

### Milestone exit

The senior lead performs a full product-direction, architecture, scope, exact-head, CI, and acceptance audit. The owner authorizes advancement.

## Current delivery gate

**M14 — Production Physical 3D Preview Integration** is active under Issue #30 and `docs/milestones/M14-production-physical-3d-preview.md`.

M13 is complete. M15 and later milestones remain blocked until M14 exit criteria are satisfied and the owner explicitly advances the project.

Current M14 mapping:

- Senior engineering lead and orchestrator: ChatGPT
- Implementation agent: Claude
- Independent verifier: assigned by risk; Codex is available but not automatically active
- Active state and exact gate: `docs/status/CURRENT.md`

## M14 authority and boundaries

Accepted research basis:

- Issue #34 at `9a4a90c6fa891ed0d9baf9bc8c99d41b04d54136`;
- Issue #42 at `76fa77a8ed976b46e8e345a4a232b938768b3f`;
- the accepted integration recommendation in `docs/experiments/m14-physical-3d-preview/`.

Production direction:

- promote the pure scene contract component by component;
- use `packages/physical-preview-three/` for renderer conversion;
- use Three.js plus React Three Fiber;
- do not add a CAD kernel;
- rewrite production UI against the open document;
- use typed Electron preload/main IPC for PNG capture and save;
- lazy-load the entire feature;
- do not merge the experiment branch wholesale;
- do not ship the lab shell, benchmark hooks, fixture registry, debug handles, or research payloads.

M14 gate order:

1. G0 — governance and architecture lock.
2. G1 — text-heavy scaling and topology-cost evidence.
3. G2 — pure physical scene package.
4. G3 — Three renderer adapter.
5. G4 — lazy desktop integration.
6. G5 — privileged PNG capture and save.
7. G6 — Windows integration, release evidence, and owner retest.

The senior lead chooses review depth for each gate. G0, G1 decision evidence, G3 renderer contract, G4 integration/performance, G5 privileged capture, and G6 milestone exit are senior or critical checkpoints. Routine repairs inside an accepted gate do not automatically require a new owner command.

## Performance and G4 boundary

G1 established that realistic text-heavy preview cost is dominated by cutability analysis. Before arbitrary-document desktop wiring, G4 must enforce:

- expensive preview analysis off the renderer/UI thread;
- fingerprint-keyed caching;
- cancellation and stale-result rejection;
- visible progress;
- no topology recomputation for camera, view, mode, or layer-visibility changes;
- bounded failure that leaves editing, saving, and export usable.

This is an architecture checkpoint, not optional polish.

## Capture and G5 boundary

G4 owns the renderer, interactive preview, and stable access to the rendered frame.

G5 owns one-transaction capture truth and privileged save:

- obtain encoded PNG bytes and RGBA evidence from the same frame/readback transaction;
- validate capture structure and non-background content;
- build deterministic filenames;
- cross typed, sender-checked preload/main IPC;
- validate paths and overwrite behavior;
- report failures explicitly;
- never grant arbitrary filesystem access to the renderer.

G5 is a critical independent checkpoint.

## Later workstreams

The roadmap remains authoritative in `docs/MILESTONES.md`. No later workstream becomes active merely because research, a branch, or a draft PR exists.

After M15 structural onboarding/workflow work, the senior lead must establish an early private-user validation checkpoint before months of downstream feature expansion. M22 remains final release-wide usability validation, not the first serious discovery of whether the core workflow works.

The long-term platform may support broad flat-cut markets. Version 1 should prove a focused wedge: create or import a flat-cut sign, repair it, assign physical layers, preview it truthfully, and export exact downstream-ready files.

## Material research boundary

Issue #39 and draft PR #40 remain isolated inputs for M16. They are not production-authorized during M14.

Material-aware 3D research may inform current presentation behavior, but M14 must not silently absorb M16 catalog or schema scope.

## Final ownership rule

The owner sets direction. The senior lead handles delivery and orchestration. Implementation agents build bounded work. Independent verification is used where risk demands it. GitHub records the truth.