# Current Project Status

## Active gate

**M02 — Canonical document model and viewport (review gate)**

The complete M02 implementation and local acceptance suite are ready for
review. M02 remains the active gate until its pull request is reviewed, Windows
CI passes, and the pull request is merged. **M03 is blocked until all three
conditions are satisfied.**

## State

M02 is implemented on `feat/m02-document-viewport` from latest `main`. The user
can create exact-size inch or millimeter documents, change presentation units
without changing canonical geometry, and navigate the Cartesian viewport using
rulers, grid, pan, pointer-preserving zoom, reset, and fit-to-view. Schema-v2
projects preserve IDs, dimensions, objects, display/viewport preferences, and
schema-v1 compatibility through deterministic migration.

M01 was merged through PR #14 in commit
`7a534e9a5424a8dfd17107f398dcd15332720f3f`. M00 remains complete on `main` in
commit `683a0aff72671a76b1e5ac7b366069d4cd0a29d2`.

## M02 local completion record

- [x] Exact 24 in × 12 in stores as 609.6 mm × 304.8 mm.
- [x] Exact 600 mm × 300 mm stores canonically without conversion.
- [x] Display-unit switching is presentation-only and drift-free.
- [x] Stable document/object IDs and minimal line/rectangle/ellipse/path types
  are independent of React.
- [x] Cartesian positive-Y-up conversion and inverse are directly tested to
  `1e-9 mm`.
- [x] Pan, pointer-preserving zoom, reset, empty/populated fit, rulers, grid,
  spacing preferences, snapping preferences, and exact readout are implemented.
- [x] Forced 2× packaged Windows coverage confirms DPI-independent physical
  measurements.
- [x] Schema v2 is deterministic; schema-v1 migration and rejection fixtures
  are reviewed.
- [x] Save/reopen preserves dimensions, units, preferences, IDs, and objects.
- [x] M01 regressions cover replacement of an existing `.laserx` and a visible,
  retryable initial `getState()` failure.
- [x] Unit, integration, packaged smoke, lifecycle, migration, and viewport E2E
  tests pass locally.
- [x] ADRs 0008–0009 and M02 architecture, unit, file-format, test, risk,
  fixture, screenshot, changelog, and work-log documentation are updated.
- [ ] Pull request review complete.
- [ ] Windows CI green on the published M02 head.
- [ ] Pull request merged.

## Allowed next work

Before merge, only M02 review fixes, test hardening, CI fixes, and documentation
corrections are allowed.

After review, green Windows CI, and merge, M03 may begin from the then-latest
`main` in a new working directory and branch.

## Not allowed yet

Do not implement M03 selection, handles, transforms, grouping, or layers. Do not
implement production text/fonts, node editing, booleans, offsets, SVG/DXF
import/export, raster tracing, cutability, bridges, sign generators, AI,
layered export, CAM, G-code, or DWG.
