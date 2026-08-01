# M12 — Layered Sign Workflow and Production Export

## User-visible outcome

Users can organize a multi-layer metal sign, preview assembly, and export a clean folder/package containing each manufacturing layer at exact scale.

## Included

- semantic manufacturing layers such as face, backing, spacer/tab, drill/reference, and non-cut preview;
- layer material/thickness/process metadata;
- separate cutability analysis per explicitly declared manufacturing layer;
- backing and face alignment tools;
- registration/mounting hole coordination;
- simple 2D exploded/stack preview, not full 3D CAD;
- export package naming and folder rules;
- one DXF/SVG per selected manufacturing layer;
- manifest with dimensions, units, material notes, warnings, and source project version;
- assembly preview image/PDF only if implemented through a documented safe exporter;
- overwrite/conflict handling;
- export validation summary.

## Architecture boundary

Ordinary editing layers do not automatically become separate physical pieces. Independent per-layer analysis and export apply only to layers explicitly marked with manufacturing-layer metadata. Standard whole-design M08 analysis semantics remain available and unchanged.

## Explicitly excluded

Full 3D rendering, bend design, weld symbols, BOM/ERP, quoting, nesting, and CAM sequencing.

## Acceptance tests

1. Face and backing exports share the same coordinate origin and scale.
2. Registration holes align numerically across layers.
3. Non-cut preview objects never appear in manufacturing DXF.
4. Export manifest matches actual files and bounds.
5. Partial export failure is clearly reported and does not claim success.
6. Reopening the project preserves semantic layer metadata.
7. Standard whole-design analysis remains distinct from explicitly scoped manufacturing-layer analysis.
8. Representative two- and three-layer sign packages pass independent inspection.

## Exit checklist

- [ ] Export package schema documented.
- [ ] Manufacturing-layer metadata and scope rules documented.
- [ ] Layer alignment golden fixtures pass.
- [ ] Production-package end-to-end test passes.
- [ ] Status advances to M13.
