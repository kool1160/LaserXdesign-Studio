# @laserx/geometry

Deterministic UI-independent points, segments, paths, transforms, bounds, intersections, containment, winding, booleans, offsets, simplification, topology, and centralized tolerances.

M02 implements the pure viewport subset: Cartesian/domain and CSS-screen
conversion, pan, pointer-stable zoom, fit/reset, visible bounds, grid lines,
ruler ticks, snapping, and the `1e-9 mm` coordinate tolerance. Production path
algorithms remain deferred.

M03 adds pure affine composition, translation, pivot scale/rotation, transformed
bounds, union/intersection/containment helpers, and segment-distance primitives.
These remain UI-independent and do not make SVG or CSS state authoritative.
