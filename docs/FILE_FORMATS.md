# File Formats

## Native project

Extension: `.laserx`.

Schema version 2 is strict, deterministic UTF-8 JSON with a trailing newline.
It contains project identity/timestamps, a stable document ID, canonical
millimeter dimensions, the fixed Cartesian origin, display and viewport
preferences, ordered placeholder objects with stable IDs, and migration
history. The reviewed current fixture is
`fixtures/projects/populated-v2.laserx`.

The parser rejects unknown fields, invalid object geometry, corrupt JSON, and
schema versions newer than the application supports. Files remain limited to
10 MB.

Schema version 1 remains read-compatible through a deterministic migration.
The reviewed source/result fixtures are `fixtures/projects/blank-v1.laserx`
and `fixtures/projects/migrated-v1-to-v2.laserx`. Migration preserves project
metadata, dimensions, display units, and history; derives the document ID from
the stable project ID; adds default viewport preferences; and records a
v1-to-v2 migration using the source `updatedAt` timestamp. Opening does not
rewrite the source file. A later explicit save writes schema v2.

Explicit saves use same-directory atomic replacement. Recovery snapshots are
stored separately under Electron user data and never overwrite the explicit
project file.

Future schemas remain versioned, deterministic, and migratable. A container
may replace JSON only when embedded assets justify it and a migration decision
is accepted.

Required data:

- schema version;
- project metadata;
- canonical millimeter document dimensions;
- object order (layers begin in M03);
- stable IDs;
- text content and font references;
- path geometry and transforms;
- process/cutability settings;
- optional linked or embedded raster references;
- optional AI provenance selected by the user;
- migration history.

Schema v2 intentionally has no layers, selection, transforms, production text,
import/export geometry, or manufacturing data. Those fields may only arrive
with their approved milestones and migrations.

## SVG

SVG is the editable interchange format. Import/export must explicitly handle width, height, viewBox, unit suffixes, transforms, path closure, fill rules, groups, and unsupported elements.

Scripts, event handlers, and unsafe external references are ignored or rejected.

## DXF

Version 1 targets documented 2D entities required by downstream plasma/laser CAM. Entity support must be fixture-driven. Physical scale and units must be explicit.

Native DWG is out of scope. Do not rename a DXF file to `.dwg` or claim equivalence.

## PNG/JPEG

Raster files are tracing or reference inputs. Original pixels may be embedded or linked in the native project but never exported as cut paths.
