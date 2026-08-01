# M09 — Sign-Building Tools and Templates

## User-visible outcome

Common signs can be built quickly without drawing every helper feature manually.

## Included

- outline/border around selected geometry;
- backing-plate generation;
- common outer shapes: rectangle, rounded rectangle, circle, oval, shield, badge/banner primitives;
- mounting-hole patterns with exact offsets and spacing;
- tabs/slots limited to sign assembly needs;
- baseline and arc text layout helpers;
- monogram/address/family-name/badge template parameter models;
- style presets made from licensed geometry and fonts;
- save user template;
- editable result after generation;
- validation through the standard cutability engine;
- template schema/versioning.

## Explicitly excluded

Marketplace, copyrighted logo library, full mechanical joint design, advanced nesting, and locked template output.

## Acceptance tests

1. Generated borders/backing plates have exact documented offsets.
2. Hole patterns remain exact after document unit changes.
3. Every generator produces ordinary editable objects and one undoable command.
4. Templates survive save/reopen and schema migration.
5. Licensed bundled template assets have provenance records.
6. Representative 24-inch badge, address sign, and layered family-name sign pass cutability and export workflows.

## Exit checklist

- [x] Template schema documented.
- [x] Asset/font licensing audit passes.
- [x] Three representative sign workflows pass end-to-end.
- [ ] Status advances to M10.
