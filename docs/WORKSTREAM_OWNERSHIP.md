# LaserX Design Studio Workstream Ownership

## Status and authority

This document records the owner's active implementation directive dated **2026-08-04** and supersedes the prior temporary Claude-first ownership assignment.

It supplements `AGENTS.md`, ADR 0025, Issues #44 and #37, `docs/OPERATOR_PROTOCOL.md`, and `docs/status/CURRENT.md`. It does not weaken any milestone gate.

## Current delivery gate

**M14 — Production Physical 3D Preview Integration** is active under GitHub Issue #30 and `docs/milestones/M14-production-physical-3d-preview.md`.

G0 through G3 are complete. G4 is active. M15 and later milestones remain blocked until M14 is implemented, exact-head reviewed, merged, owner-tested, closed, recorded complete, and explicitly advanced.

## ChatGPT implementation and orchestration ownership

ChatGPT is the designated senior software engineer, implementation lead, and project orchestrator while `docs/status/CURRENT.md` records that assignment.

ChatGPT owns:

- translating owner decisions into durable GitHub requirements and status;
- inspecting `main`, active branches, PRs, issues, tests, architecture, and CI;
- defining and implementing the next bounded active-gate slice;
- creating focused branches and reviewable PRs;
- adding regression tests, exact evidence, and documentation tied to behavior;
- repairing implementation or CI findings;
- performing a fresh exact-head review pass before merge;
- merging and recording advancement only after owner command.

ChatGPT must:

- start fresh slices from current `main`;
- keep one active issue and one bounded PR per slice unless the milestone explicitly defines sub-slices;
- preserve authoritative manufacturing geometry and non-mutation boundaries;
- never treat a completion handoff as proof without checking GitHub;
- keep volatile evidence current at the exact head;
- stop before later-milestone work;
- not advance a milestone merely because code exists or CI is green.

## Claude hold and independent-review boundary

Claude is held from default implementation.

Claude may be assigned an independent exact-head review, repair, specialist implementation, or comparison task only when the owner explicitly directs it and the assignment is recorded in `CURRENT.md`, the active issue, or the active PR.

Claude may not begin product work merely from an old `Continue LaserX` instruction or the legacy filename `docs/CLAUDE_EXECUTION_PLAN.md`.

## Codex hold boundary

Codex is held from default product implementation under the same rule. It remains available for an explicit independent repair, audit, comparison, or specialist task.

## Owner authority

The owner controls product direction, milestone order, pricing philosophy, trial policy, and advancement. An exact-head `READY` verdict is necessary but not sufficient for advancement; the owner command remains required.

## M14 physical-preview authority

Accepted research basis:

- Issue #34 at exact head `9a4a90c6fa891ed0d9baf9bc8c99d41b04d54136`;
- Issue #42 at exact head `76fa77a8ed976b46e8e345a4a232b938768b3f`;
- accepted integration recommendation under `docs/experiments/m14-physical-3d-preview/`.

Production direction:

- promote production components individually;
- use `packages/physical-preview-3d/` for the renderer-independent scene contract;
- use `packages/physical-preview-three/` for Three conversion;
- use Three.js plus React Three Fiber in the lazy desktop feature;
- do not add a CAD kernel;
- rewrite production UI against the open document;
- use typed Electron preload/main IPC for PNG save;
- never merge the experiment branch wholesale;
- never ship lab shell, benchmark hooks, fixture registry, or research fixture payloads.

## M14 approved slice order

1. G0 — governance and architecture lock — complete.
2. G1 — text-heavy scaling and topology-cost evidence — complete.
3. G2 — pure physical scene package — complete.
4. G3 — Three renderer adapter — complete.
5. G4 — lazy desktop integration — active.
6. G5 — privileged PNG capture.
7. G6 — exact-head Windows validation and owner retest.

G4 is bounded internally as G4A renderer-safe integration foundation, G4B lazy open-document preview, and G4C interaction/fallback/cleanup. These are implementation slices inside G4, not new milestones.

## G4 performance and ownership contract

Before arbitrary-document preview wiring is accepted:

- expensive scene analysis runs outside the renderer/UI thread;
- results are cached by deterministic scene fingerprint;
- requests support cancellation and stale-result rejection;
- progress is visible and bounded;
- view, mode, and visibility changes do not recompute topology;
- lazy chunk failure, WebGL unavailability, and context loss never block editing or saving;
- renderer-bound production source has no Node-only runtime coupling;
- generated resources have explicit private ownership and bounded cleanup.

## G5 capture ownership

G5 owns same-frame RGBA readback, PNG encoding, binding and validation, deterministic naming, typed IPC, path and overwrite policy, atomic filesystem save, and explicit failure reporting.

G4 exposes the renderer capability required for capture but does not save files or independently claim a validated capture.

## Later workstreams

The roadmap remains authoritative in `docs/MILESTONES.md`. No later workstream becomes active because research, a draft PR, or implementation capacity exists.

Issue #39 and draft PR #40 remain isolated M16 inputs. M14 may use accepted current-material presentation behavior but may not absorb broad catalog/schema expansion.

## Durable operating loop

1. Owner gives ChatGPT a LaserX command.
2. ChatGPT reads live GitHub state and performs the bounded implementation, repair, audit, or advancement requested.
3. Implementation uses a focused branch and draft PR with exact evidence.
4. `Check LaserX` triggers a fresh exact-head review.
5. `Advance LaserX` merges and records only the owner-approved next state after `READY` and unchanged-head verification.
6. Claude or Codex enters only through an explicit recorded assignment.

## Explicit exclusions

No wholesale experiment merge, parallel product milestone, CAD kernel, general-purpose 3D CAD, solid-model export, broad CAM, machine control, licensing work, public beta work, or material-schema expansion belongs in M14 unless the M14 specification explicitly requires it.
