# M07 — PNG/JPEG Preprocessing and Vector Tracing

## User-visible outcome

Users can import a logo or sign photograph, clean it visually, trace it into manageable vector paths, compare results, and continue editing.

## Included

- PNG/JPEG import with safe size limits;
- crop, rotate, grayscale, contrast, threshold, invert, blur/denoise, and background controls needed for tracing;
- black/white and edge previews;
- trace-engine adapter and candidate evaluation;
- detail presets plus explicit threshold/tolerance controls;
- speckle/island filtering;
- path smoothing and simplification;
- node-count and smallest-feature summary;
- original-versus-trace overlay;
- cancellable worker operation with progress;
- insert traced result as editable objects through a command;
- fixture set for clean logos, noisy photos, anti-aliased text, and high-resolution images.

## Explicitly excluded

General photo editing, perfect semantic logo reconstruction, optical font identification, and automatic claim that traced artwork is cut-ready.

## Acceptance tests

1. Traced output is editable domain geometry, not a flattened preview.
2. Cancelling or rejecting a trace does not mutate the project.
3. Presets are deterministic for the same engine/version/input.
4. Speckle filtering reports removed areas and thresholds.
5. Simplification stays within selected deviation tolerance.
6. High-resolution input respects memory/time safeguards.
7. Accepted trace immediately produces cutability warnings through the standard analysis interface.

## Exit checklist

- [ ] Trace-engine ADR and license review complete.
- [ ] Fixture/golden set reviewed.
- [ ] Performance targets recorded.
- [ ] Raster-to-editable end-to-end test passes.
- [ ] Status advances to M08.
