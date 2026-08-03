# Physical preview lab fixtures

Reviewed, deterministic `.laserx` fixtures for `apps/physical-3d-preview-lab` and `packages/physical-preview-3d`. Generated from `@laserx/domain` + `@laserx/project-format` (not hand-written) and verified to round-trip through the strict schema-v9 parser.

- `single-layer-face-plate.laserx` — one physical `face` layer, mild steel, 3 mm, a 160×80 mm rectangle with one 30 mm-diameter through-hole. 200×120 mm stock.
- `two-layer-face-backing.laserx` — two ordered physical layers with distinct roles/materials/thicknesses (`face`: mild steel, 3 mm, rectangle with a circular through-hole; `backing`: acrylic, 6 mm, larger rectangle with a rectangular slot cutout), plus a third `non-cut-preview` layer that must be excluded from any physical assembly. 220×140 mm stock.
