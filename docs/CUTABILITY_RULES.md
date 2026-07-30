# Cutability Rules

Cutability analysis is guidance based on user-entered process settings. It is not a certification of machine safety or part quality.

## Inputs

- process type;
- material;
- thickness;
- kerf width;
- minimum feature width;
- minimum bridge width;
- minimum gap;
- optional heat-distortion spacing;
- optional user tolerance preset.

## Required issue classes

- `OPEN_CONTOUR`
- `DUPLICATE_SEGMENT`
- `OVERLAPPING_SEGMENT`
- `SELF_INTERSECTION`
- `DISCONNECTED_ISLAND`
- `ENCLOSED_DROPOUT`
- `BRIDGE_TOO_NARROW`
- `FEATURE_TOO_NARROW`
- `GAP_TOO_SMALL`
- `CONTOURS_TOO_CLOSE`
- `KERF_COLLAPSE_RISK`
- `UNSUPPORTED_GEOMETRY`

Each issue contains severity, affected IDs, measured value, configured limit, location, explanation, and repair suggestion.

## Retained-metal preview

The preview must classify regions relative to an explicit stock/background assumption. Ambiguous open geometry cannot be presented as definitively retained or removed.

## Auto-bridge

Auto-bridge proposes one or more bridge placements. It must:

- respect minimum width;
- avoid obvious contour collisions;
- preserve readability when possible;
- preview changed geometry;
- remain undoable;
- retain the original until the user accepts.

## Process presets

Presets are editable starting points, not authoritative machine values. They must clearly show which values came from a preset and which the user changed.
