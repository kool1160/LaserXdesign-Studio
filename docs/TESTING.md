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

## M03 executable layers

- geometry tests cover affine composition, pivot scale/rotation, transformed
  bounds, and repeated-transform tolerance;
- domain tests cover every edit operation, locked/hidden hit-test exclusion,
  marquee selection, snapping (including exact non-grid precedence over a
  nearby grid candidate), layers, grouping/ungrouping, z-order, align,
  distribute, stable child geometry, and width- or height-driven locked exact
  sizing;
- application tests cover explicit selection/clipboard/history ownership,
  fresh duplicate/paste IDs, transaction grouping, a bounded history, exact
  undo/redo, canceled-transaction redo preservation, and deterministic
  100-step replay;
- project-format golden tests cover complete schema-v3 editing-state round
  trips, v2-to-v3 migration, chained v1 migration, and corrupt/future/dangling
  data rejection, including mixed-layer nested groups;
- desktop unit/integration tests cover strict renderer actions, pointer and
  keyboard command equivalence, transform-handle projection, absence of React
  mutation, signed/zero exact-bounds conversion, last-edited locked-dimension
  routing, uniform locked edge-handle scaling, and full editing-state
  save/reopen;
- ten Playwright scenarios launch the packaged Windows executable. The M03
  workflow covers exact inspector edits, keyboard movement, duplicate,
  copy/paste, group/ungroup, rotation, undo/redo, layers, guides, schema-v3
  persistence, and reopen. A direct default-horizontal-line regression covers
  X = 0, negative Y, exact width, canonical geometry, undo/redo, and
  save/reopen. A locked-resize regression covers height-driven exact sizing,
  Shift edge-handle scaling, aspect preservation, and undo/redo. A navigation
  regression begins Alt-drag over artwork and middle-button drag over a visible
  handle, then proves the camera moved while document geometry, selection, and
  history stayed unchanged. These retain M01/M02 security, lifecycle,
  migration, viewport, recovery, and high-DPI regressions.

The M03 numerical transform tolerance remains `1e-9 mm`; packaged exact-bounds
assertions normalize only below that documented boundary.

## M04 executable layers

- font-engine tests use a pinned OFL fixture to prove deterministic shaping,
  glyph-compound indexing, exact contour bounds, enclosed-letter contours, arc
  warping, fingerprinting, and path-free catalog projections;
- domain and application tests cover text bounds, replacement, conversion to
  path groups, optional source preservation, selection, and undo/redo;
- project-format tests cover schema-v4 text/contour persistence and the
  deterministic v1/v2/v3 migration chain;
- IPC tests reject renderer-supplied font paths and generated geometry;
- `pnpm audit:fonts` validates pinned package versions, OFL license text,
  provenance fields, unique IDs, and coverage of stencil, script, serif, slab,
  western, industrial, and display categories;
- thirteen packaged Playwright scenarios retain the earlier security/editing
  coverage and add text create/edit, spacing/arc materialization,
  text-to-outline conversion, undo, save, and exact-contour reopen. A changed
  fingerprint regression proves selection/reopen preserves contours,
  fingerprint, dirty state, and history until explicit undoable substitution.
  Per-glyph compound-path assertions plus geometry/domain hit tests prove
  enclosed counters are even-odd holes while overlap between separate glyphs
  remains filled/selectable. Undo coverage proves authoritative same-ID text
  changes synchronize the panel without adding history or reapplying stale
  content/font intent on the next edit.

## M05 executable layers

- geometry tests cover cubic evaluation/subdivision, handle motion and
  reversal, endpoint joins with invariant adjacent control vectors, path
  splitting, bounded simplification, millimeter-distance cleanup, retention of
  collinear anchors between curved segments, retention of handled
  near-duplicates and their sampled curve/cusp geometry, and explicit
  self-intersection reporting with world-distance endpoint exclusion;
- the reviewed `fixtures/geometry/m05-boolean-offset-goldens.json` cases cover
  overlapping, nested, touching, and one-micrometer topology plus inward and
  outward offsets through the replaceable adapter;
- domain/application tests cover stable path IDs and closure, authoritative
  node/segment selection, topology summaries, byte-identical normalized
  geometry after undo, first-selected subtraction subjects, and no-mutation
  rejection of cross-layer boolean, offset, and join requests;
- project-format tests cover strict optional handles and the complete
  v1-to-v5 migration registry, including non-rewriting v4 migration;
- desktop integration tests inject the worker port to prove cancellation and
  stale work cannot mutate or add history, while successful work commits once
  and undoes exactly;
- IPC and packaged Playwright coverage validate path requests, worker-only
  heavy execution, UI summaries, cancellation, save, reopen, opposite
  subtraction subject order, concrete Intersect/XOR results, and cross-layer
  topology rejection without source or history changes;
- `pnpm audit:geometry` verifies the exact adapter dependency version and
  reviewed Boost-1.0 license text.

Topology golden comparisons are exact on the `1e-6 mm` engine grid. Curve and
simplification assertions state their millimeter tolerance and do not broaden
it to hide defects.

## M06 executable layers

- SVG adapter tests load reviewed 24 in, 600 mm, and viewBox-only fixtures;
  cover px/in/mm/cm conversion, `preserveAspectRatio`, nested transforms,
  groups/layers, open/closed primitives, cubic/quadratic paths, warnings, and
  DTD/entity/script/event/size rejection; and reimport explicit-mm exports.
- DXF adapter tests load reviewed inch, millimeter, unitless, common-entity,
  and unsupported-3D fixtures; cover LINE, LWPOLYLINE bulges, legacy POLYLINE,
  CIRCLE, ARC, closure, layers, units, warnings, and malformed/binary/size
  rejection; reject a sub-5-MB expanded-geometry bomb before 200,000 sampled
  points; preserve tiny-circle validity; and reimport explicit-mm exports.
- The production DXF parser does not participate in the downstream-inspection
  assertion: pinned MIT `dxf-parser` independently reads the representative
  600 mm and 24 inch/609.6 mm exports and verifies `$INSUNITS = 4`, LWPOLYLINE
  type, closed shape flag, vertex coordinates, and physical bounds.
- Domain/application tests prove import validates new IDs/layers, preview does
  not mutate project/dirty/history state, commit is one history entry, one undo
  restores the exact document, redo reapplies it, stale previews are rejected,
  and an over-budget normalized candidate fails before preview state changes.
- Desktop unit/integration tests cover strict path-free IPC, bounded UTF-8
  storage, native-dialog ownership, preview/commit/cancel/export coordination,
  and export summaries without history changes.
- Packaged Playwright coverage previews a 600 mm SVG as a noninteractive
  overlay, commits and undoes it, exports DXF, and independently reads the
  written file to verify explicit millimeter metadata.

Straight scale assertions use `1e-9 mm`. Curves use the documented 0.01 mm
world-space chordal tolerance after the full affine transform; uniform,
nonuniform, shear, and nested-group regressions cover cubic paths and ellipses.
SVG and DXF export/reimport tests keep transformed cubic bounds within that
tolerance. No broader tolerance hides unit or closure failures.

## M07 executable layers

- source-inspection tests cover PNG/JPEG signatures and dimensions, extension
  disagreement, animated PNG rejection, malformed input, byte limits, decoded
  pixel/memory limits, and decoder/header disagreement;
- import-raster tests cover deterministic presets, crop/rotation, grayscale,
  contrast, threshold, invert, blur, denoise, background, black/white and edge
  previews, four-connected contours, exact speckle count/area reporting,
  smoothing, and simplification deviation;
- `fixtures/images/m07-raster-trace-goldens.json` exactly covers a clean logo,
  noisy photo, anti-aliased text, and 2048 x 1536 high-resolution source through
  the pinned engine/version. Millimeter coordinates normalize only at the
  documented `1e-9 mm` numerical boundary;
- application and project-format tests prove preview/reject/cancel do not
  mutate project/dirty/history state, stale results fail, acceptance is one
  undoable `objects.import`, and only ordinary schema-v5 editable paths persist;
- desktop tests inject storage, codec, and worker ports to prove path-free IPC,
  progress, cancellation, stale-work rejection, bounded preview media,
  one-command acceptance, and immediate entry into the cutability interface
  with `cutReady: false`;
- the packaged Windows workflow imports a real PNG, changes preview modes,
  aligns original-plus-trace, accepts paths, opens node editing, receives the
  standard analysis warning, saves schema v5, and undoes to the exact original
  document;
- `pnpm audit:raster` verifies the original LaserX engine identity, version,
  workspace-only dependency set, accepted ADR, and license review.

The representative 512 x 512 noisy case must finish under 5 seconds. The
worker enforces the separately documented 30-second hard deadline; see
`docs/research/M07-RASTER-PERFORMANCE.md`.

Run all milestone checks from the repository root:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm verify
```
