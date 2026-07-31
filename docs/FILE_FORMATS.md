# File Formats

## Native project

Extension: `.laserx`.

Schema version 5 is strict, deterministic UTF-8 JSON with a trailing newline.
It contains project identity/timestamps; a stable document ID; canonical
millimeter dimensions; the fixed Cartesian origin; display, viewport, and
snapping preferences; ordered layers and guides; recursive groups; and ordered
objects with stable IDs, layer references, and affine transforms. Editable text
adds font identity/fingerprint, millimeter typography settings, optional arc
intent, and materialized contours carrying deterministic nonnegative glyph-
compound indices. The indices preserve counter-versus-overlap fill semantics
without changing outline conversion, which still emits every contour.
Converted outline groups may preserve editable source metadata. The reviewed
current fixture is
`fixtures/projects/editing-v4.laserx` remains the reviewed v4 compatibility
fixture; schema-v5 curve persistence is exercised by the project-format
round-trip suite.

Object array order is z-order within layer order. Layer visibility, locking,
name, and active-layer identity are persistent. Selection, clipboard, undo/redo
history, transient camera position, and transform-handle state are not project
data.

Every descendant of a schema-v5 group must use the same `layerId` as the
group. Parsing, serialization, and internal insertion reject mixed-layer
groups. Layer moves, grouping, duplicate/paste, ungrouping, and layer deletion
preserve this recursive invariant; schema v5 does not define independent child
layer semantics inside a group.

The parser rejects unknown fields, invalid object geometry or matrices,
dangling layer references, corrupt JSON, and schema versions newer than the
application supports. Files remain limited to 10 MB.

Schema versions 1, 2, 3, and 4 remain read-compatible through explicit deterministic
migrations:

```text
v1 -> v2 -> v3 -> v4 -> v5
v2 -> v3 -> v4 -> v5
v3 -> v4 -> v5
v4 -> v5
```

The v2-to-v3 migration derives one stable default-layer ID from the document
ID, assigns every existing object to it with an identity transform, creates no
guides, and adds the reviewed snapping defaults. Migration history uses the
source `updatedAt`, so repeated reads serialize identically. Opening does not
rewrite the source file. The v3-to-v4 migration preserves the document and
records the transition using the source `updatedAt`. A later explicit save
writes schema v5. The v4-to-v5 migration also preserves the document byte
shape, adds no empty handle arrays, and records the transition with the source
`updatedAt`.

Schema-v5 paths keep ordered millimeter anchors and may persist one handle
record per anchor. Incoming and outgoing cubic controls are nullable absolute
local-space points. Omission is the canonical all-line form. Handle count must
equal node count, and a closed path requires at least three nodes.

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

SVG is an editable 2D interchange format. Input is limited to 5 MB, 50,000 XML
elements, and 200,000 geometry points. DTD/entity declarations, scripts,
foreign objects, images, event-handler attributes, and references are rejected.

Supported import elements:

| Element | Behavior |
| --- | --- |
| `svg`, `g` | Nested transforms normalize into world millimeters; group labels map to layers. |
| `line` | Open two-node path. |
| `rect` | Closed four-node path; rounded rectangles warn and skip. |
| `polyline`, `polygon` | Open/closed paths with closure preserved. |
| `circle`, `ellipse` | Closed editable cubic paths. |
| `path` | M/L/H/V/C/S/Q/T/Z, absolute or relative; quadratic curves normalize to cubics. |

SVG elliptical-arc `A` path commands, text, `use`, and other visible unsupported
elements warn and skip instead of emitting partial geometry. Styling, fills,
strokes, clipping, and masks are not cut geometry.

Root `width`/`height` accept `mm`, `cm`, `in`, `px`, or unitless CSS-pixel
lengths. CSS pixels use exactly 96 px/in. A viewBox-only file uses that same
ratio and records the assumption. A single missing physical dimension is
inferred only when a valid viewBox supplies the aspect ratio. `viewBox` and
`preserveAspectRatio` (`none`, meet, or slice with alignment) determine the
user-coordinate mapping. Percentages and relative CSS units are rejected.

SVG export writes UTF-8 XML with explicit `width="...mm"`, `height="...mm"`,
and `viewBox="0 0 width height"`. Visible world geometry is grouped by layer,
converted from LaserX Cartesian Y-up to SVG Y-down, and emitted as open/closed
paths. Curves are flattened at 0.01 mm.

## DXF

LaserX reads and writes ASCII 2D DXF group-code/value pairs. Input is limited
to 5 MB, 500,000 pairs, and 100,000 entity records.

Supported import entities:

| Entity | Behavior |
| --- | --- |
| `LINE` | Open path. |
| `LWPOLYLINE` | Open/closed path; bulge arcs flatten at 0.01 mm. |
| `POLYLINE` + `VERTEX`/`SEQEND` | Legacy 2D open/closed path. |
| `CIRCLE` | Closed path flattened at 0.01 mm. |
| `ARC` | Open counterclockwise path flattened at 0.01 mm. |

Layer group code 8 maps to LaserX layers. `$INSUNITS` 1, 4, and 5 mean inches,
millimeters, and centimeters. `$INSUNITS` 0 or absent is accepted only with an
explicit millimeter or inch assumption. Other units are rejected clearly.
Nonzero Z/elevation, 3D/polyface flags, splines, and unsupported entities warn
and skip.

DXF export writes AutoCAD 2013 ASCII (`AC1027`), `$INSUNITS = 4`
(millimeters), a layer table, `LINE` for open two-point paths, and
`LWPOLYLINE` for remaining open or closed flattened paths. Code 70 bit 1
preserves closure. Export summaries report path count, warnings, units, and
bounds. The pinned independent `dxf-parser` inspector verifies the representative
600 mm export's units, entity type, and closed flag.

Native DWG is out of scope. Do not rename a DXF file to `.dwg` or claim
equivalence.

## PNG/JPEG

Raster files are future tracing or reference inputs. Original pixels may later
be embedded or linked in the native project but never exported as cut paths.
