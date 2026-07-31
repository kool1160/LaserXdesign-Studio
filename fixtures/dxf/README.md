# DXF fixtures

- `24-inch.dxf` uses `$INSUNITS = 1` and carries a 24-unit LINE plus a closed
  LWPOLYLINE.
- `600-mm.dxf` uses `$INSUNITS = 4` and carries a closed 600 mm rectangle,
  CIRCLE, ARC, and named layers.
- `unitless.dxf` requires an explicit millimeter or inch preview assumption.
- `unsupported-3d.dxf` contains SPLINE and nonzero-Z data that must warn and
  skip rather than being silently projected.

Adapter tests also construct legacy POLYLINE/VERTEX, bulge, malformed, binary,
and oversized cases. Representative exports are parsed by independent
`dxf-parser` in addition to LaserX round-trip parsing.
