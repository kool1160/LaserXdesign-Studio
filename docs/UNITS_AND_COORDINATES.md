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

The M02 line, rectangle, ellipse, and path objects use explicit `Mm` field
names. A path declares whether it is open or closed.

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
fixed.

The coordinate round-trip tolerance is `1e-9 mm`. This tolerance covers normal
IEEE-754 inverse-operation error; it is not a manufacturing tolerance.

## High-DPI behavior

Viewport dimensions and pointer positions use CSS pixels. Device-pixel ratio is
rendering metadata and never participates in unit conversion. A 24 in dimension
therefore reads as 24 in at 100%, 125%, 150%, 200%, or another Windows display
scale. Packaged tests force a device scale factor of 2 and verify that the
canonical dimensions and displayed measurements remain unchanged.

## Hit testing

M02 defines `HitTestService`, `HitTestRequest`, and `HitTestResult` in the
domain. The request uses a domain point and millimeter tolerance. M02 does not
implement selection, hit-test algorithms, handles, or transforms; those remain
blocked until M03.
