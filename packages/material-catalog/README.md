# `@laserx/material-catalog`

Pure experimental catalog for truthful physical materials used in signs and other flat-made products.

LaserX is a companion to downstream software such as LightBurn, plasma CAM, fiber-laser software, router CAM, and waterjet workflows. This package describes **what the product is made from**. It does not contain machine speeds, power, passes, focus, firmware, motion control, or software-specific cut settings.

## Current first slice

### Wood-based sheet goods

- MDF
- Baltic birch plywood
- Hardwood plywood
- Hardboard / Masonite

### Acrylic

- Cast clear
- Cast opaque
- Cast translucent
- Extruded clear
- Mirrored
- Frosted

Each material provides stable IDs, material-specific nominal stock presets, exact canonical millimeters, measurement policy, process compatibility/caution metadata, plain-shop-language notes, and renderer-independent appearance descriptors.

## Planned expansion

Future reviewed slices should add the common materials LaserX users design for, including:

- basswood and birch plywood;
- solid hardwood and veneer;
- additional acrylic colors and constructions;
- glass families used for marking or engraving;
- stone families such as slate, granite, and marble;
- additional metals and mixed-material assemblies.

Those families may differ in whether geometry is intended for through-cutting, marking, engraving, routing, or assembly. LaserX must represent that truthfully without turning into machine-control software.

## Measurement rule

A nominal stock choice is never treated as a user measurement.

- Wood-based sheet goods currently use `measure-required` because actual thickness commonly differs from the nominal label.
- Acrylic uses `measure-recommended` because fit, standoff, and layered-stack work should use the actual sheet when available.
- `resolveCatalogThickness()` preserves the nominal exact value for selection and replaces it only when the caller supplies a positive measured thickness.

## Downstream export boundary

SVG, DXF, layered production packages, and future target-software export profiles are separate consumers of the authoritative LaserX geometry. The material catalog may inform labels, grouping, documentation, and physical preview, but it does not own downstream machine settings.

## Physical 3D preview boundary

The future renderer should consume these appearance descriptors so finished signs can distinguish materials such as wood, clear/colored/frosted/mirrored acrylic, glass, stone, painted metal, and bare metal. The renderer must not invent material identity and must remain derived and non-mutating.

## Experiment boundary

This package is not imported by the production application, project schema, cutability engine, production exports, or 3D renderer.

It does not activate a material-expansion milestone and must not be merged to `main` until the owner approves a reviewed promotion plan. The experiment intentionally makes no schema or migration change.

See GitHub Issue #39 and draft PR #40.
