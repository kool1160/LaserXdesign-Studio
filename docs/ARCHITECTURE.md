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

## Performance strategy

1. Keep algorithms pure and measurable.
2. Avoid unnecessary React rerenders.
3. Run heavy tracing/geometry operations off the UI thread.
4. Add cancellation and progress reporting.
5. Profile representative fixtures.
6. Introduce WASM/native code only for proven bottlenecks behind existing interfaces.

## Extensibility

External providers and geometry engines must be behind interfaces. Do not design a public plugin system during version 1. Internal package boundaries are sufficient until real extension requirements exist.
