# File Formats

## Native project

Extension: `.laserx`.

Schema version 4 is strict, deterministic UTF-8 JSON with a trailing newline.
It contains project identity/timestamps; a stable document ID; canonical
millimeter dimensions; the fixed Cartesian origin; display, viewport, and
snapping preferences; ordered layers and guides; recursive groups; and ordered
objects with stable IDs, layer references, and affine transforms. Editable text
adds font identity/fingerprint, millimeter typography settings, optional arc
intent, and materialized contours. Converted outline groups may preserve
editable source metadata. The reviewed current fixture is
`fixtures/projects/editing-v4.laserx`.

Object array order is z-order within layer order. Layer visibility, locking,
name, and active-layer identity are persistent. Selection, clipboard, undo/redo
history, transient camera position, and transform-handle state are not project
data.

Every descendant of a schema-v4 group must use the same `layerId` as the
group. Parsing, serialization, and internal insertion reject mixed-layer
groups. Layer moves, grouping, duplicate/paste, ungrouping, and layer deletion
preserve this recursive invariant; schema v4 does not define independent child
layer semantics inside a group.

The parser rejects unknown fields, invalid object geometry or matrices,
dangling layer references, corrupt JSON, and schema versions newer than the
application supports. Files remain limited to 10 MB.

Schema versions 1, 2, and 3 remain read-compatible through explicit deterministic
migrations:

```text
v1 -> v2 -> v3 -> v4
v2 -> v3 -> v4
v3 -> v4
```

The v2-to-v3 migration derives one stable default-layer ID from the document
ID, assigns every existing object to it with an identity transform, creates no
guides, and adds the reviewed snapping defaults. Migration history uses the
source `updatedAt`, so repeated reads serialize identically. Opening does not
rewrite the source file. The v3-to-v4 migration preserves the document and
records the transition using the source `updatedAt`. A later explicit save
writes schema v4.

Reviewed compatibility fixtures:

- `fixtures/projects/blank-v1.laserx`;
- `fixtures/projects/populated-v2.laserx`;
- `fixtures/projects/migrated-v1-to-v2.laserx`;
- `fixtures/projects/editing-v3.laserx`;
- `fixtures/projects/migrated-v2-to-v3.laserx`;
- `fixtures/projects/editing-v4.laserx`;
- `fixtures/projects/migrated-v2-to-v4.laserx`;
- `fixtures/projects/corrupt-v1.laserx`;
- `fixtures/projects/future-v99.laserx`.

Explicit saves use same-directory atomic replacement. Recovery snapshots are
stored separately under Electron user data and never overwrite the explicit
project file.

Future schemas remain versioned, deterministic, and migratable. A container
may replace JSON only when embedded assets justify it and a migration decision
is accepted.

## SVG

SVG is the planned editable interchange format. Import/export must explicitly
handle width, height, viewBox, unit suffixes, transforms, path closure, fill
rules, groups, and unsupported elements. SVG support is not implemented in M03.

Scripts, event handlers, and unsafe external references will be ignored or
rejected.

## DXF

Version 1 will target documented 2D entities required by downstream
plasma/laser CAM. Entity support must be fixture-driven. Physical scale and
units must be explicit. DXF support is not implemented in M03.

Native DWG is out of scope. Do not rename a DXF file to `.dwg` or claim
equivalence.

## PNG/JPEG

Raster files are future tracing or reference inputs. Original pixels may later
be embedded or linked in the native project but never exported as cut paths.
