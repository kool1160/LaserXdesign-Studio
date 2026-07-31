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

The final representation will be selected and recorded during the relevant milestone, but it must support:

- open and closed paths;
- line and curve segments;
- stable object IDs;
- deterministic serialization;
- transforms without uncontrolled precision loss;
- conversion to flattened polylines under explicit tolerance;
- winding and containment analysis;
- booleans and offsets through a replaceable engine boundary.

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
