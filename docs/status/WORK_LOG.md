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
Focused code commit `ea3b61645cc9feb77274c92526e4f467dac866fc`
passed Repository Guard run `30595655590`, Windows push run `30595654053`,
and Windows pull-request run `30595655524`.
- Decisions: no architecture or schema change. Camera state remains
renderer-local, while snap selection remains deterministic domain behavior.
- Known limitations: existing M03 limitations remain unchanged.
- Next allowed work: M04 remains blocked until PR #16 is reviewed, Repository
Guard and both Windows M03 runs pass on the final repair head, and the draft PR
is merged.

## 2026-07-30 — M04 text, fonts, and outline conversion

- Date: 2026-07-30
- Agent/task: Codex / Issue #5 implementation
- Milestone: M04 — Text, Fonts, and Outline Conversion
- Delivered: Secure main-process installed-font discovery; six pinned,
redistributable
bundled families covering stencil, script, serif, slab, western, industrial,
and display categories; path-free catalog IPC; search, categories, favorites,
and recents; editable live text with alignment and letter/word/line spacing;
deterministic Fontkit contour materialization; simple arc text; missing-font
fingerprint warnings with geometry preservation; undoable outline conversion
with optional source metadata; strict schema-v4 persistence and deterministic
v1/v2/v3 migrations; license/provenance CI audit.
- Verification: `pnpm verify`, `pnpm audit:fonts`,
`py -3 scripts/repository_guard.py`, and `git diff --check` pass locally. The
suite contains 82 unit/integration tests and 11 packaged Windows E2E scenarios.
The packaged text workflow creates, edits, arcs, converts, undoes, saves, and
reopens exact materialized contours.
- Decisions: ADR 0012 keeps discovery, bytes, shaping, and contour generation
out of the sandboxed renderer. ADR 0013 records schema v4 and saved
font-fingerprint/materialized-contour semantics.
- Known limitations: Arc text uses a simple deterministic circular warp;
advanced OpenType feature controls, arbitrary path text, embedded font files,
automatic bridging, and node editing remain excluded.
- Next allowed work: review M04 only. Do not merge, close Issue #5, advance to
M05, or begin M05 implementation until final-head Windows CI and review pass.

## 2026-07-31 — M04 review correctness repairs

- Date: 2026-07-31
- Agent/task: Codex / PR #18 blocking review findings
- Milestone: M04 — Text, Fonts, and Outline Conversion
- Delivered: Live text materialization now pauses when the saved font ID and
fingerprint do not exactly match the catalog, with the rule enforced in both
the renderer and main process; explicit substitution remains undoable. Text
objects now project as one even-odd compound SVG path, and domain hit testing
uses the same rule so enclosed counters remain empty. Outline conversion still
preserves every contour.
- Verification: focused geometry, domain, IPC, viewport, and packaged
regressions cover compound counters and same-ID/changed-fingerprint reopen,
selection, explicit substitution, and undo. The complete suite contains 85
unit/integration tests and 12 packaged Windows E2E scenarios.
- Decisions: ADR 0012 now records the explicit substitution boundary and the
shared even-odd compound-fill policy.
- Known limitations: existing documented M04 exclusions remain unchanged.
- Next allowed work: review M04 only after final-head local verification and
GitHub CI pass. Do not merge, close Issue #5, or advance to M05.

## 2026-07-31 — M04 re-review correctness repairs

- Date: 2026-07-31
- Agent/task: Codex / PR #18 blocking re-review findings
- Milestone: M04 — Text, Fonts, and Outline Conversion
- Delivered: Font materialization and schema-v4 contours now preserve a
deterministic glyph-compound index. Viewport projection and hit testing apply
even-odd inside each glyph and union separate glyphs, keeping counters empty
without XOR holes in overlapping script or negatively tracked lettering. The
text form now follows authoritative content/style/arc changes for the same
selected object ID after undo/redo, while an equality guard prevents form
synchronization from creating a redundant live command.
- Verification: focused font, geometry, domain, project-format, viewport, and
packaged regressions cover compound grouping, counter holes, inter-glyph
overlap, lossless outline conversion, same-ID form restoration, stable history,
and a subsequent edit that preserves the undone content/font intent. The full
suite contains 86 unit/integration tests and 13 packaged Windows E2E scenarios.
- Decisions: ADRs 0012–0013 now record per-glyph compound indexing and the
even-odd-within/union-across fill policy.
- Known limitations: existing documented M04 exclusions remain unchanged.
- Next allowed work: review M04 only after final-head local verification and
GitHub CI pass. Do not merge, close Issue #5, or advance to M05.

## 2026-07-31 — M05 node editing and boolean geometry

- Date: 2026-07-31
- Agent/task: Codex / Issue #6 implementation
- Milestone: M05 — Node Editing and Boolean Geometry
- Delivered: Direct node and segment selection, add/delete/move, cubic handles,
  open/close, reverse, split, tolerance-previewed endpoint joins,
  tolerance-bounded simplification, cleanup with self-intersection reporting,
  union/subtract/intersect/XOR, and signed offsets. Closed topology runs through
  a replaceable, integer-micrometer Clipper2 adapter in a cancellable worker;
  stale or canceled results cannot mutate the document. Every topology change
  is one undoable command with before/after node counts, result/replaced IDs,
  warnings, and schema-v5 persistence.
- Verification: `pnpm verify`, `pnpm audit:geometry`,
  `py -3 scripts/repository_guard.py`, and `git diff --check` pass locally. The
  suite contains 108 unit/integration tests and 15 packaged Windows E2E
  scenarios. Golden fixtures cover simple, nested, touching, and one-micrometer
  overlap geometry; packaged tests cover union, direct node/handle editing,
  exact undo/save/reopen, and cancellation with an unchanged document.
- Decisions: ADR 0014 pins `clipper2-ts` 2.0.1-18 behind the engine adapter and
  records its Boost-1.0 license, quantization, worker, and replacement contract.
  ADR 0015 records optional absolute cubic handles and the deterministic v4 to
  v5 project migration. The recorded local baseline is 1.62 ms median for a
  400-rectangle union and 22.32 ms median for a 4,096-node round offset.
- Known limitations: Full trim/extend parity, constraints, fillet/chamfer, CAM
  kerf, nesting, import/export, tracing, cutability, and later milestone work
  remain excluded. Independent golden review and final-head Windows CI remain
  required before merge and status advancement.
- Next allowed work: review M05 only. Keep the implementation PR draft; do not
  merge, close Issue #6, advance to M06, or begin later scope until the review
  and advancement gates pass.
