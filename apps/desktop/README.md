# Desktop Application

Electron main/preload code and the React renderer live here.

## Boundaries

- `electron/` owns privileged desktop integration and typed IPC.
- `src/app/` owns renderer composition and routing.
- `src/features/` owns user-facing feature modules.
- `src/components/` contains reusable desktop-only presentation pieces.
- `src/state/` projects application/domain state for the renderer.
- `src/lib/` contains renderer adapters, never manufacturing geometry.
- `tests/` contains desktop unit, integration, and end-to-end coverage.

## M03 implementation

The main process owns the authoritative project session, menus, native
dialogs, validated filesystem adapters, recents, dirty-close protection,
autosave, and recovery. Preload exposes the frozen typed `window.laserx`
allowlist. The renderer is sandboxed, context-isolated, and has Node integration
disabled.

The schema-v3 document and explicit editor projection flow through validated
preload IPC. Main-owned application state includes selection, clipboard, and
bounded undo/redo history. Pointer, keyboard, menus, toolbar, and inspector
actions share the same validated command union.

The
renderer adapter in `src/lib/viewport-adapter.ts` converts canonical
millimeters, affine-transformed objects, Cartesian coordinates, hit gestures,
selection handles, rulers, and guides into CSS-pixel SVG primitives. React
renders the projection and forwards commands while keeping document geometry
and edit history outside component state.

Run `pnpm dev` from the repository root for development. `pnpm test:e2e`
packages and tests the unpacked Windows application.

## M06 interchange boundary

Electron main owns native SVG/DXF dialogs, bounded UTF-8 reads, atomic writes,
format parsing, and export serialization. The renderer sends path-free
validated preview/commit/cancel/export intents, renders an ephemeral import
overlay, and displays warnings, assumptions, units, dimensions, and summaries.
Preview does not make the project dirty; commit is one undoable application
command.
