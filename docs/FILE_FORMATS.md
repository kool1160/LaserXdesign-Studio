# File Formats

## Native project

Extension: `.laserx`.

Schema version 9 is strict, deterministic UTF-8 JSON with a trailing newline.
It contains project identity/timestamps; a stable document ID; canonical
millimeter dimensions; the fixed Cartesian origin; display, viewport, and
snapping preferences; editable manufacturing settings; ordered layers and
guides; recursive groups; and ordered objects with stable IDs, layer
references, and affine transforms. Manufacturing settings persist process,
material, canonical millimeter thickness, an optional user-selected stock
designation, kerf, minimum feature/bridge/gap, contour and optional
heat-distortion spacing, tolerance preset, starting preset ID, and the fields
the user customized. Editable text
adds font identity/fingerprint, millimeter typography settings, optional arc
intent, and materialized contours carrying deterministic nonnegative glyph-
compound indices. The indices preserve counter-versus-overlap fill semantics
without changing outline conversion, which still emits every contour.
Converted outline groups may preserve editable source metadata.
Schema v7 introduced and schema v9 retains at most 1,000 strict version-1 saved sign
template parameter records. Template intent includes a UUID, user name, kind,
audited style preset, exact millimeter dimensions, border and mounting-hole
parameters, font/text settings, and an optional arc radius. Generated geometry,
preview state, and cutability results are not template data. See
`docs/SIGN_TEMPLATES.md`.
Schema v8 adds optional manufacturing-layer metadata: role, material, positive
millimeter thickness, process, notes, an optional registration-group name, and
an ordered list of explicitly designated top-level ellipse object IDs for
registration holes. Those IDs must be unique, resolve on the same layer, and
emit true circles in world space after their affine transforms. Ovals, skewed
ellipses, and non-uniformly distorted circles fail validation, as do IDs used
by preview-only or unnamed groups. Early schema-v8 files that predate the
designation field normalize it to an empty list; no ellipse is inferred as a
hole.
Absence means an ordinary editing layer. See `docs/PRODUCTION_PACKAGES.md`.
Schema v9 adds an optional stock-thickness designation beside every global and
physical-layer canonical `thicknessMm`. Gauge designations are validated
against material-specific mild-steel, stainless-steel, or aluminum tables;
fractional-inch plate, millimeter, and custom labels carry no gauge material.
The v8-to-v9 migration writes `null` globally and per declared layer. It never
guesses a gauge or plate label from a legacy decimal thickness.
`fixtures/projects/editing-v4.laserx` remains the reviewed v4 compatibility
fixture; schema-v5 curve persistence and schema-v6 manufacturing-setting
persistence are exercised by the project-format round-trip suite.

Object array order is z-order within layer order. Layer visibility, locking,
name, and active-layer identity are persistent. Selection, clipboard, undo/redo
history, transient camera position, and transform-handle state are not project
data.

Every descendant of a schema-v9 group must use the same `layerId` as the
group. Parsing, serialization, and internal insertion reject mixed-layer
groups. Layer moves, grouping, duplicate/paste, ungrouping, and layer deletion
preserve this recursive invariant; schema v9 does not define independent child
layer semantics inside a group.

The parser rejects unknown fields, invalid object geometry or matrices,
dangling layer references, corrupt JSON, and schema versions newer than the
application supports. Files remain limited to 10 MB.

Schema versions 1 through 8 remain read-compatible through explicit
deterministic migrations:

```text
v1 -> v2 -> v3 -> v4 -> v5 -> v6 -> v7 -> v8 -> v9
v2 -> v3 -> v4 -> v5 -> v6 -> v7 -> v8 -> v9
v3 -> v4 -> v5 -> v6 -> v7 -> v8 -> v9
v4 -> v5 -> v6 -> v7 -> v8 -> v9
v5 -> v6 -> v7 -> v8 -> v9
v6 -> v7 -> v8 -> v9
v7 -> v8 -> v9
v8 -> v9
```

The v2-to-v3 migration derives one stable default-layer ID from the document
ID, assigns every existing object to it with an identity transform, creates no
guides, and adds the reviewed snapping defaults. Migration history uses the
source `updatedAt`, so repeated reads serialize identically. Opening does not
rewrite the source file. The v3-to-v4 migration preserves the document and
records the transition using the source `updatedAt`. A later explicit save
writes schema v9. The v4-to-v5 migration also preserves the document byte
shape, adds no empty handle arrays, and records the transition with the source
`updatedAt`. The v5-to-v6 migration adds the documented editable manufacturing
defaults and records the transition using the same source timestamp. Opening
still does not rewrite the source file. The v6-to-v7 migration adds an empty
template library and records the transition using that same source timestamp.
The v7-to-v8 migration preserves every layer without manufacturing metadata,
so opening a legacy project never infers physical pieces from names or state.
The v8-to-v9 migration preserves canonical thickness values and records a null
designation, so legacy decimals never acquire an invented U.S. stock name.

Schema-v9 paths retain the schema-v5 representation: ordered millimeter
anchors may persist one handle
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
to 5 MB, 500,000 pairs, 100,000 entity records, and 200,000 cumulative expanded
geometry points. The point budget is checked before sampled arc, circle, or
bulge arrays are allocated and is checked again before application preview.

Supported import entities:

| Entity | Behavior |
| --- | --- |
| `LINE` | Open path. |
| `LWPOLYLINE` | Open/closed path; bulge arcs flatten at 0.01 mm. |
| `POLYLINE` + `VERTEX`/`SEQEND` | Legacy 2D open/closed path. |
| `CIRCLE` | Closed path flattened at 0.01 mm. |
| `ARC` | Open counterclockwise path flattened at 0.01 mm. |
| `SPLINE` | Planar degree-1-through-5 rational B-spline converted by bounded adaptive sampling at 0.01 mm; invalid knots, weights, or control counts become explicit skipped-entity findings. |

Circles whose radius is at or below the curve tolerance still materialize at
least three distinct nodes, preserving the closed-path document invariant.
Inputs that would exceed the expanded-point budget fail the whole preview
instead of returning a partial candidate.

Layer group code 8 maps to LaserX layers. `$INSUNITS` 1, 4, and 5 mean inches,
millimeters, and centimeters. `$INSUNITS` 0 or absent is accepted only with an
explicit millimeter or inch assumption. Other units are rejected clearly.
Nonzero Z/elevation, 3D/polyface flags, and unsupported entities warn
and skip.

Before commit, DXF preview removes exact/zero-length duplicate nodes and closes
endpoint gaps no larger than the documented 0.1 mm repair tolerance. Duplicate
paths use a separate zero-tolerance canonical identity: coordinates and layer
must match exactly, open direction is ignored, and closed start index and
direction are normalized deterministically. Nearby paths and handled paths with
uncertain identity are retained. Every applied repair is listed with its own
tolerance and linked to the surviving preview object; skipped entities remain
explicit, so a partial import cannot look complete. The user then chooses one
of three stock fits: resize stock while preserving source scale, keep stock and
uniformly scale/center artwork, or keep both and allow overflow. Margin and
resulting stock/artwork scale remain visible. Tight stock fitting is allowed for
an empty project. For a non-empty project, resize-stock never shrinks the
current document and expands as needed to contain the unchanged existing
geometry plus the centered import. Acceptance commits the repaired geometry and
any chosen stock resize as one undoable `objects.import` command.

DXF export writes AutoCAD 2013 ASCII (`AC1027`), `$INSUNITS = 4`
(millimeters), a layer table, `LINE` for open two-point paths, and
`LWPOLYLINE` for remaining open or closed flattened paths. Code 70 bit 1
preserves closure. Export summaries report path count, warnings, units, and
bounds. The pinned independent `dxf-parser` inspector verifies the
representative 600 mm and 24 inch/609.6 mm exports' units, entity type, closed
flag, vertex coordinates, and physical bounds.

Native DWG is out of scope. Do not rename a DXF file to `.dwg` or claim
equivalence.

## PNG/JPEG

PNG and JPEG are untrusted tracing inputs. Files are limited to 12 MiB,
10,000 pixels per axis, 20 million decoded pixels, and 80 MiB RGBA. Signatures
and dimensions are inspected before Electron's main-process decoder runs.
Animated PNG is rejected; Electron's decoder ignores JPEG EXIF orientation, so
quarter-turn rotation is an explicit trace setting.

The selected crop/rotation is mapped to an explicit millimeter output width
with square pixels. Luminance/average grayscale, contrast, threshold, invert,
box blur, median denoise, alpha-background mode, speckle area, smoothing, and
simplification settings are deterministic and recorded with the candidate.
Trace work is capped at 4 million pixels, 800,000 boundary edges, 200,000
editable nodes, and 30 seconds. A bounded original, black/white, and edge
preview may cross main-to-renderer state as internally generated PNG data URLs;
local paths and raw source pixels never cross renderer requests.

Reject/cancel persists nothing. Acceptance stores only ordinary editable
millimeter paths through one undoable command. Original pixels,
preview images, trace settings, and engine-specific records are not embedded in
the current `.laserx` schema and raster pixels are never manufacturing export
geometry.

## AI concepts

AI concepts do not add a file format or schema-v9 record. Before acceptance,
prompt text, a consented reference image, concept alternatives, wording review,
provider/model/request IDs, usage, analysis, and provenance are transient host
state. Discard, failure, project replacement, or application exit persists none
of them.

Acceptance stores only the same ordinary millimeter layers and line,
rectangle, ellipse, path, text, or group objects produced by manual/import/sign
tools. No provider payload, raster fallback bytes, prompt, reference,
credential, AI provenance, or bypass flag is serialized. Normal SVG/DXF export
therefore sees only reviewed editable geometry.
