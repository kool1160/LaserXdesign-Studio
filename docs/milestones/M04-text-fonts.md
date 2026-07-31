# M04 — Text, Fonts, and Outline Conversion

## User-visible outcome

Users can create professional sign lettering, browse fonts, adjust layout, and convert text into editable cut geometry without losing exact scale.

## Included

- text objects with content, font family/style, size, alignment, line spacing, and tracking;
- installed-system-font discovery through a secure boundary;
- bundled-font catalog with license metadata and attribution;
- favorites, recent fonts, search, and sign-style categories based on metadata rather than unlicensed copying;
- live text editing;
- letter/word/line spacing;
- text on a simple arc or path;
- text-to-outline conversion;
- preserve original editable text as optional hidden/source data;
- missing-font handling and substitution preview;
- font-license audit tool and CI rule;
- representative stencil, script, serif, slab, western, industrial, and display fixtures using redistributable fonts.

## Explicitly excluded

Automatic bridge placement, advanced typography engine parity, commercial font bundling, logo libraries, and AI generation.

## Acceptance tests

1. Text dimensions and outline dimensions agree within tolerance.
2. Convert-to-outline is undoable and survives save/reopen.
3. Missing fonts do not silently change saved geometry.
4. Font enumeration cannot expose arbitrary filesystem access to renderer code.
5. Bundled fonts each have a machine-readable license record and license file.
6. Arc text remains editable before conversion and exports as geometry after conversion.
7. Common enclosed letters are identifiable by later cutability interfaces without hard-coded alphabet assumptions.

## Exit checklist

- [x] Font licensing audit passes.
- [x] Text and outline golden fixtures reviewed.
- [x] Text workflow end-to-end test passes.
- [ ] Status advances to M05.
