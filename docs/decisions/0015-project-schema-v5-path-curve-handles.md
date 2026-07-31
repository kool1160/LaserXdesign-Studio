# ADR 0015: Project Schema V5 Path Curve Handles

## Status

Accepted.

## Decision

Make schema version 5 the current `.laserx` write format. A path retains its
ordered canonical-millimeter `points` and closure flag and may add one
`handles` record per point. Each record contains nullable absolute local-space
incoming and outgoing cubic control points. Omitting the array is the
canonical straight-segment representation.

Schema v4 migrates deterministically by changing only the schema version and
appending a v4-to-v5 record using the source `updatedAt`. Straight paths are
not expanded with empty handle arrays. The parser rejects handle arrays whose
length differs from the node count, non-finite controls, closed paths with
fewer than three nodes, and all existing ID/layer/matrix violations.

Node and segment selection, topology summaries, worker progress, and history
remain application state and are not persisted. Topology results continue to
use stable object IDs where a surviving contour exists; additional contours
receive fresh IDs and every replaced source ID is reported.

## Rationale

Absolute local cubic controls extend the existing path representation without
changing straight-path bytes or coupling files to a geometry engine. They are
simple to transform, split with De Casteljau subdivision, reverse, flatten
under an explicit tolerance, and render through any viewport adapter.

## Alternatives

- Widening schema v4 in place was rejected because strict old readers would
  not understand saved handles.
- Persisting only flattened curve points was rejected because it destroys
  editable curve intent.
- Persisting node-selection state or engine-specific polygon records was
  rejected because neither is document geometry.

## Consequences

All explicit saves write schema v5. Versions 1 through 4 remain readable
through the explicit migration registry. Curve-aware bounds, hit testing,
topology preparation, and renderer projection must use the centralized
flattening contract rather than anchor points alone.
