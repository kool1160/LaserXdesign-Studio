# ADR 0022: Explicit Manufacturing Layers and Atomic Production Packages

## Status

Accepted.

## Decision

Schema v8 adds optional manufacturing metadata to ordinary domain layers. An
absent record means ordinary editing organization; no name, visibility state,
or M09 generator output implicitly creates a physical part. The deterministic
v7-to-v8 migration preserves all legacy layers without metadata.

Registration-hole identity is an explicit ordered list of top-level ellipse
object IDs on that metadata. The domain and project parser reject duplicate,
stale, nested, wrong-layer, non-ellipse, unnamed-group, or preview-only
references. A designated ellipse must emit a true circle in world space;
world-space ovals, skew, and non-uniform distortion are rejected rather than
being reduced to an ambiguous bounding-box diameter. Rotation, reflection,
uniform scale, and any equivalent affine representation whose emitted geometry
is circular remain valid. Coordination replaces only designated target holes,
assigns fresh IDs to copied source holes, and updates the target list within
the same undoable transaction. Decorative ellipses remain unrelated geometry.

`packages/production-export` is a pure package-construction boundary over the
authoritative project and existing SVG/DXF adapters. It filters one declared
physical layer at a time while retaining the original document dimensions and
coordinates. It returns immutable text artifacts, a schema-1 manifest, and a
non-authoritative 2D assembly projection. Preview-only layers are excluded by
contract. Per-layer cutability uses the existing worker and cache with an
explicit layer object-ID scope; standard whole-design analysis remains a
separate path.

Electron main owns folder selection, conflict policy, staging, replacement,
rollback, and result publication. The renderer submits only selected layer
IDs, formats, and `fail`/`replace` intent. It never submits geometry, file
contents, paths chosen outside the native dialog, or a success claim.

## Rationale

Optional metadata preserves existing editing semantics and makes physical
intent reviewable. Reusing the proven interchange adapters keeps scale and
geometry rules in one place. A staged folder commit makes a multi-file export
behave like one operation and makes partial failures explicit.
Restricting diameter holes to emitted circles keeps coordination, manifest
diameters, and mismatch warnings faithful without inventing a lossy ellipse
diameter convention.

## Alternatives

- Treating every visible layer as a part was rejected because design and
  annotation layers are common and M09 established ordinary layer semantics.
- A new physical-part object hierarchy was rejected because it would fork
  editing, grouping, hit-testing, and persistence behavior.
- Renderer-side ZIP/folder generation was rejected because filesystem writes
  and authoritative geometry belong to Electron main.
- PDF/raster assembly export was deferred; the safe 2D renderer projection is
  sufficient for M12 and is not manufacturing geometry.

## Consequences

Registration groups alone do not classify geometry; users must explicitly
designate each true world-space circle. Physical layer exports deliberately
include hidden and decorative geometry on the selected part, while manifest
registration evidence contains only validated designated IDs. An existing
package requires explicit replacement. M12 adds no 3D, bends, welds, BOM/ERP,
quoting, nesting, CAM sequencing, G-code, DWG, machine control, or installer
behavior.
