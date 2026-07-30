# ADR 0008: Canonical Document and Viewport Boundary

## Status

Accepted.

## Decision

Store document dimensions, origin, viewport spacing preferences, and all
placeholder-object geometry in millimeters. The document stock has a fixed
lower-left origin at `(0, 0)`, with positive X right and positive Y up.

Use stable UUID-shaped IDs for projects, documents, and objects. M02 defines
only line, rectangle, ellipse, and open/closed point-path objects. It also
defines a domain-unit hit-test interface without a selection implementation.

Keep pan, zoom, pointer-preserving zoom, fit, reset, grid, ruler, and invertible
coordinate functions in `packages/geometry`. Keep document bounds and units in
`packages/domain`. A renderer adapter converts those results into SVG
primitives expressed in CSS pixels. React owns ephemeral camera state and
event forwarding, but no canonical unit calculations or geometry algorithms.

Positive screen Y points down, so the renderer boundary negates domain Y. The
inverse conversion is directly tested to `1e-9 mm`.

Device-pixel ratio does not enter physical-unit calculations. It is carried as
rendering metadata only.

## Rationale

A UI-independent document remains deterministic, serializable, and reusable by
future import, export, and analysis packages. An explicit conversion boundary
prevents CSS transforms, SVG state, or display scaling from becoming the source
of manufacturing dimensions.

## Alternatives

- Screen-pixel geometry was rejected because display scale and zoom would alter
  physical meaning.
- CSS transforms as the camera authority were rejected because they conceal the
  domain-to-screen conversion and complicate exact pointer inversion.
- Implementing M03 selection and transforms with the hit-test interface was
  rejected as later-milestone scope.
- Adding a canvas library was rejected because M02 needs only a small,
  replaceable SVG renderer adapter.

## Consequences

Renderer code must use the adapter and pure viewport functions. Future object
types must add explicit unit-bearing fields, schema validation, bounds behavior,
and adapter coverage. More advanced curve/path semantics remain deferred to the
geometry-editing milestone.
