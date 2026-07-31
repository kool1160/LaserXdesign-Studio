# Agent Work Log

Add concise dated entries for substantial work that needs durable handoff beyond commit history.

## Entry template

```text
Date:
Agent/task:
Milestone:
Delivered:
Verification:
Decisions:
Known limitations:
Next allowed work:
```

## 2026-07-30 — M01 desktop shell and project lifecycle

- Date: 2026-07-30
- Agent/task: Codex / Issue #2
- Milestone: M01 — Desktop shell and project lifecycle
- Delivered: Pinned Windows Electron toolchain; secure main/preload/renderer
boundary; blank shell; strict `.laserx` v1; new/open/save/save-as/recents;
dirty protection; autosave/recovery; logging/error boundary; Windows CI package;
unit, integration, packaged smoke, and lifecycle E2E tests.
- Verification: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`,
`pnpm build`, and `pnpm verify` passed; 18 unit/integration and 3 packaged E2E
tests passed; production dependency audit found no known vulnerabilities;
repository guard passed.
- Decisions: ADR 0005 (toolchain/state), ADR 0006 (Electron/IPC security), ADR
0007 (schema/save/recovery).
- Known limitations: Unpublished unpacked smoke package with default icon; one
active recovery snapshot; path-based recents; 10 MB empty-document schema-v1
limit.
- Next allowed work: M02 only, after the M01 PR is merged.

## 2026-07-30 — M02 canonical document model and viewport

- Date: 2026-07-30
- Agent/task: Codex / Issue #3
- Milestone: M02 — Canonical document model and viewport
- Delivered: Exact millimeter document model; inch/millimeter presentation;
stable document/object IDs; line/rectangle/ellipse/path placeholders; Cartesian
coordinate conversion; renderer adapter; pan, pointer zoom, fit, reset, rulers,
grid, preferences, snapping preferences, coordinate readout; schema v2 and
deterministic v1 migration; M01 save-over-existing and startup-state
regressions; packaged Windows and high-DPI coverage.
- Verification: 32 unit/integration tests and 6 packaged Playwright tests pass
locally. Final command-by-command output is recorded in the Issue #3 pull
request.
- Decisions: ADR 0008 (canonical document/viewport boundary) and ADR 0009
(schema-v2 migration).
- Known limitations: Camera position is ephemeral; the renderer covers only
M02 placeholders; hit testing is interface-only; selection, transforms,
layers, editing, import/export, and manufacturing features remain excluded.
- Next allowed work: M03 only after this M02 pull request is reviewed, Windows
CI passes, and the pull request is merged. Until then M03 remains blocked.

## 2026-07-30 — M03 editing core

- Date: 2026-07-30
- Agent/task: Codex / Issue #4
- Milestone: M03 — Selection, transforms, layers, and history
- Delivered: Single/modifier/marquee selection; pointer, keyboard, toolbar, and
inspector command routing; exact move/size/scale/rotate/mirror; transform
handles; duplicate/delete; align/distribute; recursive group/ungroup; layers,
guides, visibility, locking, rename/reorder, and z-order; in-application
copy/paste; basic snapping; bounded transactional undo/redo; schema v3 with
deterministic v1/v2 migrations; complete packaged editing save/reopen workflow.
- Verification: 63 unit/integration tests and 7 packaged Playwright tests pass
locally. Repository Guard and the Windows M03 Editing Core workflow pass on the
published draft. Final command-by-command output is recorded in the Issue #4
pull request.
- Decisions: ADR 0010 (commands, state ownership, affine/ID/history policy) and
ADR 0011 (schema-v3 editing state and migrations).
- Known limitations: 100 full-snapshot history entries; in-application
clipboard only; basic bounds/center snapping; placeholder SVG renderer and
objects only; no M04+ functionality.
- Next allowed work: M04 only after the M03 pull request is reviewed, Windows CI
passes, and the pull request is merged. Until then M04 remains blocked.

## 2026-07-30 — M03 review correctness fixes

- Date: 2026-07-30
- Agent/task: Codex / PR #16 review findings
- Milestone: M03 — Selection, transforms, layers, and history
- Delivered: Signed/zero exact-inspector coordinate conversion and
one-dimensional-safe horizontal/vertical line bounds; one recursive group
`layerId` invariant across schema and internal editing boundaries; canceled
transaction restoration that preserves selection, clipboard/paste metadata,
last-command state, and the pre-existing redo branch.
- Verification: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`,
`pnpm build`, `pnpm verify`, `pnpm audit --prod`,
`py -3 scripts/repository_guard.py`, and `git diff --check` pass locally.
The suite contains 70 unit/integration tests and 8 packaged Playwright tests.
Repository Guard run `30587115678`, Windows push run `30587113232`, and
Windows pull-request run `30587115511` passed on focused code commit
`c923502c6cb71d2ff7ffb7a2ba99dd6678038bbf`.
- Decisions: ADR 0010 now records commit-only redo invalidation and complete
transaction cancellation; ADR 0011 records one recursive group layer identity.
- Known limitations: Exact bounds cannot expand an intrinsically zero axis;
the request is rejected clearly. Schema v3 intentionally has no independent
child-layer semantics inside groups. Existing M03 limitations remain.
- Next allowed work: M04 only after PR #16 is reviewed, both Windows M03 runs
and Repository Guard pass on the review-fix head, and the draft PR is merged.
Until then M04 remains blocked.

## 2026-07-30 — M03 aspect-lock review repair

- Date: 2026-07-30
- Agent/task: Codex / PR #16 follow-up review findings
- Milestone: M03 — Selection, transforms, layers, and history
- Delivered: Aspect-locked inspector sizing now uses the last edited Width or
Height field as its driver. Shift-dragging an east/west or north/south handle
applies one uniform scale factor with the documented opposite-edge and
orthogonal-center pivot. Existing signed/zero inspector and degenerate-line
behavior remains unchanged.
- Verification: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`,
`pnpm test:e2e`, `pnpm verify`, `pnpm audit --prod`,
`py -3 scripts/repository_guard.py`, and `git diff --check` pass locally. The
suite contains 73 unit/integration tests and 9 packaged Playwright tests.
Focused code commit `6341b01be7ffddd9a5dbe062dc34fef5755857cd`
passed Repository Guard run `30593136008`, Windows push run `30593133817`,
and Windows pull-request run `30593136023`.
- Decisions: no architecture or schema change. The existing validated
`objects.set-bounds` and `objects.scale` commands remain authoritative; the
renderer adapter now supplies unambiguous locked-resize intent.
- Known limitations: existing M03 limitations remain unchanged.
- Next allowed work: M04 remains blocked until PR #16 is reviewed, Repository
Guard and both Windows M03 runs pass on the final repair head, and the draft PR
is merged.

## 2026-07-30 — M03 pan and snap review repair

- Date: 2026-07-30
- Agent/task: Codex / PR #16 re-review findings
- Milestone: M03 — Selection, transforms, layers, and history
- Delivered: Alt-drag and middle-button pan gestures now take precedence over
artwork and transform-handle hit testing without changing document, selection,
or history state. Snapping now distinguishes no candidate from an exact
zero-distance match and compares the actual adjustment distance across
non-grid and grid targets.
- Verification: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`,
`pnpm test:e2e`, `pnpm verify`, `pnpm audit --prod`,
`py -3 scripts/repository_guard.py`, and `git diff --check` pass locally. The
suite contains 74 unit/integration tests and 10 packaged Playwright tests.
Final-head Repository Guard and Windows M03 workflows are pending publication.
- Decisions: no architecture or schema change. Camera state remains
renderer-local, while snap selection remains deterministic domain behavior.
- Known limitations: existing M03 limitations remain unchanged.
- Next allowed work: M04 remains blocked until PR #16 is reviewed, Repository
Guard and both Windows M03 runs pass on the final repair head, and the draft PR
is merged.
