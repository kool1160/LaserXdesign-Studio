# Architecture

## Architectural goal

Keep manufacturing geometry deterministic, testable, and independent from the desktop UI. The application may evolve, but project files and exported dimensions cannot depend on a particular React component or canvas library.

## Layers

### Desktop shell — `apps/desktop`

Owns windows, menus, recent files, operating-system dialogs, secure IPC, crash recovery, updates, and UI composition.

### Application — `packages/application`

Owns use cases and commands such as create project, import artwork, apply transform, generate bridge proposal, save, export, and undo/redo orchestration.

### Domain — `packages/domain`

Owns project/document entities, identifiers, layers, objects, units, transforms, settings, validation-independent invariants, and command contracts.

### Geometry — `packages/geometry`

Owns points, curves, paths, bounding boxes, transforms, topology helpers, booleans, offsets, simplification, intersections, winding, containment, and tolerances.

### Manufacturing analysis — `packages/cutability`

Owns process presets, limits, issue detection, retained/drop-out region classification, bridge proposals, and repair summaries.

### Adapters

- `packages/fonts`
- `packages/import-raster`
- `packages/io-svg`
- `packages/io-dxf`
- `packages/project-format`
- `packages/ai`

Adapters translate external data into or out of normalized domain types. They do not own editor state.

## Process boundary

Electron main process owns privileged file and network operations. The renderer receives a narrow typed API through preload with context isolation enabled. The renderer never receives unrestricted filesystem or process access.

For M01, Electron main also owns the authoritative `ProjectSession`, native
dialogs, validated file storage, recents, dirty-close decisions, autosave, and
recovery. Preload exposes a frozen allowlist whose request and result schemas
are validated at runtime. React holds only a replaceable projection of the
current desktop state.

The application-command interface and file-service boundary live in
`packages/application`. Schema parsing, deterministic serialization, and the
migration registry live in `packages/project-format`; Electron adapters perform
actual filesystem access.

For M02, the authoritative session introduced a schema-v2 `LaserxDocument`.
`packages/domain` owns millimeter dimensions, the Cartesian stock region,
display/viewport preferences, stable IDs, placeholder object types, and the
domain-unit hit-test contract. `packages/geometry` owns pure coordinate and
viewport math. `apps/desktop/src/lib/viewport-adapter.ts` is the renderer
adapter: it translates document objects, grid lines, rulers, and bounds into
CSS-pixel SVG primitives. React forwards interactions and renders the adapter
projection; it does not calculate canonical dimensions or mutate geometry.

For M03, the authoritative session writes schema v3 and explicitly separates
state ownership:

- `packages/domain` owns serializable layers, guides, recursive groups,
  millimeter geometry, affine transforms, hit testing, snapping, and pure
  editing commands;
- `packages/application` owns selection, clipboard, fresh-ID allocation,
  bounded history, transactions, undo/redo, and command orchestration;
- Electron main owns the application session and validates all renderer action
  requests;
- React owns only input/form and ephemeral camera presentation state.

Pointer, keyboard, menus, toolbars, and inspector controls all dispatch the
same `EditorActionRequest` union. The renderer adapter projects transformed
objects and selection handles to SVG, but SVG and CSS state are never
authoritative geometry. ADRs 0010–0011 record the editing and persistence
decisions.

For M04, `packages/fonts` owns font discovery, catalog metadata, licensed
bundled assets, shaping, curve flattening, and deterministic arc
materialization. Electron main is the only process that reads system-font
directories or font bytes. The renderer receives catalog records without
paths and submits only validated font IDs, content, and layout settings.
Authoritative editable text and materialized millimeter contours live in the
domain document and schema v4. Missing fonts never trigger implicit
re-materialization. Materialization persists a glyph-compound index with each
contour. Text projection and hit testing apply even-odd within each glyph and
union separate glyph compounds, so enclosed counters remain empty without
turning overlapping script or negatively tracked glyphs into holes. ADRs
0012–0013 record the font boundary and persistence decisions.

For M05, schema v5 adds optional one-to-one cubic handle records to ordinary
paths while leaving straight schema-v4 path geometry unchanged during
migration. `packages/geometry` owns node/segment math, De Casteljau splitting,
explicit-tolerance curve flattening, simplification, cleanup,
self-intersection reporting, and a replaceable `GeometryEngine`. The sole
engine adapter pins `clipper2-ts` for closed booleans and signed offsets and
quantizes canonical millimeters to integer micrometers at that boundary.
Cleanup removes duplicate or collinear anchors only when every control involved
in the affected segments is empty; handled anchors remain authoritative unless
a future operation can prove a replacement stays within the selected tolerance.

`packages/application` prepares selected closed paths in world millimeters and
materializes results with stable surviving IDs, fresh additional IDs, warnings,
discarded/replaced IDs, node counts, and a UI summary. Electron runs the pure
engine task in a dedicated worker thread. Cancellation terminates the worker;
a document fingerprint rejects stale results; only a completed current result
enters the authoritative session as one undoable command. React dispatches
validated path or geometry requests and renders projections only. ADRs
0014–0015 record the engine, worker, tolerance, and persistence decisions.

Geometry preparation preserves application selection order end to end. For
Subtract, the first selected path is the subject and every later selected path
is a clip; the renderer states that rule and keeps its selected-path projection
in the same order. Boolean, multi-path offset, and endpoint-join requests are
rejected unless every operand belongs to the same editable layer, preventing a
topology replacement from silently relocating source geometry. Joining open
curves moves the two endpoint anchors to their midpoint and translates the
adjacent cubic controls by the same deltas before merging their incoming and
outgoing controls.

For M06, `packages/domain` defines format-neutral import paths, warnings,
assumptions, export summaries, and a shared visible-world-geometry flattener.
`packages/io-svg` and `packages/io-dxf` are replaceable pure adapters that own
external syntax, unit metadata, supported-entity policy, transform/axis
normalization, and bounded parsing. They do not own editor state or filesystem
paths.

Electron main owns native SVG/DXF dialogs and a 5 MB bounded UTF-8 storage
adapter. Preload validates only `preview`, `commit`, `cancel`, and `export`
intents. React cannot submit a path or file contents. A normalized preview is
application state containing fresh paths and any new layers, plus units,
dimensions, assumptions, warnings, and bounds. It is rendered as a
noninteractive overlay and does not change the project fingerprint, dirty
state, or history. Commit rejects a stale fingerprint and applies all preview
layers/objects through one undoable `objects.import` command. Export reads the
authoritative document, writes through Electron main, and stores only an
ephemeral summary. ADR 0016 records this boundary.

## State flow

```text
User action
  -> application command
  -> domain/geometry operation
  -> immutable or transactional document result
  -> history entry
  -> renderer projection
  -> canvas update
```

Import flow:

```text
Untrusted file
  -> secure file read
  -> adapter parse
  -> normalized candidate objects + warnings
  -> user preview/decision
  -> application command
  -> document
```

AI flow:

```text
Prompt/image + explicit settings
  -> provider adapter
  -> candidate image/vector response
  -> normalize/trace
  -> cutability analysis
  -> preview
  -> application command
```

## Internal geometry representation

The selected M05 representation supports:

- open and closed paths;
- line and curve segments;
- stable object IDs;
- deterministic serialization;
- transforms without uncontrolled precision loss;
- conversion to flattened polylines under explicit tolerance;
- winding and containment analysis;
- booleans and offsets through a replaceable engine boundary.

Each path stores ordered point anchors and may store aligned nullable absolute
local-space incoming/outgoing cubic controls. No handle array means all
segments are straight. Engine output remains ordinary closed paths rather than
engine-specific document records.

## Units

All persisted dimensions use millimeters. UI may display inches or millimeters. DXF/SVG adapters handle unit metadata explicitly and are covered by scale fixtures.

The domain coordinate system is Cartesian with the stock origin at its
lower-left corner, positive X right, and positive Y up. Screen Y points down.
The pure boundary conversion and inverse are specified in
`docs/UNITS_AND_COORDINATES.md` and tested to `1e-9 mm`. Camera scale is CSS
pixels per millimeter; device-pixel ratio affects rendering density, not
measurements.

M03 object placement uses explicit affine matrices in millimeters. Composition,
world bounds, handle scaling/rotation, snapping targets, and group transform
composition remain in domain/geometry or renderer-adapter modules rather than
React components.

## Performance strategy

1. Keep algorithms pure and measurable.
2. Avoid unnecessary React rerenders.
3. Run heavy tracing/geometry operations off the UI thread.
4. Add cancellation and progress reporting.
5. Profile representative fixtures.
6. Introduce WASM/native code only for proven bottlenecks behind existing interfaces.

## Extensibility

External providers and geometry engines must be behind interfaces. Do not design a public plugin system during version 1. Internal package boundaries are sufficient until real extension requirements exist.
