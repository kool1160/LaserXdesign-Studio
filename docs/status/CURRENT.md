# Current Project Status

## Active gate

**M06 — Dimensionally Correct SVG and DXF Interoperability**

M05 merged through PR #20 in merge commit
`27cfe2b0c2ae8fcfe365ee2338ad65e764c2de08` after final review of exact feature
head `48a8519223dbce8438e89397ed40ddad9ec6423f`. Issue #6 is closed. M06 is now
the only active implementation milestone; Issue #7 is the active delivery gate.

Start M06 from current `main` in a new working directory and branch
`feat/m06-svg-dxf`. Do not reuse the M05 feature branch or worktree.

Before implementation, read:

1. `AGENTS.md`
2. `docs/OPERATOR_PROTOCOL.md`
3. `docs/status/CURRENT.md`
4. `docs/milestones/M06-svg-dxf.md`
5. `docs/ARCHITECTURE.md`
6. `docs/UNITS_AND_COORDINATES.md`
7. `docs/FILE_FORMATS.md`
8. `docs/TESTING.md`
9. ADRs 0014–0015

## M05 completion record

- [x] PR #20 reviewed and merged.
- [x] Issue #6 closed as completed.
- [x] Final reviewed head: `48a8519223dbce8438e89397ed40ddad9ec6423f`.
- [x] Merge commit: `27cfe2b0c2ae8fcfe365ee2338ad65e764c2de08`.
- [x] Repository Guard run `30634545722` passed on the final head.
- [x] Windows M05 push run `30634543661` and pull-request run
  `30634545635` passed on the final head; M04 regression run `30634545664`
  also passed.
- [x] The final suite records 118 unit/integration tests and 17 packaged Electron
  E2E tests.
- [x] Direct node/segment editing, cubic handles, join/split/reverse,
  tolerance-bounded simplify and controls-aware cleanup, closed-path booleans,
  signed offsets, worker cancellation, exact undo, and schema-v5 persistence
  are complete and reviewed.
- [x] Selection-order Subtract semantics, same-layer topology ownership,
  world-millimeter tolerances, curved joins, handled cleanup safety, and the
  boolean/offset golden fixtures were independently reviewed on the final head.
- [x] No M06+ SVG/DXF interoperability, raster tracing, cutability, or export
  functionality was included in M05.

## Prior milestones

M04 was merged through PR #18 in merge commit
`ae693b6ff9f37a7cfdd42095d2b891b64b69fe4b`. The final reviewed feature head
was `a08a7afb062954782266ec572b895b21fd556b66`.

M03 was merged through PR #16 in merge commit
`e35881d57a7067c075e0f256663e1608c6e4631e`. The final reviewed feature head
was `1e40fc3ad1e865ab79df89c76a50fe6848352115`.

M02 was merged through PR #15 in commit
`735c3ce658313a5c8ca35be3c95f0d70021d8c11`. The final reviewed feature head
was `1b9bd6623a0e2fdcd38523b4d9e91418d5beb39e`.

M01 was merged through PR #14 in commit
`7a534e9a5424a8dfd17107f398dcd15332720f3f`. M00 remains complete in commit
`683a0aff72671a76b1e5ac7b366069d4cd0a29d2`.

## M06 user-visible outcome

Users can import practical SVG/DXF artwork and export files that downstream CAM
opens at the intended physical size with clean 2D geometry.

## M06 implementation under review

- Draft PR: #21, `feat/m06-svg-dxf` into `main`.
- Complete implementation commit: `12ae86f7c90554f33bd1529a142a8feabf6a7b2a`.
- Local gate: `pnpm verify`, production audit, repository guard, and diff check
  pass; 149 unit/integration tests and 18 packaged Electron E2E scenarios pass.
- Independent inspection: pinned MIT `dxf-parser` verifies representative DXF
  millimeter units, entity type, and closed shape flag without using the
  production parser.
- State: awaiting review and exact-head GitHub checks. Do not merge, close Issue
  #7, advance this file to M07, or begin M07 work from `Continue LaserX`.

## Allowed M06 work

- safe SVG import with supported-element warnings;
- SVG export with explicit physical dimensions and viewBox;
- transform normalization;
- a fixture-driven DXF 2D import/export subset suitable for common plasma and
  laser CAM;
- lines, polylines, closed polylines, circles/arcs, and an explicit curve
  flattening policy where supported;
- layer mapping, unit metadata, and explicit scale handling;
- unsupported-entity reporting;
- import preview with non-destructive commit;
- round-trip and independently inspected downstream fixtures;
- export summaries with object counts, warnings, units, and bounds;
- persistence, invariant, scale-golden, integration, and packaged Windows E2E
  coverage required by the milestone.

## Explicitly excluded

Do not implement native DWG, 3D DXF entities, CAM operations, splines without a
proven conversion policy, unsupported styling disguised as cut geometry,
raster tracing, cutability decisions, layered production export, AI generation,
or G-code.

## M06 exit rule

Do not advance to M07 until every acceptance test and exit item in
`docs/milestones/M06-svg-dxf.md` passes, the M06 pull request is reviewed,
required Windows CI is green, the pull request is merged, Issue #7 is closed,
and this file records the verified merge commit.
