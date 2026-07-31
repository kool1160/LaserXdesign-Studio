# M06 — Dimensionally Correct SVG and DXF Interoperability

## User-visible outcome

Users can import practical SVG/DXF artwork and export files that downstream CAM opens at the intended physical size with clean 2D geometry.

## Included

- SVG import with safe parsing and supported-element warnings;
- SVG export with explicit physical dimensions and viewBox;
- transform normalization strategy;
- DXF 2D import subset chosen from real fixtures;
- DXF 2D export subset suitable for common plasma/laser CAM;
- lines, polylines, closed polylines, circles/arcs, and curve flattening policy as supported;
- layer mapping;
- unit metadata and explicit scale handling;
- unsupported-entity reporting;
- import preview and non-destructive commit;
- round-trip and downstream-inspection fixtures;
- export summary with object count, warnings, units, and bounds.

## Explicitly excluded

Native DWG, 3D DXF entities, CAM operations, splines without a proven conversion policy, and pretending visual styles are cut geometry.

## Acceptance tests

1. 24-inch and 600-mm reference rectangles export and reimport within documented tolerance.
2. SVG with px, in, mm, cm, and viewBox-only dimensions follows documented behavior.
3. DXF unitless input prompts for or clearly applies an explicit assumption.
4. Unsupported entities produce warnings rather than silent disappearance.
5. Open/closed contour state remains correct through export.
6. Representative exports open at correct scale in at least one independent inspector/CAM validation workflow.
7. Malicious/oversized SVG input fails safely.

## Exit checklist

- [x] Supported entity matrix documented.
- [x] Scale golden suite passes.
- [x] Independent downstream validation recorded.
- [x] Status advances to M07.
