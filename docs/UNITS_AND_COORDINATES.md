# Units and Coordinates

## Canonical units

Every persisted document dimension and object coordinate is a millimeter value.
The display unit is a presentation preference and is either `millimeters` or
`inches`. One inch is exactly 25.4 millimeters. Conversion occurs in the domain
or renderer-adapter boundary, never in a React component.

Creating a 24 in × 12 in document therefore stores:

```text
widthMm  = 609.6
heightMm = 304.8
```

Unit switching reads the same canonical numbers through another formatter. It
does not convert and rewrite stored geometry, so repeated switching cannot
introduce drift.

Grid spacing is also stored in millimeters. The UI converts a displayed grid
spacing to millimeters before sending a validated command.

## Domain coordinate system

The domain is Cartesian:

- the document stock origin is `(0 mm, 0 mm)` at its lower-left corner;
- positive X points right;
- positive Y points up;
- the stock occupies `(0, 0)` through `(widthMm, heightMm)`;
- object geometry is never stored in screen pixels.

Line, rectangle, ellipse, and path objects use explicit `Mm` field names. A
path declares whether it is open or closed.

## M03 transforms

Each object stores raw geometry in canonical millimeters plus an affine
transform:

```text
x' = a*x + c*y + eMm
y' = b*x + d*y + fMm
```

Translation fields are explicitly millimeters. Scale, rotation, and mirror
compose matrices at a documented domain pivot. A group adds one parent matrix;
its child geometry and IDs stay unchanged. Ungrouping composes the parent
matrix into each child, preserving the same world geometry.

Exact inspector values are converted at the renderer-adapter boundary before
the validated command enters the application. Repeated-transform tests use the
existing `1e-9 mm` numerical tolerance. That tolerance covers IEEE-754 matrix
composition error and is not a manufacturing tolerance.

Inspector X/Y values are signed finite coordinates, so zero and positions
outside the stock region are valid. Inspector width/height values are
nonnegative dimensions. A line's intrinsically zero bounds axis remains zero
while its other axis can be resized and its X/Y position can be changed. A
request to expand an intrinsically zero bounds axis is rejected explicitly
instead of dividing by zero or producing a non-invertible transform.

With aspect locking enabled, the last edited Width or Height field is the
authoritative dimension and the other nonzero axis is derived from the current
selection ratio. Shift-dragging an edge handle uses that edge's scale factor
uniformly on both axes: east/west handles pivot at the opposite edge and
vertical center, while north/south handles pivot at the opposite edge and
horizontal center. Corner handles retain their opposite-corner pivot.

Move snapping is evaluated in domain millimeters. Enabled targets are grid
lines, explicit guides, document bounds/center, and visible editable object
bounds/centers. Candidate distance is compared across enabled target families;
an exact zero-distance guide, document, or object match cannot be displaced by
a nearby grid line. Camera position and device-pixel ratio do not affect
targets.

## M05 topology tolerances

Editable anchors and cubic controls remain canonical millimeter doubles. Curve
flattening defaults to `0.01 mm` for viewport/hit projections and uses an
operation-specific tighter value (`0.002 mm`) before booleans and offsets.
Simplification splits its selected tolerance between curve flattening and
Ramer-Douglas-Peucker reduction so the combined deviation cannot exceed the
user value.

The Clipper2 adapter quantizes only at its boundary to `1e-6 mm` integer units.
This micrometer grid is the topology equality tolerance, not the existing
`1e-9 mm` matrix/coordinate round-trip tolerance and not a manufacturing kerf
allowance. Join and cleanup tolerances are explicit user inputs. Offset values
are signed millimeters; positive is outward and negative is inward.

Coordinates whose scaled value would exceed `Number.MAX_SAFE_INTEGER` are
rejected before engine execution. Engine results are rotated and sorted
deterministically, with collinear artifacts removed without changing winding.

Cleanup evaluates an anchor's perpendicular point-to-segment distance directly
in millimeters; it never compares a square-millimeter cross product with a
millimeter tolerance. Collinear-anchor removal additionally requires both
adjacent segments to be linear. Near-duplicate anchors are compacted only when
both anchors have no controls, so cleanup cannot erase a curve or cusp without
proving its world-millimeter deviation. Self-intersection endpoint exclusion
measures the world-millimeter distance from the intersection to each segment
endpoint rather than comparing unitless segment ratios with a length. When a
join snaps endpoint anchors to a midpoint, the adjacent cubic controls receive
the same world-millimeter deltas so their anchor-relative vectors remain
unchanged.

## M06 interchange scale

All SVG/DXF candidates cross the adapter boundary in canonical millimeters.
Import does not auto-fit, center, or rescale artwork to stock. Nested transforms
are composed before materialization, so committed objects use an identity
transform at their imported world coordinates.

SVG absolute root lengths use these exact conversions:

```text
1 in = 25.4 mm
1 cm = 10 mm
96 px = 1 in
```

Unitless SVG root dimensions are CSS pixels. ViewBox-only dimensions are also
CSS pixels and the preview records that assumption. The root viewBox mapping,
including `preserveAspectRatio`, resolves before the SVG Y-down axis is flipped
into LaserX Y-up. Shape coordinates are viewBox user units; percentages and
relative CSS units are not accepted.

DXF `$INSUNITS` 1, 4, and 5 convert from inches, millimeters, and centimeters.
Unit value 0 or missing metadata has no implicit default: preview requires the
user to choose millimeters or inches and reports that choice. DXF export always
writes `$INSUNITS = 4` and coordinates in millimeters.

The `0.01 mm` interchange flattening value is a maximum chordal-deviation
target for cubic paths, ellipses, circles, arcs, and bulges. Scale-golden tests
use `1e-9 mm` for straight coordinate conversion and the declared 0.01 mm
curve tolerance for sampled geometry. Neither is a kerf or CAM tolerance.

## Renderer conversion boundary

The screen uses CSS pixels with positive Y downward. `packages/geometry`
performs the invertible conversion, and
`apps/desktop/src/lib/viewport-adapter.ts` creates screen-ready primitives for
React:

```text
screenXCssPx = originScreenXCssPx + xMm * zoomCssPxPerMm
screenYCssPx = originScreenYCssPx - yMm * zoomCssPxPerMm

xMm = (screenXCssPx - originScreenXCssPx) / zoomCssPxPerMm
yMm = (originScreenYCssPx - screenYCssPx) / zoomCssPxPerMm
```

Pan changes only the two screen-origin fields. Zoom changes the CSS-pixel scale
and screen origin. Zoom around a pointer first resolves the domain point under
the pointer, then chooses the new screen origin so that domain point remains
fixed. Explicit Alt-drag and middle-button gestures take precedence over
artwork and transform-handle hit testing, so panning changes camera state only.

The coordinate round-trip tolerance is `1e-9 mm`. This tolerance covers normal
IEEE-754 inverse-operation error; it is not a manufacturing tolerance.

## High-DPI behavior

Viewport dimensions and pointer positions use CSS pixels. Device-pixel ratio is
rendering metadata and never participates in unit conversion. A 24 in dimension
therefore reads as 24 in at 100%, 125%, 150%, 200%, or another Windows display
scale. Packaged tests force a device scale factor of 2 and verify that the
canonical dimensions and displayed measurements remain unchanged.

## Hit testing

Hit testing consumes a domain point and millimeter tolerance. M03 returns
topmost object IDs in layer/z order and implements domain-bounds marquee
testing. Hidden- or locked-layer objects are excluded before selection and
editing. Transform handles are screen projections only; their gestures convert
back to domain commands through the renderer adapter.
