# File Formats

## Native project

Extension: `.laserx`.

Schema version 1 is strict, deterministic UTF-8 JSON with a trailing newline.
It contains project identity/timestamps, an explicitly empty document, display
unit, blank-workspace dimensions stored in millimeters, and migration history.
The reviewed fixture is `fixtures/projects/blank-v1.laserx`.

The M01 parser rejects unknown fields, invalid data, corrupt JSON, and schema
versions newer than the application supports. The migration registry is
explicitly empty until a second schema exists. Files are limited to 10 MB in
M01.

Explicit saves use same-directory atomic replacement. Recovery snapshots are
stored separately under Electron user data and never overwrite the explicit
project file.

Future schemas remain versioned, deterministic, migratable, and capable of
preserving editable objects. A container may replace JSON only when embedded
assets justify it and a migration decision is accepted.

Required data:

- schema version;
- project metadata;
- canonical millimeter document dimensions;
- layers and object order;
- stable IDs;
- text content and font references;
- path geometry and transforms;
- process/cutability settings;
- optional linked or embedded raster references;
- optional AI provenance selected by the user;
- migration history.

## SVG

SVG is the editable interchange format. Import/export must explicitly handle width, height, viewBox, unit suffixes, transforms, path closure, fill rules, groups, and unsupported elements.

Scripts, event handlers, and unsafe external references are ignored or rejected.

## DXF

Version 1 targets documented 2D entities required by downstream plasma/laser CAM. Entity support must be fixture-driven. Physical scale and units must be explicit.

Native DWG is out of scope. Do not rename a DXF file to `.dwg` or claim equivalence.

## PNG/JPEG

Raster files are tracing or reference inputs. Original pixels may be embedded or linked in the native project but never exported as cut paths.
