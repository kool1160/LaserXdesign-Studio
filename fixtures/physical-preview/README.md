# Physical preview lab fixtures

Reviewed, deterministic `.laserx` fixtures for `apps/physical-3d-preview-lab` and `packages/physical-preview-3d`. Generated from `@laserx/domain` + `@laserx/project-format` (not hand-written) and verified to round-trip through the strict schema-v9 parser.

- `single-layer-face-plate.laserx` — one physical `face` layer, mild steel, 3 mm, a 160×80 mm rectangle with one 30 mm-diameter through-hole. 200×120 mm stock.
- `two-layer-face-backing.laserx` — two ordered physical layers with distinct roles/materials/thicknesses (`face`: mild steel, 3 mm, rectangle with a circular through-hole; `backing`: acrylic, 6 mm, larger rectangle with a rectangular slot cutout), plus a third `non-cut-preview` layer that must be excluded from any physical assembly. 220×140 mm stock.
- `partial-assembly-empty-layer.laserx` — one valid physical `face` layer (mild steel, 3 mm, rectangle) plus one declared physical `backing` layer (acrylic, 6 mm) with zero objects, exercising the `EMPTY_PHYSICAL_LAYER` finding and `"partial"` assembly status. 150×100 mm stock.

## Phase 3 stress/determinism fixtures

Added for the Phase 3 evidence work (see `docs/experiments/m14-physical-3d-preview/PHASE3_EVIDENCE.md`). Gauge and fractional-inch thicknesses come from domain's own `stockThicknessChoicesForMaterial`, so they are exact by construction rather than hand-computed.

- `gauge-stock-sign.laserx` — **gauge** stock designation: `16 ga` mild steel, canonical `1.51892 mm`. Rectangle plus two circular through-holes. 200×120 mm stock.
- `fractional-inch-stock-sign.laserx` — **fractional-inch** stock designation: `1/8 in` stainless steel, canonical `3.175 mm` exactly. Rectangle with a square cutout. 200×120 mm stock.
- `transformed-group-sign.laserx` — aluminum 3 mm; a group carrying an exact scale-2/rotate-90°/translate matrix (integer coefficients, no trig, so world coordinates stay exact) composed with per-child translations. Pins affine composition.
- `multi-layer-mixed-stock.laserx` — three physical layers spanning **all three** designation kinds and three materials: `14 ga` mild steel (`1.89738 mm`), `1/4 in` aluminum (`6.35 mm`), `6 mm` acrylic. Declared depth sums to exactly `14.24738 mm`.
- `invalid-open-contour.laserx` — deliberately open contour. Must yield zero shapes, an `OPEN_CONTOUR` finding, and `"partial"` status.
- `invalid-self-intersecting.laserx` — deliberate bowtie self-intersection. Must yield zero shapes plus `SELF_INTERSECTION` and `UNSUPPORTED_GEOMETRY` findings.
- `high-complexity-sign.laserx` — **representative** (not worst-case) high-complexity sign: 500×290 mm, two layers, **58 objects** → 10 solid shapes with 48 interior cutouts. Composition: face plate + 36 letter-stroke cutouts + 8 mounting holes (45) over a backing plate + 12 vent slots (13).

Every fixture's reviewed properties are pinned by `apps/physical-3d-preview-lab/tests/phase3Fixtures.test.ts`, and the authoritative key/file/status list lives in `apps/physical-3d-preview-lab/src/fixtureRegistry.ts`. The lab app can load any of them via `?fixture=<key>`.
