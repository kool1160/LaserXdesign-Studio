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
locally. Final command-by-command output is recorded in the Issue #4 pull
request.
- Decisions: ADR 0010 (commands, state ownership, affine/ID/history policy) and
ADR 0011 (schema-v3 editing state and migrations).
- Known limitations: 100 full-snapshot history entries; in-application
clipboard only; basic bounds/center snapping; placeholder SVG renderer and
objects only; no M04+ functionality.
- Next allowed work: M04 only after the M03 pull request is reviewed, Windows CI
passes, and the pull request is merged. Until then M04 remains blocked.
