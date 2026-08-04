# M14 Implementation Agent Execution Plan

> The filename is retained for repository compatibility. The durable role is **implementation agent**. Claude is the current M14 assignment; ChatGPT is the senior engineering lead and orchestrator.

## Purpose

Use the assigned implementation agent to accelerate approved M14 work without allowing model capacity, agent preference, research branches, or local momentum to redefine LaserX direction.

Issues #44 and #37 define the product lens. `docs/status/CURRENT.md` defines the active gate. `AGENTS.md`, `docs/OPERATOR_PROTOCOL.md`, and `docs/WORKSTREAM_OWNERSHIP.md` define engineering authority and review cadence.

## Role split

### Senior engineering lead

The senior lead:

- inspects the live repository and chooses the correct next work;
- writes the execution brief;
- defines scope, allowed paths, acceptance criteria, non-goals, and verification;
- decides whether review is routine, senior checkpoint, or critical independent checkpoint;
- verifies implementation claims against code and GitHub evidence;
- integrates routine work inside the active approved gate;
- performs exact-head audits at important turning points;
- advances gates or milestones under the owner-authorized protocol.

### Implementation agent

The implementation agent receives one bounded brief and must:

- work from current `main` on a fresh branch unless repairing an existing PR;
- stay inside the active gate and listed exclusions;
- inspect neighboring architecture before editing;
- implement a complete reviewable result;
- add regression tests and evidence;
- run required local verification;
- push exact-head state to GitHub;
- report branch, full SHA, working-tree state, CI, work, and blockers;
- never merge, invent roadmap scope, activate a later milestone, or self-approve critical work.

Claude is the current M14 implementation assignment. Codex may be assigned a bounded implementation, repair, comparison, or independent-verification task by the senior lead or owner.

## Capacity rules

Use expanded implementation capacity for durable active-milestone value:

- active-gate implementation;
- regression coverage;
- difficult root-cause analysis;
- architecture required by the current gate;
- performance work justified by measurements;
- exact evidence tied to shipped behavior.

Do not spend it on:

- duplicate accepted research;
- speculative future infrastructure;
- broad repository cleanup unrelated to the active gate;
- rewriting stable packages without measured need;
- self-review presented as independent approval;
- parallel production milestones;
- large unsliced requests such as `make LaserX production ready`.

## M14 gate queue

### G0 — governance and architecture lock — complete

- production physical-preview ADR;
- package boundaries;
- no CAD kernel;
- lazy-loading and privileged-capture design;
- mechanical research-exclusion guards.

Review level: senior architecture checkpoint.

### G1 — text-heavy scaling evidence — complete

- realistic text and high-point fixtures;
- parse, analysis, scene, and Three-conversion measurements;
- fail-closed ambiguity evidence;
- decision on preview-specific analysis strategy.

Review level: senior evidence checkpoint because results determine G4 architecture.

### G2 — pure physical scene package — complete

- renderer-independent scene and assembly contract;
- exact thickness, order, holes, findings, determinism, and immutability;
- no research loaders, debug hooks, or bundled payloads.

Review level: senior contract review. Small follow-up repairs may be routine unless manufacturing truth changes.

### G3 — Three renderer adapter package — active until merged

- `packages/physical-preview-three/`;
- shape/hole extrusion;
- camera poses and solved fit;
- presentation-only materials;
- capture-validation primitives;
- source-linked failure and resource cleanup;
- renderer-safe package boundaries.

Review level: senior checkpoint. Exact reviewed head must be recorded before merge.

G3 does not include React/R3F desktop UI, Electron IPC, worker wiring, WebGL fallback UI, privileged save, material-catalog promotion, G4, or M15 work.

### G4 — lazy desktop integration

Required result:

- production preview screen against the currently open document;
- front, back, edge, perspective, assembled, exploded, orbit, pan, zoom, reset, and layer visibility;
- exact dimensions and truthful partial/unavailable states;
- no project mutation, dirty-state change, history change, save change, analysis change, or export change from preview interaction;
- lazy-loaded preview chunk with a bounded loading/failure state;
- WebGL unavailable and context-loss behavior that leaves normal editing usable.

Mandatory measured-performance architecture:

- expensive scene/cutability work off the renderer/UI thread;
- fingerprint-keyed cache;
- cancellation and stale-result rejection;
- visible progress;
- coalescing/debouncing of rapid document changes;
- no topology recomputation for camera, view, mode, visibility, or ordinary orbit controls;
- disposal on project change, preview close, retry, and context loss;
- representative text-heavy evidence, including real render/GPU and draw-call behavior rather than CPU conversion alone.

Renderer-safety hardening before wiring:

- production renderer-bound source must not rely on Node-only globals or `node:` imports;
- production and test TypeScript environments should not hide renderer coupling;
- resource collections exposed to the UI should be readonly while internal disposal ownership remains private.

Review level: senior architecture and user-workflow checkpoint. A separate verifier is required for any load-bearing portion directly authored by the senior lead.

### G5 — one-transaction capture and privileged PNG save

G4 supplies stable renderer/frame access. G5 owns the complete capture transaction:

- obtain PNG bytes and RGBA evidence from the same rendered frame/readback transaction;
- validate PNG structure, dimensions, non-background content, and deterministic filename;
- implement typed preload/main IPC;
- validate sender, path, filename, overwrite, and failure behavior;
- keep arbitrary filesystem access out of the renderer;
- prove capture and save do not mutate the project or block editing;
- surface failures explicitly.

Review level: critical independent checkpoint because this crosses capture-evidence and filesystem trust boundaries.

### G6 — Windows integration and milestone closure evidence

- exact-head production build and Windows E2E;
- lazy-bundle proof and research-payload exclusion;
- high-DPI, keyboard, context loss, GPU fallback, cleanup, and representative-project evidence;
- private-test installer;
- owner hands-on validation;
- M14 exit record.

Review level: critical independent milestone-exit checkpoint. Owner authorization is required to advance to M15.

## Delivery loop

1. Owner uses `Continue LaserX` with the senior engineering lead.
2. Senior lead inspects current truth and writes the next brief.
3. Implementation agent implements or repairs the brief and pushes exact-head evidence.
4. Senior lead applies the review level required by the gate.
5. Routine work may be integrated without returning the owner to a courier loop.
6. Checkpoint work receives a recorded exact-head verdict.
7. Critical or milestone transitions stop for owner authorization.

## Handoff contract

```text
LaserX M14 G# — AWAITING_REVIEW | REPAIRING | BLOCKED
PR: #__
Branch: <branch>
Head: <full SHA>
Working tree: clean | dirty: <summary>
CI: green | failing | running
Work: <one-sentence result>
Blocker: none | <one-sentence blocker>
```

PR bodies describe stable scope. Exact-head test/CI evidence belongs in a current PR comment or generated check.

## Later milestones

A new execution plan is written before each later milestone. Agent assignment may change. Temporary model capacity never authorizes parallel production milestones or alters the roadmap.

After M15 structural workflow/onboarding work, schedule an early private-user validation checkpoint before committing months to M16–M19 assumptions. M22 remains final release-wide usability validation, not the first serious test of the core workflow.