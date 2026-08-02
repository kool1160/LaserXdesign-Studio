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

## M13 Windows beta boundary

`package:win` remains the unpacked Playwright target. `package:installer`
builds the assisted x64 NSIS installer for local inspection with certificate
auto-discovery disabled. `package:installer:signed` enables fail-closed signing
and is the only publishable path. The stable application ID, shortcut and
uninstall choices, runtime paths, signing inputs, upgrade contract, and manual
release gate are documented in `docs/WINDOWS_BETA_RELEASE.md` and ADR 0023.

## M06 interchange boundary

Electron main owns native SVG/DXF dialogs, bounded UTF-8 reads, atomic writes,
format parsing, and export serialization. The renderer sends path-free
validated preview/commit/cancel/export intents, renders an ephemeral import
overlay, and displays warnings, assumptions, units, dimensions, and summaries.
Preview does not make the project dirty; commit is one undoable application
command.

## M07 raster tracing boundary

Electron main owns PNG/JPEG dialogs, bounded binary reads, source/header
inspection, native decode normalization, and preview PNG encoding. A dedicated
worker owns preprocessing and the replaceable trace adapter. Renderer IPC
contains only an operation ID and validated settings; local paths and raw pixel
buffers stay outside the sandboxed renderer.

The controller reserves the operation before the native chooser, rejects a
second request before another dialog can open, and uses one operation-ID-aware
abort lifecycle. After file selection, a 30-second deadline covers read,
inspection, decode, worker execution, preview encoding/validation, and atomic
candidate/media publication. Any cancellation or failure clears only that
operation and preserves the previously visible preview and project state.

React displays worker progress, preprocessing controls, original/black-white/
edge/trace/overlay views, and candidate summaries. Reject and cancellation are
non-mutating. Acceptance inserts ordinary editable paths as one command and
immediately runs the standard manufacturing analysis without a cut-ready
claim.

## M08 manufacturing-analysis boundary

Electron main snapshots the authoritative schema-v6 document and executes the
pure cutability task in a dedicated worker. Renderer requests carry only an
operation ID, optional object IDs, settings intent, issue focus, or bridge
intent; the renderer cannot submit analysis geometry or replacement paths.
Worker termination handles cancellation, document fingerprints reject late
results, and cache entries require an exact document and scope match.

React edits transparent preset-derived settings, shows progress, filters and
navigates measured issues, and overlays retained, removed, or ambiguous
regions. Manual and automatic bridges are previews until explicit acceptance.
Only main can materialize a validated proposal through one undoable topology
command. The UI always displays the stock assumption and the non-certification
disclaimer.

## M09 sign-generation boundary

Electron main owns audited font loading and pure sign generation. Renderer IPC
contains only bounded utility or versioned-template parameters; it cannot
submit generated contours, object IDs, font paths, or provenance. Preview is
ephemeral, rejection is non-mutating, and acceptance imports ordinary editable
objects as one undoable command.

Saved templates persist version-1 parameter intent in schema v8 rather than
generated geometry. Acceptance and Analyze all send one complete geometry
scope through the standard M08 worker; ordinary layer membership never implies
a separate physical sheet. Analyze selection is the explicit scoped workflow
and reports its exact analyzed object IDs. SVG/DXF export continues to flatten
the same ordinary document objects.
