# Sign Templates

## Saved record

Schema v7 stores reusable templates in `document.templates`. Each record is
strict JSON:

```json
{
  "id": "823e4567-e89b-42d3-a456-426614174080",
  "name": "Twenty-four inch address",
  "templateVersion": 1,
  "stylePresetId": "industrial-stencil",
  "parameters": {
    "kind": "address",
    "shape": "rounded-rectangle",
    "widthMm": 609.6,
    "heightMm": 304.8,
    "borderWidthMm": 12,
    "holeDiameterMm": 6,
    "holeInsetMm": 25.4,
    "fontId": "bundled:saira-stencil-one",
    "fontSizeMm": 42,
    "primaryText": "1042",
    "secondaryText": "OAK STREET",
    "arcRadiusMm": null
  }
}
```

`kind` is `monogram`, `address`, `family-name`, or `badge`. `shape` is
`rectangle`, `rounded-rectangle`, `circle`, `oval`, `shield`, `badge`, or
`banner`. Length fields are finite canonical millimeters. Names and preset IDs
are limited to 100 characters, font IDs and text fields are bounded, mounting
hole inset must exceed the radius when holes are enabled, and one document may
contain at most 1,000 templates.

`templateVersion` versions the parameter record independently of the native
project schema. Version 1 saves intent only; generated layers, object IDs,
font contours, previews, and cutability results are derived and are not stored
in the template.

## Generation behavior

- Utility tools generate exact borders, backing plates, seven outer shapes,
  mounting-hole grids, and sign-assembly tabs or slots.
- Template styles select an audited shape and bundled font. User dimensions,
  text, border, hole, and optional arc parameters remain explicit.
- Baseline and arc text use the standard font engine and produce editable text
  objects with materialized contours.
- Candidate layers and objects are preview-only until acceptance.
- One acceptance imports the complete result as one undoable command and sends
  its object IDs through standard cutability analysis.
- Saving, applying, and deleting a user template are ordinary undoable project
  changes. Applying a saved template regenerates fresh object and layer IDs.

## Preset provenance

`industrial-stencil`, `classic-slab`, and `western-badge` use only
LaserX-authored algorithmic primitives plus the audited Saira Stencil One,
Roboto Slab, and Rye bundled fonts. The machine-readable records live in
`packages/sign-tools/sign-assets.json`; license texts remain in
`packages/fonts/licenses`. Run `pnpm audit:templates` after any preset or asset
change.

## Scope boundary

Templates do not imply a marketplace, licensed-logo entitlement, nesting,
mechanical joint design, machine settings, CAM, G-code, DWG, or certified
manufacturability. Multi-layer signs must be assigned to the intended material
stack and reviewed before export.
