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

## M02 implementation

The main process owns the authoritative project session, menus, native
dialogs, validated filesystem adapters, recents, dirty-close protection,
autosave, and recovery. Preload exposes the frozen typed `window.laserx`
allowlist. The renderer is sandboxed, context-isolated, and has Node integration
disabled.

The schema-v2 document projection flows through validated preload IPC. The
renderer adapter in `src/lib/viewport-adapter.ts` converts canonical
millimeters and Cartesian coordinates into CSS-pixel SVG primitives. React
renders rulers, grid, stock, placeholder objects, and coordinate readout while
keeping document geometry outside component state.

Run `pnpm dev` from the repository root for development. `pnpm test:e2e`
packages and tests the unpacked Windows application.
