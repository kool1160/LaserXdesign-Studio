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

The current deterministic checks interpret the codes as follows:

| Code | Measured evidence | Configured limit |
| --- | --- | --- |
| `OPEN_CONTOUR` | endpoint separation | minimum gap |
| `DUPLICATE_SEGMENT` | zero separation | geometry tolerance |
| `OVERLAPPING_SEGMENT` | collinear overlap length | geometry tolerance |
| `SELF_INTERSECTION` | zero separation at crossing | geometry tolerance |
| `DISCONNECTED_ISLAND` | zero connection width | minimum bridge width |
| `ENCLOSED_DROPOUT` | square root of enclosed area | minimum feature width |
| `BRIDGE_TOO_NARROW` | estimated retained-region neck | minimum bridge width |
| `FEATURE_TOO_NARROW` | estimated local contour width | minimum feature width |
| `GAP_TOO_SMALL` | nearest distance between contours | minimum gap |
| `CONTOURS_TOO_CLOSE` | nearest distance between contours | greater of contour and optional heat spacing |
| `KERF_COLLAPSE_RISK` | estimated local contour width | kerf width |
| `UNSUPPORTED_GEOMETRY` | zero/unstable area or crossing separation | geometry tolerance |

Geometry is flattened and analyzed in world millimeters at a 0.01 mm chordal
tolerance. A run accepts at most 50,000 flattened segments. Width, kerf, gap,
and spacing results are conservative approximations against user-entered
limits; they are not toolpath simulation.

## Retained-metal preview

The preview must classify regions relative to an explicit stock/background assumption. Ambiguous open geometry cannot be presented as definitively retained or removed.

LaserX assumes stock outside all valid closed contours is retained. Each
containment depth toggles material state: depth 0 is removed, depth 1 retained,
depth 2 removed, and so on. Classification is derived from geometry only, not
font, glyph, or character names. An open, degenerate, self-intersecting,
duplicate/overlapping, or mutually intersecting contour makes the preview
ambiguous. Analysis always reports `cutReady: false`.

## Auto-bridge

Auto-bridge proposes one or more bridge placements. It must:

- respect minimum width;
- avoid obvious contour collisions;
- preserve readability when possible;
- preview changed geometry;
- remain undoable;
- retain the original until the user accepts.

Manual mode accepts left, right, up, or down. Automatic mode evaluates those
four directions and chooses the shortest collision-free candidate
deterministically. M08 repair applies only when the island and containing
contour are top-level ordinary closed paths on the same editable layer. Group,
text, cross-layer, and arbitrary-angle repairs remain guidance-only. Accepting
a proposal creates one undoable topology command; rejecting it changes
nothing.

## Process presets

Presets are editable starting points, not authoritative machine values. They must clearly show which values came from a preset and which the user changed.

Schema v6 persists the preset ID, process, material, thickness, all numeric
limits, tolerance preset, and the customized-field list. Changing geometry or
settings invalidates cached analysis; selection-only issue navigation does
not. The exact analysis-input fingerprint plus normalized object scope is the
cache key. Display units, viewport preferences, guides, and layer names are not
analysis inputs and do not discard a valid result.

M12 keeps the standard whole-design run unchanged and adds an explicit
manufacturing-layer action. That action is available only for a tagged physical
layer and passes exactly its top-level object IDs through the same worker and
cache. The desktop projection labels the returned scope with layer ID/name;
switching back to whole-design analysis replaces that label. A preview-only or
ordinary layer cannot claim an independent physical analysis.

Whole-design means only an empty object-ID request over the complete visible
document. Analyze selection publishes a distinct `selection` scope with the
exact analyzed IDs. Result and scope are one atomic desktop projection: an
in-flight, canceled, or failed request cannot relabel an older result. Cache
hits publish the newly requested scope with the matching cached summary.
Bridge acceptance reruns the successful source scope: empty IDs for whole-
design, current authoritative layer IDs for a physical layer, or the original
selection IDs mapped through the topology replacement.

## Explicit limitations

The preview does not generate G-code, lead-ins, cut order, heat simulation, or
machine motion. It does not certify machine safety, part quality, or guaranteed
manufacturability. Users must confirm values against their material, machine,
consumables, and operator practices.
