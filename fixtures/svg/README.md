# SVG fixtures

- `24-inch.svg` is a 24 in x 12 in physical canvas with closed rectangle and
  circle geometry on a named layer.
- `600-mm.svg` is a 600 mm x 300 mm canvas with group translation, a closed
  polygon, and cubic/quadratic curves.
- `viewbox-only.svg` records the explicit 96 px/in assumption.
- `unsupported-and-safe.svg` proves unsupported text and path arcs warn while a
  supported line remains available.

Tests construct DTD/entity, script, event-handler, malformed, and oversized
inputs directly so no active-content sample needs to live in the repository.
