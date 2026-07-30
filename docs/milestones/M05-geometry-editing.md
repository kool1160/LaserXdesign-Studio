# M05 — Node Editing and Boolean Geometry

## User-visible outcome

Users can directly repair and reshape vector artwork inside LaserX without returning to a separate CAD/vector program for routine cleanup.

## Included

- node and segment selection;
- add/delete/move nodes;
- line and supported curve handles;
- open/close path;
- join endpoints with tolerance preview;
- split path/segment;
- reverse path direction;
- simplify with adjustable tolerance and before/after node count;
- union, subtract, intersect, exclude/xor if the engine supports it reliably;
- inward/outward offset;
- contour cleanup and self-intersection reporting;
- geometry-engine adapter and licensing/performance evaluation;
- cancellable worker execution for expensive operations;
- topology-change summaries and undo transactions.

## Explicitly excluded

Full CAD trim/extend command parity, parametric constraints, fillet/chamfer unless separately accepted, CAM kerf compensation, and nesting.

## Acceptance tests

1. Boolean and offset golden fixtures pass for simple, nested, touching, and near-tolerance contours.
2. Operations do not silently discard geometry; discarded entities are reported.
3. Undo restores byte-equivalent normalized document geometry where expected.
4. Simplification cannot exceed the selected deviation tolerance.
5. Worker cancellation leaves the original document unchanged.
6. Node editing preserves path closure and stable object identity rules.
7. Geometry engine can be replaced behind the adapter without UI changes.

## Exit checklist

- [ ] Geometry-engine ADR accepted.
- [ ] License review complete.
- [ ] Golden fixtures independently reviewed.
- [ ] Performance baseline recorded.
- [ ] Status advances to M06.
