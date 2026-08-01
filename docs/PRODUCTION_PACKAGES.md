# Production Packages

## Manufacturing-layer scope

An ordinary editing layer is not a physical part. Per-layer analysis and
production export are available only after the user assigns strict
manufacturing metadata: role, material, positive millimeter thickness,
process, notes, an optional registration-group name, and explicit registration-
hole object IDs.

Supported roles are `face`, `backing`, `spacer-tab`, `drill-reference`, and
`non-cut-preview`. Preview-only layers must use process `non-cut`; physical
roles cannot. Physical processes are laser, plasma, waterjet, router, or
drill. Schema v8 persists this optional metadata. The v7-to-v8 migration adds
no metadata, so no legacy editing layer is silently reclassified.

Whole-design M08 analysis remains available. “Analyze this physical layer”
passes only that layer’s authoritative object IDs to the same analysis worker
and projects the result with an explicit manufacturing-layer scope. A result
never implies that the whole design and one physical layer are equivalent.
“Analyze selection” is a third, explicit scope and records the exact analyzed
object IDs. Scope and result publish atomically only after a successful worker
or cache result; cancellation or failure preserves the prior pair unchanged.
After bridge acceptance, reanalysis uses the original successful scope rather
than the renderer's incidental current selection.

## Alignment and registration

Center alignment translates all editable objects on a target physical layer
until its world-space bounds center matches the selected reference layer.
Registration coordination requires the same nonempty registration-group name.
The user designates selected top-level ellipse objects as holes; no ordinary
circle, oval, decorative ring, cutout, badge element, or other ellipse is
inferred. Coordination replaces only the target layer's designated objects
with fresh-ID copies of the reference layer's designated objects and updates
the target designation in the same undoable transaction. Unrelated geometry
on both layers remains byte-for-byte unchanged. Duplicate, missing, nested,
wrong-layer, non-ellipse, unnamed-group, and preview-only references fail
closed before coordination or export.

The package manifest records only designated holes, including their source
object IDs, world-millimeter centers, and diameters, and warns if another layer
in the named group differs numerically. Decorative ellipses remain ordinary
manufacturing geometry in that layer's SVG/DXF and object count, but never
appear as registration evidence.

The renderer’s exploded preview is a simple two-dimensional stack of physical
layer bounds. Its visual offsets are presentation only and never alter stored
or exported coordinates.

## Folder and file contract

The default folder name is `<safe-project-name>-production`. Physical layers
retain document order. Each selected layer receives one file per requested
format:

```text
01-face-front-face.svg
01-face-front-face.dxf
02-backing-backing.svg
02-backing-backing.dxf
manifest.json
```

Filename parts are lowercase ASCII letters/numbers separated by hyphens. The
ordinal is two digits. Every SVG declares millimeter width/height and the full
stock `viewBox`; every DXF declares `$INSUNITS = 4`. Both reuse original world
coordinates, so all files share origin `(0, 0)`, scale, and stock dimensions.
Hidden state does not suppress a selected physical layer. `non-cut-preview`
layers are never emitted as SVG or DXF manufacturing artifacts.

`manifest.json` is deterministic UTF-8 JSON with a trailing newline. Schema 1
records:

- source schema/project/document identity and source update timestamp;
- package name, millimeter units, origin, and stock dimensions;
- each layer’s identity, role, material, thickness, process, notes, object
  count, exact bounds, explicitly designated registration-hole object IDs and
  coordinates, and warnings;
- each actual SVG/DXF filename, byte length, SHA-256 digest, and format;
- package-level registration and preview-exclusion warnings.

The manifest does not list itself because a self-digest would be recursive.
No PDF or raster assembly artifact is emitted in M12.

## Conflict and failure behavior

The main process writes every file into a new sibling staging directory. A
default export fails closed if the target exists. “Replace existing package”
is an explicit user choice: the existing folder is moved to a temporary backup,
the complete staging folder is renamed into place, and the backup is removed
only after commit. A failed replacement restores the backup when possible.

Any per-file or rename failure returns `status: failed`, the failed filename,
error text, and the staged filenames reached before failure. Staging is
removed, no incomplete destination is called successful, and the renderer
shows zero published files. Export never generates CAM, nesting, G-code, DWG,
machine instructions, quotes, BOMs, or installer output.
