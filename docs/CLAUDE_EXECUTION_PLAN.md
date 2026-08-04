# Claude Execution Plan

## Purpose

Keep LaserX moving through one bounded, reviewable active-gate slice at a time while preventing agent handoff drift, speculative scope, and stale evidence.

Issues #44 and #37 determine product direction. `docs/status/CURRENT.md` determines the active milestone, slice, and implementation owner.

## Current role split

### Claude

Claude is the active implementation agent while `docs/status/CURRENT.md` records that assignment under ADR 0026.

Claude must:

- inspect current `main`, active issues, open PRs, neighboring code, tests, and accepted ADRs before editing;
- implement only the active bounded slice recorded in `CURRENT.md`;
- use a focused branch and reviewable PR;
- add regression coverage and exact-head evidence with the implementation;
- distinguish implementation evidence from acceptance judgment;
- push exact-head evidence and stop at `AWAITING_REVIEW`, `REPAIRING`, or `BLOCKED`;
- never merge, close the milestone issue, activate the next gate, or approve its own work;
- keep GitHub status, issues, PR evidence, and code synchronized.

### ChatGPT

ChatGPT is the senior software engineer, project orchestrator, exact-head auditor, and acceptance authority under ADR 0026.

ChatGPT performs a fresh exact-head review before merge, merges routine work inside the active gate, performs the deep senior audit at turning points, assigns independent verification at critical checkpoints, and merges or advances only after the owner's explicit command.

### Codex

Codex is held by default. It remains available for explicit independent audit, repair, comparison, or specialist work.

### Owner

The owner controls product direction, milestone order, and advancement. No code or green CI advances a milestone without the owner's command.

## Evidence rules

Every implementation PR records:

- exact base and head SHAs;
- current changed-file count;
- focused and root test results;
- required CI on the final head or reviewed merge ref;
- unresolved findings and limitations;
- what later-gate work was deliberately excluded.

PR bodies contain stable scope and architecture. A final exact-head comment or review contains volatile evidence. A handoff is never proof by itself.

## M14 implementation queue

M14 is implemented component by component from current `main`. The accepted experiment branch is never merged wholesale.

### Slice G0 — governance and architecture lock — complete

- production preview ADR;
- package boundaries;
- no CAD kernel;
- lazy-loading and privileged capture decisions;
- mechanical production exclusions.

### Slice G1 — text-heavy scaling evidence — complete

- realistic outlined-text and high-point-count evidence;
- full ambiguity preservation;
- measured requirement for worker offload, fingerprint caching, progress, and cancellation.

### Slice G2 — pure physical scene package — complete

- renderer-independent scene and assembly contract;
- exact thickness, physical order, holes, cutouts, findings, determinism, and immutability;
- fail-closed behavior and renderer-safe boundaries.

### Slice G3 — Three renderer adapter package — complete

- deterministic Three geometry and placement;
- solved camera fit;
- current-material appearance;
- content-bound capture validation helpers;
- source-attributed exception safety and bounded resource cleanup.

### Slice G4 — lazy desktop integration — active

G4 is divided into bounded implementation sub-slices.

#### G4A — renderer-safe integration foundation — active

- remove Node-only runtime fallback and Node global typing from renderer-bound adapter source;
- expose readonly resource collections while preserving private disposal ownership;
- define the worker message and result contract for preview scene construction;
- cache results by a deterministic **physical-content** key — topology, geometry, material, thickness, stock, spacing — kept separate from the requesting project-snapshot identity, so an unrelated project update cannot invalidate a valid cache entry and a cache hit never returns stale snapshot identity or fingerprint evidence;
- coalesce identical in-flight requests instead of restarting them, while preserving per-caller cancellation;
- provide cancellation and stale-result rejection;
- preserve progress reporting;
- prove camera, mode, and visibility changes do not trigger topology recomputation;
- prove an actual unrelated, non-physical project update reuses cached topology/geometry and returns identity matching the newer snapshot;
- no production preview screen yet except the smallest harness required to prove the contract.

#### G4B — lazy open-document preview screen — held

- lazy-load the full preview feature and Three/R3F chunk only when opened;
- consume the current open document through an immutable snapshot;
- show bounded loading, progress, empty, partial, failed, and unavailable states;
- render exact thickness, holes, layer order, assembled/exploded placement, and exact readouts;
- leave project geometry, dirty state, selection, history, analysis, save, and exports unchanged.

#### G4C — interaction, fallback, and cleanup — held

- front, back, edge, perspective;
- assembled, exploded, orbit, pan, zoom, reset;
- presentation-only layer visibility;
- keyboard and high-DPI behavior;
- WebGL-unavailable state and runtime context-loss recovery;
- listener, geometry, material, worker, and renderer cleanup;
- screenshots and packaged desktop evidence;
- prove editing and saving remain usable when preview rendering fails.

### Slice G5 — privileged PNG capture — held

G5 owns the entire capture transaction:

- obtain RGBA evidence and encoded PNG from the same rendered frame/readback;
- validate structure, dimensions, content, and deterministic name;
- cross a typed, sender-checked preload/main IPC boundary;
- validate path and overwrite policy;
- write atomically and report failures explicitly;
- preserve project state and normal editing.

G4 may expose renderer access required by G5, but it does not write files or claim capture success.

### Slice G6 — exact-head Windows evidence and owner retest — held

- production package and Windows E2E;
- lazy-bundle proof and absence of research payloads;
- representative real projects, high DPI, keyboard, GPU fallback, context loss, and resource cleanup;
- fresh private installer for owner validation;
- exact evidence and milestone closure audit.

## Operating loop

1. Owner gives Claude a project command such as `Continue LaserX` or `Repair LaserX`.
2. Claude reads the live GitHub state and performs the requested implementation or repair within the active boundary, then stops at a draft PR with exact evidence.
3. ChatGPT performs routine exact-head verification and merges inside the active gate, or `Check LaserX` triggers a deep senior audit at a turning point.
4. `Advance LaserX` is valid only after a `READY` verdict, unchanged-head verification, green required CI, and owner authorization.

## Restraint

Do not spend implementation capacity on duplicate research, speculative future infrastructure, broad cleanup unrelated to the active slice, wholesale experiment merges, or later-milestone work. One complete vertical result beats a large half-integrated rewrite.
