# Current Project Status

## Active gate

**M07 — PNG/JPEG Preprocessing and Vector Tracing**

M06 merged through PR #21 in merge commit
`d38832446ce43df4c5fb2c620ee70fa556de056e` after final review of exact feature
head `f9fb69f298580d3346414d445c94c4654a5c177e`. Issue #7 is closed. M07 is now
the only active implementation milestone; Issue #8 is the active delivery gate.

Start M07 from current `main` in a new working directory and branch
`feat/m07-raster-tracing`. Do not reuse the M06 feature branch or worktree.

Before implementation, read:

1. `AGENTS.md`
2. `docs/OPERATOR_PROTOCOL.md`
3. `docs/status/CURRENT.md`
4. `docs/milestones/M07-raster-tracing.md`
5. `docs/ARCHITECTURE.md`
6. `docs/UNITS_AND_COORDINATES.md`
7. `docs/FILE_FORMATS.md`
8. `docs/TESTING.md`
9. ADRs 0014–0016

## M06 completion record

- [x] PR #21 reviewed and merged.
- [x] Issue #7 closed as completed.
- [x] Final reviewed head: `f9fb69f298580d3346414d445c94c4654a5c177e`.
- [x] Merge commit: `d38832446ce43df4c5fb2c620ee70fa556de056e`.
- [x] Repository Guard run `30646696884` passed on the final head.
- [x] Windows M06 push run `30646693131` and pull-request run
  `30646696905` passed on the final head; M04 and M05 regression runs
  `30646696893` and `30646696805` also passed.
- [x] The final suite records 160 unit/integration tests and 18 packaged Electron
  E2E tests.
- [x] Safe SVG/DXF import, explicit physical units, non-destructive preview,
  one-command commit/undo, layer mapping, closure preservation, explicit
  unitless-DXF assumptions, and millimeter SVG/DXF export are complete and
  reviewed.
- [x] World-space 0.01 mm curve tolerance, bounded 200,000-point DXF expansion,
  tiny-circle validity, and independent 600 mm and 24 inch/609.6 mm downstream
  coordinate/bounds inspection were reviewed on the final head.
- [x] No M07+ raster preprocessing, vector tracing, cutability analysis, or AI
  functionality was included in M06.

## Prior milestones

M05 was merged through PR #20 in merge commit
`27cfe2b0c2ae8fcfe365ee2338ad65e764c2de08`. The final reviewed feature head
was `48a8519223dbce8438e89397ed40ddad9ec6423f`.

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

## M07 user-visible outcome

Users can import a logo or sign photograph, clean it visually, trace it into
manageable vector paths, compare results, and continue editing.

## Allowed M07 work

- safe bounded PNG/JPEG import;
- crop, rotate, grayscale, contrast, threshold, invert, blur/denoise, and
  background controls required for tracing;
- black/white and edge previews;
- a replaceable trace-engine adapter with license review;
- deterministic detail presets plus explicit threshold/tolerance controls;
- speckle/island filtering with reported thresholds and removed content;
- smoothing and tolerance-bounded simplification;
- node-count and smallest-feature summaries;
- original-versus-trace overlay;
- cancellable worker execution with progress;
- insertion of accepted results as editable objects through one command;
- reviewed clean-logo, noisy-photo, anti-aliased-text, and high-resolution
  fixtures;
- persistence, invariant, golden-fixture, integration, and packaged Windows E2E
  coverage required by the milestone.

## Explicitly excluded

Do not implement a general photo editor, perfect semantic logo reconstruction,
font identification, an automatic cut-ready claim, bridge/repair tools,
production-layer export, AI generation, CAM, G-code, or DWG.

## M07 exit rule

Do not advance to M08 until every acceptance test and exit item in
`docs/milestones/M07-raster-tracing.md` passes, the M07 pull request is reviewed,
required Windows CI is green, the pull request is merged, Issue #8 is closed,
and this file records the verified merge commit.

## M07 implementation record

- [x] Safe bounded PNG/JPEG inspection and main-process decode are implemented;
  source paths, source bytes, and decoded pixels stay outside the renderer.
- [x] Deterministic preprocessing, trace presets, exact speckle reporting,
  smoothing, and tolerance-verified simplification run in a cancellable worker
  with progress, a whole-operation 30-second deadline, hard pixel/edge/node
  caps, operation-aware cleanup, atomic publication, and stale result rejection.
- [x] Original, black/white, edge, trace, and aligned-overlay previews remain
  non-mutating until one `objects.import` command accepts ordinary editable
  schema-v5 paths; rejection and cancellation preserve project and history.
- [x] Accepted paths immediately enter the standard cutability-analysis
  boundary and receive a settings-required warning rather than a cut-ready
  claim.
- [x] Four committed real-PNG exact goldens, a committed real-JPEG native-decode
  scenario, persistence/invariant/integration coverage, and packaged Windows
  raster-to-editable/save/undo scenarios pass locally.
- [ ] Independent review, required exact-head Windows CI, merge, Issue #8
  closure, and M08 advancement remain pending.
