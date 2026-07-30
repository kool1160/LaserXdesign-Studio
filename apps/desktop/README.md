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

Production implementation begins in M01.
