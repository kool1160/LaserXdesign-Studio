# M08 — Cutability Analysis, Bridges, and Manufacturing Preview

## User-visible outcome

The program explains what will fall out or fail to cut, highlights the exact problem, proposes bridges or repairs, and shows retained metal versus removed regions.

## Included

- process/material/thickness preset model with editable values;
- kerf, minimum feature, minimum bridge, minimum gap, and contour-spacing settings;
- issue classes defined in `docs/CUTABILITY_RULES.md`;
- issue list, severity, canvas highlighting, filtering, and navigation;
- region containment and retained/drop-out classification;
- open, duplicate, overlapping, and self-intersecting geometry detection;
- island and enclosed-dropout detection;
- narrow-feature/gap/bridge detection;
- basic kerf-collapse risk approximation with explicit limits;
- manual bridge tool;
- automatic bridge proposals with preview and undo;
- manufacturing preview mode;
- analysis cache invalidation tied to document commands;
- disclaimer and machine-setting transparency.

## Explicitly excluded

G-code, lead-ins, cut order, heat simulation, guaranteed manufacturability, and process tables presented as authoritative machine settings.

## Acceptance tests

1. A/B/D/O/P/R-like enclosed regions are detected from geometry, not character names.
2. Nested contour fixtures classify retained/drop-out regions correctly under documented assumptions.
3. Open or ambiguous geometry never receives a false definitive preview.
4. Each issue reports measured value and configured limit.
5. Auto-bridge proposals meet minimum width and are previewable/undoable.
6. Geometry changes invalidate only affected analysis where practical.
7. Analysis never mutates the document until a repair command is accepted.

## Exit checklist

- [ ] Rule suite and false-positive/negative fixtures reviewed.
- [ ] Manual and auto-bridge workflows pass end-to-end.
- [ ] Manufacturing-preview limitations documented.
- [ ] Status advances to M09.
