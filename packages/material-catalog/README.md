# `@laserx/material-catalog`

Pure experimental catalog for truthful wood and acrylic stock definitions.

## Current scope

- MDF
- Baltic birch plywood
- Hardwood plywood
- Hardboard / Masonite
- Cast clear, opaque, and translucent acrylic
- Extruded clear acrylic
- Mirrored acrylic
- Frosted acrylic

Each material provides stable IDs, material-specific nominal stock presets, exact canonical millimeters, measurement policy, process compatibility, plain-shop-language notes, and renderer-independent appearance descriptors.

## Measurement rule

A nominal stock choice is never treated as a user measurement.

- Wood-based sheet goods currently use `measure-required` because actual thickness commonly differs from the nominal label.
- Acrylic uses `measure-recommended` because fit, standoff, and layered-stack work should use the actual sheet when available.
- `resolveCatalogThickness()` preserves the nominal exact value for selection and replaces it only when the caller supplies a positive measured thickness.

## Experiment boundary

This package is not imported by the production application, project schema, cutability engine, production exports, or 3D renderer.

It does not activate a material-expansion milestone and must not be merged to `main` until the owner approves a reviewed promotion plan. The experiment intentionally makes no schema or migration change.

See GitHub Issue #39.
