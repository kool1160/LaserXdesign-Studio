# Testing Strategy

## Test layers

### Unit

Domain invariants, unit conversion, transforms, geometry predicates, cutability rules, serialization, and parser behavior.

### Property-based

Round trips, transform inverses, scale invariants, winding/containment rules, idempotent normalization, and serialization determinism.

### Golden fixtures

Reviewed SVG, DXF, trace, and project outputs. Golden changes require an explanation of the geometric difference.

### Integration

Commands, undo/redo, import-preview-commit, export pipelines, project migration, and recovery.

### End-to-end

Launch app, create sign, edit, save, reopen, run cutability, and export at exact size.

## Representative fixtures

Include:

- stencil letters with islands;
- script lettering with thin joins;
- nested contours;
- open and duplicate segments;
- self-intersections;
- inch and millimeter SVGs;
- common DXF 2D entities;
- noisy raster logos;
- high-node-count artwork;
- layered sign with mounting holes.

## Tolerance policy

Tests must identify the tolerance and its reason. Do not use a broad tolerance to hide scale or topology defects.

## Regression policy

Every reproducible bug gets a test at the lowest meaningful layer. UI-only tests are not a substitute for a geometry-unit regression test.

## M01 executable layers

- project-format unit tests cover deterministic round trips and
  corrupt/future-version rejection;
- application tests cover dirty state, identity/settings preservation, and
  recovery semantics;
- desktop integration tests use real temporary files for atomic save/open,
  recents, dirty close decisions, autosave, and recovery isolation;
- Playwright launches the packaged Windows executable for security smoke and
  complete lifecycle tests.

## M02 executable layers

- geometry unit tests directly cover Cartesian Y inversion, inverse
  round-trips, pointer-stable zoom, pan/zoom immutability, empty/populated fit,
  reset, and device-pixel-ratio independence;
- domain unit tests cover exact 24 in × 12 in and 600 mm × 300 mm creation,
  drift-free unit switching, bounds, object IDs/types, and viewport
  preferences;
- project-format tests cover deterministic schema-v2 round trips, the reviewed
  populated fixture, v1-to-v2 migration fixture, and corrupt/future rejection;
- application and desktop integration tests cover command dirty state,
  preference persistence, save/reopen, save over an existing `.laserx`,
  recents, recovery, and explicit-save isolation;
- Playwright launches the packaged Windows executable for renderer isolation,
  viewport navigation, rulers/grid/readout, forced 2× display scale, fit/reset,
  startup-state retry, schema-v1 migration, lifecycle, and recovery.

The coordinate inverse tolerance is `1e-9 mm`, documented in
`docs/UNITS_AND_COORDINATES.md`. Unit storage assertions for the acceptance
dimensions are exact.

Run all milestone checks from the repository root:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm verify
```
