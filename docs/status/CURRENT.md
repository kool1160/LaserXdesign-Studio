# Current Project Status

## Active gate

**M03 — Selection, transforms, layers, and history**

M02 is merged and closed. M03 is now the only active implementation milestone.
Start M03 from current `main`; do not reuse the M02 feature branch or working directory.

## State

M02 was merged through PR #15 in commit
`735c3ce658313a5c8ca35be3c95f0d70021d8c11` after review, Repository Guard,
and the Windows M02 Document Viewport workflow passed on the reviewed merge ref.

The final reviewed M02 head was
`1b9bd6623a0e2fdcd38523b4d9e91418d5beb39e`. It includes deterministic
coordination preventing an older in-flight autosave from recreating stale recovery
after Save, New, Open, or close-discard.

M01 was merged through PR #14 in commit
`7a534e9a5424a8dfd17107f398dcd15332720f3f`. M00 remains complete in commit
`683a0aff72671a76b1e5ac7b366069d4cd0a29d2`.

## M02 completion record

- [x] Exact 24 in × 12 in stores as 609.6 mm × 304.8 mm.
- [x] Exact 600 mm × 300 mm stores canonically without conversion.
- [x] Display-unit switching is presentation-only and drift-free.
- [x] Stable document/object IDs and minimal line/rectangle/ellipse/path types are independent of React.
- [x] Cartesian positive-Y-up conversion and inverse are directly tested to `1e-9 mm`.
- [x] Pan, pointer-preserving zoom, reset, empty/populated fit, rulers, grid, snapping preferences, and exact readout are implemented.
- [x] Forced 2× packaged Windows coverage confirms DPI-independent physical measurements.
- [x] Schema v2 is deterministic; schema-v1 migration and rejection fixtures are reviewed.
- [x] Save/reopen preserves dimensions, units, preferences, IDs, and objects.
- [x] Existing-project replacement and visible retryable initial-state failure regressions are covered.
- [x] Autosave/recovery ordering is deterministic across Save, New, Open, canceled replacement, and close-discard.
- [x] 37 unit/integration tests and 6 packaged Electron E2E tests pass.
- [x] ADRs 0008–0009 and M02 architecture, unit, format, testing, risk, fixture, screenshot, changelog, and work-log documentation are complete.
- [x] PR #15 reviewed and merged; Issue #3 closed.

## M03 objective

Deliver the first complete editing core: deterministic selection, transforms, grouping,
layers, copy/paste, snapping, align/distribute, and bounded undo/redo history while
preserving canonical geometry, stable IDs, and project-format compatibility.

Read `docs/milestones/M03-editing-core.md` before starting.

## Allowed next work

- single, multi, marquee, and modifier-key selection;
- move, exact position, exact size, scale, rotate, mirror, duplicate, and delete;
- transform handles and inspector entry;
- aspect-ratio locking;
- align and distribute;
- group and ungroup;
- layers, visibility, locking, rename, reorder, and z-order;
- deterministic command history, transactions, undo/redo, and history limits;
- keyboard shortcuts and in-application copy/paste;
- basic snapping to grid, guides, bounds, and centers;
- schema migration, persistence, fixtures, unit/integration, and packaged E2E coverage required by M03.

## Not allowed yet

Do not implement production text/fonts, node editing, topology-changing booleans,
offsets, SVG/DXF import/export, raster tracing, cutability, bridges, sign generators,
AI, layered export, CAM, G-code, or DWG.

## M03 exit rule

Do not advance to M04 until every acceptance test and exit item in
`docs/milestones/M03-editing-core.md` passes, the M03 pull request is reviewed,
Windows CI is green, the pull request is merged, and this file records the verified
completion commit.
