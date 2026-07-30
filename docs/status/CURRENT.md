# Current Project Status

## Active gate

**M02 — Canonical document model and viewport**

M02 is the next allowed implementation milestone after the M01 pull request is
merged. Do not add M02 work to the M01 branch.

## State

M01 is complete on verification commit
`052000614281f3c304c45fe37ece8113e8439165`. The complete M01 acceptance suite
passed on Windows on 2026-07-30. The pull request and CI must preserve that
result before merge.

M00 remains complete on `main` in commit
`683a0aff72671a76b1e5ac7b366069d4cd0a29d2`.

## M01 completion record

- [x] Compatible maintained toolchain versions selected and pinned.
- [x] pnpm lockfile committed.
- [x] Secure sandboxed Electron main/preload/renderer boundary implemented.
- [x] Typed, runtime-validated IPC allowlist implemented.
- [x] Blank Windows desktop shell, menus, logging, and error boundary implemented.
- [x] `.laserx` schema version 1 and reviewed fixtures committed.
- [x] New/open/save/save-as/recent/dirty lifecycle implemented.
- [x] Autosave and interrupted-session recovery implemented without overwriting explicit saves.
- [x] Unit, integration, packaged smoke, and lifecycle end-to-end tests pass.
- [x] Windows unpacked smoke package is produced and uploaded by CI.
- [x] ADRs 0005–0007 accepted.
- [x] Known limitations documented in `docs/status/RISKS.md`.
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`,
  `pnpm build`, and `pnpm verify` pass.

## M02 objective

Deliver the canonical millimeter document model and stable 2D viewport: exact
document size, unit switching, Cartesian-to-screen conversion, grid, rulers,
pan, zoom, fit-to-view, snapping preferences, coordinate readout, and the
minimal placeholder objects needed to prove the model.

Read `docs/milestones/M02-document-viewport.md` before starting.

## Allowed next work

- canonical document dimensions and settings in millimeters;
- stable schema-ready object base types and IDs;
- Cartesian domain coordinates and tested renderer conversion;
- viewport pan, zoom, fit/reset, rulers, grid, snapping settings, and exact readout;
- minimal line/rectangle/ellipse/path placeholders required to prove the model;
- serialization/migration, unit, coordinate, viewport, high-DPI, and end-to-end coverage.

## Not allowed yet

Do not implement M03 editing/selection, production text/fonts, boolean geometry,
SVG/DXF conversion, raster tracing, cutability, sign generators, AI, layered
export, CAM, G-code, or DWG.
