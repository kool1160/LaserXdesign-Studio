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

### Production package — `packages/production-export`

Owns deterministic physical-layer filtering, per-layer SVG/DXF artifacts,
schema-2 manifests, explicit registration-object comparison, hashes, stock
thickness designations, and the
simple 2D assembly projection. It resolves only validated registration-hole
IDs that identify true world-space circles from domain metadata and derives
manifest centers and diameters from the same transformed geometry. Decorative
and distorted ellipses remain ordinary geometry. It never writes the
filesystem or changes authoritative geometry.

### Adapters

- `packages/fonts`
- `packages/import-raster`
- `packages/io-svg`
- `packages/io-dxf`
- `packages/project-format`
- `packages/ai`

Adapters translate external data into or out of normalized domain types. They do not own editor state.

For M12, schema v8 adds optional manufacturing metadata to ordinary layers.
Only explicitly tagged physical layers enter `packages/production-export` or
the per-layer analysis action; whole-design M08 analysis remains independent.
The Electron controller binds every successful cutability summary to one
atomic whole-design, explicit-selection, or manufacturing-layer projection;
pending and failed worker requests cannot mutate that published scope.
Electron main owns an atomic production-folder storage adapter and exposes only
layer IDs, output formats, and conflict intent through strict IPC. React owns
metadata forms, selection, status, and a presentation-only exploded stack.
ADR 0022 and `docs/PRODUCTION_PACKAGES.md` define the full contract.

For M13, schema v9 adds a nullable, material-validated U.S. stock designation
beside canonical `thicknessMm`; migration from v8 deliberately records null.
Vector import adapters publish bounded repair findings and geometry-linked
locations. The application layer owns the non-mutating three-way stock-fit
preview and includes any accepted stock resize in the same undoable import
command as the geometry. Resize-stock fitting may fit an empty project tightly;
on a non-empty project it preserves the current stock extent and unions every
existing authoritative object bound without moving or scaling existing objects.
DXF duplicate identity is an exact, same-layer canonical comparison independent
of closed-path start index and path direction; the 0.1 mm endpoint-closure
tolerance is never reused as identity.

The M13 credential interaction is a main-created modal `BrowserWindow` bound to
the LaserX parent window. It loads only repository-owned inline UI through a
dedicated minimal preload, has no normal application preload/state, Node,
navigation, network, DevTools, or project access, and accepts submit/cancel IPC
only from its own `webContents`. Electron main destroys the window on submit,
cancel, or controller timeout, tests the ephemeral key, and writes it only
through the existing `safeStorage` vault boundary.

The remaining M13 release boundary uses a stable `studio.laserx.desktop`
identity and an x64 assisted NSIS installer. The installer owns Start Menu and
optional desktop shortcuts plus explicit uninstall data-retention choices; it
never owns user-selected project or export files. Electron main maps session
data, logs, and local crash dumps under the per-user `userData` root. A fatal
renderer path settles older autosave work, writes the latest dirty recovery
snapshot, and relaunches without changing the last explicit save.

Production signing is injected only at the packaging boundary and is required
to succeed before publication. A manual tagged release produces a schema-1
manifest binding the exact source commit to x64 installer/application hashes
and Authenticode identity. Pull-request CI uses only a disposable runner-local
test certificate; auto-update and crash/telemetry upload remain absent. ADR
0023 and `docs/WINDOWS_BETA_RELEASE.md` define the complete contract.

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
ephemeral summary. Cubic controls are transformed to world millimeters before
flattening, while ellipses use the maximum stretch of the complete affine
transform to preserve the 0.01 mm world-space tolerance. DXF expansion and the
application preview boundary each enforce a 200,000-point budget. ADR 0016
records this boundary.

For M07, `packages/import-raster` owns source-header inspection, preprocessing,
the replaceable `RasterTraceEngine`, deterministic contour filtering/tracing,
and bounded preview pixels. The selected LaserX-owned grid-trace adapter is
pinned at version 1.0.0 and has no third-party runtime dependency. It converts
four-connected thresholded pixel regions into normalized closed millimeter
paths, reports every removed sub-threshold foreground island, and accepts a
simplified result only when measured deviation stays within the selected
millimeter tolerance.

Electron main owns PNG/JPEG dialogs, a 12 MiB binary storage adapter,
pre-decode dimension checks, `nativeImage` normalization, and main-generated
preview data URLs. The renderer sends only settings and an operation ID; paths
and raw pixels never enter renderer requests. Decoded input is capped at 20
million pixels/80 MiB. The worker caps trace resolution at 4 million pixels,
boundary edges at 800,000, and editable results at 200,000 nodes. The controller
reserves before the chooser and applies a post-selection 30-second deadline to
read, inspect, decode, worker, encode, validate, and publish stages; the worker
also retains its own deadline. Cancellation is operation-ID-aware, progress is
projected only for the active operation, and a document fingerprint rejects
stale results.

The application session owns the raster candidate, fresh path/layer IDs, and
preview fingerprint. Original, black/white, edge, trace-only, and aligned
original-plus-trace views remain non-authoritative. Encoded previews validate
before candidate publication so replacement is atomic. Reject, cancel, timeout,
and any stage failure cannot alter the prior candidate, document, dirty state,
or history. Accept uses one `objects.import`
command, after which ordinary editable paths enter the standard
`packages/cutability` interface. M07 originally stopped at a review-required
boundary; M08 now runs the accepted paths through actual manufacturing-rule
analysis. ADR 0019 records the trace engine, licensing, trust boundary, and
limits.

For M08, schema v6 persists editable manufacturing settings and records which
numeric values differ from the selected starting preset. `packages/cutability`
normalizes visible lines, rectangles, ellipses, paths, text contours, and group
descendants to world-millimeter polylines under the established 0.01 mm
flattening tolerance. Analysis is capped at 50,000 flattened segments and
reports deterministic issue IDs, severity, affected object/segment IDs,
measured and configured millimeter values, location, explanation, and repair
guidance for every required rule class.

Region classification uses geometry containment rather than text or character
names. Stock outside all valid closed contours is explicitly retained, and
each containment depth toggles removed/retained material. Any open,
degenerate, self-intersecting, or mutually intersecting contour makes the whole
preview ambiguous. The renderer therefore cannot present a definitive
retained/drop-out classification when the topology does not support one.

Electron runs the pure analysis task in a dedicated worker. Renderer requests
contain only an operation ID and an optional selected-object scope; geometry
comes from the authoritative main-process session. Cancellation terminates the
worker. An exact analysis-input fingerprint—manufacturing settings, layer
visibility/lock state, and visible objects—rejects late relevant results, and
the one-entry cache keys both that fingerprint and the normalized object
scope. Geometry/import/text/manufacturing commands invalidate analysis and
bridge state, while display preferences, guides, layer names, and
selection-only issue navigation do not.

Bridge proposals are derived candidates. Manual mode evaluates one cardinal
direction; automatic mode deterministically chooses the shortest of four
collision-free cardinal candidates. The proposal must meet the configured
minimum width and leaves project, dirty state, and history unchanged. The M08
baseline repairs only a disconnected island and its containing top-level paths
on the same editable layer. Acceptance rechecks the fingerprint, materializes
ordinary closed paths through the existing Clipper2 boundary, and dispatches
one undoable topology replacement. Rejection is non-mutating. ADR 0020 records
the settings, classification, worker/cache, ambiguity, and repair decisions.

For M09, `packages/sign-tools` owns pure bounded sign generation. Parameter
requests cover exact selection borders, backing plates, common outer shapes,
mounting holes, sign-assembly tabs/slots, and versioned sign templates. The
package reuses the established geometry and cutability-normalization boundaries
and returns only candidate layers plus ordinary domain objects. Electron main
adapts baseline/arc requests to the existing font engine; React never creates
geometry, contours, IDs, or font paths.

The application session owns sign candidate state and its source-project
fingerprint. Preview is a pointer-inert overlay. Acceptance uses one
`objects.import` history command and immediately sends the accepted IDs to the
standard cutability worker. Saved template intent was introduced in schema v7 and remains separately persisted
from generated geometry. Runtime presets and
`packages/sign-tools/sign-assets.json` must agree under the template asset
audit. ADR 0021 records the schema, authority, history, and provenance policy.
Layer membership remains organizational: automatic acceptance and Analyze all
use one complete M08 geometry scope. Only an explicit object-ID selection may
narrow analysis, and the published summary retains that exact scope and the
full document fingerprint.

For M10, `packages/ai` owns the provider-neutral request/result contract,
OpenAI Responses mapping, strict structured-output validation, and provider
error classification. Electron main owns credential acquisition, Windows
`safeStorage`, provider calls, bounded reference reads, normalization, and
worker coordination. The sandboxed renderer receives only typed intent DTOs,
bounded media previews, concept summaries, and normalized editable previews;
it never receives a credential or creates provider geometry.

Structured output is materialized through the M09 generator. Raster fallback
is decoded and traced through M07. Every temporary concept is analyzed through
M08 before publication and remains `cutReady: false`. The application session
owns the preview and source-project fingerprint. Wording mismatch or stale
project state blocks acceptance; a successful acceptance is exactly one
`objects.import` command followed by a fresh analysis of the accepted IDs.
Prompts, references, alternatives, provider metadata, usage, and AI provenance
remain transient and do not change schema v9.

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
