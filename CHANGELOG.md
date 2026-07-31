# Changelog

All notable project changes will be documented here.

## Unreleased

### Fixed

- Aspect-locked exact sizing now follows the last edited Width or Height field,
  and Shift-dragging any edge transform handle applies one uniform scale factor
  without changing the selection's aspect ratio.
- Exact inspector X/Y conversion now accepts signed finite coordinates,
  including zero, while horizontal and vertical lines can move and resize
  along their nonzero axis without division by zero.
- Schema-v3 groups now enforce one recursive layer identity across parsing,
  serialization, insertion, grouping, duplicate/paste, and layer deletion.
- Canceling an editor transaction now restores transaction-touched session
  state and preserves the existing redo branch.

### Added

- Repository operating contract and product requirements.
- M00–M12 gated delivery plan.
- Monorepo package, desktop, fixture, tool, and documentation scaffold.
- Repository guard and GitHub contribution templates.
- Pinned Node/pnpm/Electron/React/Vite/TypeScript/Vitest/Playwright toolchain and lockfile.
- Secure sandboxed Electron shell with typed validated preload IPC.
- Strict `.laserx` schema version 1 and atomic project persistence.
- New, open, save, save-as, recent-project, dirty-state, autosave, and recovery lifecycle.
- Unit, integration, packaged Windows smoke, and lifecycle end-to-end test coverage.
- Canonical millimeter schema-v2 document model with stable document and
  placeholder-object IDs.
- Exact inch/millimeter document creation and drift-free display-unit
  switching.
- Cartesian SVG viewport with rulers, grid, pan, pointer-preserving zoom, fit,
  reset, snapping preferences, exact coordinate readout, and high-DPI-safe
  measurements.
- Deterministic schema-v1-to-v2 migration with reviewed fixtures.
- Regression coverage for replacing an existing `.laserx` file and retrying a
  rejected initial renderer state request.
- Command-driven M03 editing with single/modifier/marquee selection, exact and
  pointer transforms, handles, align/distribute, duplicate/delete, recursive
  groups, layers, z-order, guides, copy/paste, snapping, keyboard shortcuts, and
  bounded transactional undo/redo.
- Strict schema-v3 persistence for layers, guides, affine transforms, groups,
  locks, visibility, and order, with deterministic v1/v2 migration fixtures.
- Packaged Windows editing save/reopen coverage and renderer boundary
  regressions proving that React does not own or mutate document geometry.
