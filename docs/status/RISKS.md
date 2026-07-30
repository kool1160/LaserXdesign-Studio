# Known Risks

## Geometry-engine lock-in

Boolean and offset libraries differ in curve support, tolerance behavior, and licensing. Keep an adapter boundary and prove candidates with fixtures before committing.

## Scale errors

SVG and DXF unit handling can silently produce wrong physical dimensions. Scale fixtures and downstream CAM validation are release blockers.

## Tracing quality

Raster tracing can create excessive nodes, self-intersections, tiny islands, and unreadable details. Preprocessing and cutability analysis must be part of the same workflow.

## Electron security

File import and AI connectivity increase the risk of unsafe IPC or remote content. Keep privileged APIs narrow.

M01 mitigates the current shell with sandboxing, context isolation, disabled
Node integration, denied navigation/windows, strict IPC schemas, and packaged
security smoke tests. Every later privileged capability must extend that
allowlist explicitly.

## M01 known limitations

- Packaging produces a reviewed unpacked Windows smoke application, not an
  installer, branded application icon, or production signing/update flow;
  those remain M12 work.
- Recovery holds one active local snapshot and has no history/retention UI.
- Recent projects are path-based and do not yet detect moved files until open.
- Schema v1 intentionally stores only an empty document and settings. It has no
  layers, objects, canvas, geometry, text, import, export, or manufacturing
  data; those belong to later milestones.
- Project files are capped at 10 MB until embedded asset requirements exist.

## M02 known limitations

- The SVG viewport is a replaceable renderer for the current document sizes
  and placeholder objects; high-node-count performance is not yet characterized.
- Only ephemeral pan/zoom camera state is kept in the renderer. Persisted
  viewport preferences include rulers, grid, grid spacing, and snapping, not
  the last camera position.
- The hit-test interface exists in domain millimeters, but selection, handles,
  transforms, grouping, and layers are intentionally absent until M03.
- Placeholder paths are point sequences only. Production curves, node editing,
  booleans, offsets, imports, and exports remain later milestone work.
- Windows tests cover a forced 2× scale factor locally and in packaged
  Playwright. Broader multi-monitor/DPI-transition coverage remains M12.
- Project files remain capped at 10 MB and the packaged application continues
  to use the default icon and development signing behavior recorded for M01.

## M03 known limitations

- History stores bounded full-project snapshots. The 100-entry limit is
  deterministic and safe for current placeholder documents, but high-node-count
  memory performance remains an M12 measurement.
- The clipboard is in-application only. It does not interoperate with Windows
  vector/text clipboard formats.
- Snapping is intentionally basic and uses bounds/center targets. It has no
  angle, tangent, node, intersection, or production-guide inference.
- Groups are recursive affine containers over placeholder objects. There are no
  nested-layer semantics, clipping, masks, or production text/path editing.
- Layer visibility and locking govern selection and editing; there is no M03
  layer filtering, color system, or manufacturing-layer meaning.
- The replaceable SVG renderer is sufficient for M03 fixtures but has not been
  profiled for high-node-count production artwork.
- Selection/history/clipboard and camera position are session state and are
  intentionally not persisted.
- Production text, nodes, booleans, offsets, SVG/DXF, raster tracing,
  cutability, sign tools, AI, layered export, CAM, G-code, and DWG remain
  excluded.

## Scope explosion

General CAD, CAM, nesting, cloud sync, and plugin systems can consume the project. Milestone gates and non-goals are mandatory.

## Font licensing

Popular commercial sign fonts cannot be redistributed without permission. Maintain provenance and license audits for every bundled font.
