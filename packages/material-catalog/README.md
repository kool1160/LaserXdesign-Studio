# `@laserx/material-catalog`

Pure experimental catalog for truthful wood and acrylic stock definitions plus a LightBurn-aligned starter taxonomy.

## Physical material scope

- MDF
- Baltic birch plywood
- Hardwood plywood
- Hardboard / Masonite
- Cast clear, opaque, and translucent acrylic
- Extruded clear acrylic
- Mirrored acrylic
- Frosted acrylic

Each physical material provides stable IDs, material-specific nominal stock presets, exact canonical millimeters, measurement policy, process compatibility, plain-shop-language notes, and renderer-independent appearance descriptors.

## LightBurn alignment

LightBurn does not publish one universal machine-independent Material Library. `.clb` libraries are user-created and are commonly maintained per laser because speed, power, passes, air assist, and focus depend on the exact machine and material.

LaserX therefore copies the familiar LightBurn organization without inventing universal machine settings:

1. Material Name
2. Thickness for through-cutting, or a No Thickness operation title such as `Engrave` or `Score`
3. Description such as `Cut — clean` or `Engrave — fill`

The starter taxonomy prioritizes common laser-shop groups:

### Wood

- MDF
- Basswood plywood
- Birch plywood
- Baltic birch plywood
- Hardwood plywood
- Solid hardwood
- Wood veneer
- Hardboard / Masonite

### Acrylic

- Cast clear
- Cast opaque color
- Cast transparent or translucent color
- Extruded clear
- Extruded color
- Frosted
- Mirrored

`src/lightburn.ts` intentionally contains no speed, power, pass, air-assist, or focus values. Those belong to a device-specific process library or a future reviewed `.clb` import/export adapter.

## Measurement rule

A nominal stock choice is never treated as a user measurement.

- Wood-based sheet goods currently use `measure-required` because actual thickness commonly differs from the nominal label.
- Acrylic uses `measure-recommended` because fit, standoff, and layered-stack work should use the actual sheet when available.
- `resolveCatalogThickness()` preserves the nominal exact value for selection and replaces it only when the caller supplies a positive measured thickness.

## Experiment boundary

This package is not imported by the production application, project schema, cutability engine, production exports, or 3D renderer.

It does not activate a material-expansion milestone and must not be merged to `main` until the owner approves a reviewed promotion plan. The experiment intentionally makes no schema or migration change.

See GitHub Issue #39 and draft PR #40.
