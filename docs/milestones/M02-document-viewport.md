# M02 — Canonical Document Model and Viewport

## User-visible outcome

The user can create an exact-size sign document, switch inches/millimeters, and navigate a stable 2D workspace with rulers, grid, pan, zoom, and fit-to-view.

## Included

- canonical document model in millimeters;
- document dimensions, origin, background/stock region, and display units;
- stable IDs and schema-ready object base types;
- Cartesian domain coordinates with renderer conversion;
- viewport pan, zoom, fit, reset, rulers, grid, and snapping settings;
- exact coordinate/status readout;
- initial line/rectangle/ellipse/path placeholder objects sufficient to prove the model;
- renderer adapter boundary;
- hit-test interface, even if selection lands in M03;
- serialization and migration coverage.

## Explicitly excluded

Full editing tools, text, booleans, tracing, DXF, and cutability.

## Acceptance tests

1. Create 24 in × 12 in and 600 mm × 300 mm documents and verify canonical stored dimensions.
2. Switching display units does not mutate geometry.
3. Pan/zoom never changes document coordinates.
4. Fit-to-view works for empty and populated documents.
5. Renderer Y-axis conversion is covered by tests.
6. Save/reopen preserves dimensions, units, viewport preferences, and objects.
7. High-DPI scaling does not change measurement readouts.

## Exit checklist

- [x] Domain model reviewed independently of UI.
- [x] Unit conversion and coordinate tests pass.
- [x] Viewport smoke/end-to-end test passes.
- [x] No geometry algorithms live in React components.
- [ ] Status advances to M03.

The final item remains blocked until the M02 pull request is reviewed, Windows
CI passes, and the pull request is merged.
