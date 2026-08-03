# Physical Preview Engine Decision

Completed 2026-08-02 for GitHub Issue #34, on `experiment/m14-physical-3d-preview-lab`. This does not activate M14. M13 remains the active gate.

## Current LaserX source contracts

### Validated project loading and migration
- `@laserx/project-format`: `parseProject(serialized: string): LaserxProject` and `parseProjectValue(candidate: unknown): LaserxProject` (`packages/project-format/src/index.ts:1205,1277`) walk the migration chain to schema v9, validate against `laserxProjectSchema`, and re-validate entity-ID uniqueness, layer references, path validity, registration holes, and manufacturing-metadata invariants. `physical-preview-3d` consumes an already-validated `LaserxProject` produced by these functions; it does not re-implement or re-run validation itself.

### Physical manufacturing-layer designation and order
- `@laserx/domain`: `Layer { id, name, visible, locked, manufacturing?: ManufacturingLayerMetadata }` (`model.ts:266`). A layer is physical iff `manufacturing !== undefined && manufacturing.role !== "non-cut-preview"` — the exact predicate used by `@laserx/production-export`'s `buildProductionPackage`/`buildProductionAssemblyPreview`/`manufacturingLayerObjectIds` (`packages/production-export/src/index.ts:237-252,339-353`). Layer order is `document.layers` array position; there is no separate order field anywhere in the stack.

### Material identity and appearance metadata
- `ManufacturingMaterial = "mild-steel" | "stainless-steel" | "aluminum" | "wood" | "acrylic" | "other"` (`model.ts:62`).

### Canonical `thicknessMm` and stock designation
- `ManufacturingLayerMetadata.thicknessMm` (`model.ts:116`) is always millimeters, validated positive-finite. `StockThicknessDesignation` (`model.ts:130`) is a discriminated union (`gauge | fractional-inch | millimeter | custom`) purely for display; `formatStockThickness(thicknessMm, designation)` (`model.ts:183`) produces the human label. `validateStockThicknessDesignation` (`model.ts:838`) enforces the designation's table value matches the canonical `thicknessMm` to 1e-6mm. `physical-preview-3d` reads `thicknessMm` directly and never infers thickness from the designation label.

### Authoritative transformed contours
- No package carries a "contour with holes" compound type. `PathObject { closed, points, handles? }` (`model.ts:345`) and `TextContour` (`model.ts:372`) are individual contours; holed shapes are multiple sibling objects. World coordinates come from `DocumentObjectBase.transform` composed via `composeAffineTransforms` (`@laserx/geometry`) — `getObjectBounds` (`model.ts:1023`) is the canonical example of this composition.

### Cutout/hole topology
- `@laserx/cutability`'s `analyzeDocumentCutability` (`analysis.ts:649`) is the only place that computes real nesting topology: its private `classifyRegions` helper builds `CutabilityRegion { id, objectId, contourIndex, parentRegionId, depth, disposition, points, bounds, areaMm2 }` (`analysis.ts:60,577`) via point-in-polygon parent search on world-space flattened points, exposed through `CutabilityAnalysisSummary.regions`. This is authoritative topology (not visual overlap) and is reused — see "Resolved contour-polarity question" below for why its `disposition` field is *not* reused as-is.
- `classifyRegions` itself is module-private (no `export` keyword in `analysis.ts`); only `analyzeDocumentCutability` and its summary type are exported from the package barrel. `physical-preview-3d` therefore calls `analyzeDocumentCutability` on a single-layer-scoped document and reads `.status`/`.regions`/`.issues`, rather than re-implementing region classification — the "reuse, don't duplicate" boundary rule leaves no other option.

### Non-cut/preview exclusion
- Explicit and mechanical: `role === "non-cut-preview"` layers are dropped before any physical processing, both in `production-export` and, by direct replication of the same predicate, in `physical-preview-3d`. `validateManufacturingLayerMetadata` (`model.ts:1254`) enforces `(role === "non-cut-preview") === (process === "non-cut")` as a schema-level invariant, so the check is not just a convention.

### Cutability findings
- `CutabilityIssue { id, code, severity, objectIds, objectId, segmentIndices, segmentIndex, measuredValueMm, configuredLimitMm, location, message, suggestion }` (`analysis.ts:43`) — exactly the severity/object-refs/measured/limit shape `AGENTS.md` §11 requires. `physical-preview-3d` maps a narrow subset of issue codes (`OPEN_CONTOUR`, `SELF_INTERSECTION`, `DUPLICATE_SEGMENT`, `OVERLAPPING_SEGMENT`, `UNSUPPORTED_GEOMETRY` — the codes that force `analysis.status === "ambiguous"`) into preview findings. Manufacturing-limit codes (feature width, kerf, spacing) are cutability-process concerns, not 3D-preview concerns, and are intentionally not surfaced.

### Deterministic production-package evidence
- `@laserx/production-export`'s `buildProductionPackage`/`buildProductionAssemblyPreview` (`packages/production-export/src/index.ts:221,200`) confirm the physical-layer predicate above and confirm no filesystem writes exist in that package (only `node:crypto` is imported). One material gap: `ProductionAssemblyLayer.offsetMm` is a flat visual index offset (`index*12`), not a `thicknessMm`-based Z stackup — **no package in the repository currently computes a real 3D Z-stackup.** `physical-preview-3d` must originate this logic; it is new code, not a duplication of anything existing, and is explicitly deferred past this first slice (see "First implementation slice").

**No missing contract blocks this experiment.** The one true gap (Z-stackup) is squarely inside `physical-preview-3d`'s own stated mandate, not a missing LaserX contract.

## Resolved contour-polarity question (contour/hole correctness — high-capability review)

`CutabilityRegion.disposition` ("retained" | "removed") is **not** "solid material" vs. "hole" from a 3D-extrusion point of view, and must not be read that way. Cutability's own reviewed golden fixture proves this: a single standalone rectangle contour (`fixtures/cutability/m08-rule-goldens.json`, case `safe-single-cutout`) is classified `disposition: "removed"` — i.e., cutability's convention treats "the stock/background outside all closed contours [as] retained" (its own `previewAssumption` string) and a lone drawn contour as a *cutout removed from an implicit surrounding sheet*. That convention exists to detect drop-out islands and enclosed dropouts relative to an assumed stock frame — it is a cutability heuristic, explicitly disclaimed, and is never used by `exportSvg`/`exportDxf`/`production-export`, which just emit the raw contours regardless of disposition.

A 3D preview needs the opposite, standard vector-fill convention: the outermost contour of a physical layer *is* the solid finished piece (this is how `THREE.Shape` + `.holes` and every SVG/DXF viewer already interprets nested closed paths — even depth = filled/solid, odd depth = hole). Using cutability's `disposition` directly would render, e.g., a plain rectangular face plate as an empty hole in nothing.

**Decision:** reuse only the topology fields (`depth`, `parentRegionId`, `points`, `objectId`, `id`) from `CutabilityRegion` — never `.disposition`. `physical-preview-3d` applies its own polarity on top: even-depth regions are solid shapes; each solid shape's holes are its direct children (always odd-depth, by construction of `depth = parentDepth + 1`); a hole's own children (even depth again) are separate solid islands. This is genuinely a different interpretation of the same topology math for a different purpose, not a fork of cutability's business logic — the region-nesting algorithm itself is reused unchanged.

## Renderer decision

**Three.js + React Three Fiber. No CAD kernel.**

Every Phase 1/2 requirement — planar face extrusion to exact `thicknessMm`, holes via `Shape.holes`, front/back/edge/assembled/exploded views, materials, screenshots, orbit/pan/zoom — is native `THREE.Shape` + `THREE.ExtrudeGeometry` territory, already mature and deterministic for planar polygon input. Nothing in the approved M14 preview scope needs solid booleans, non-planar surfaces, bends, welds, bevels, or embossing — those are explicitly excluded by both `PROJECT_BRIEF.md` and Issue #34/#30. No candidate scenario from the decision rules below is triggered, so no CAD-kernel benchmark spend is justified.

### Candidate scorecard

Per the evaluation template's own decision rule, a full measured benchmark against RepliCAD/OCCT.js, CascadeStudio, and JSCAD is required only once a specific blocked M14 requirement is reproduced against a real LaserX fixture. None exists. The scorecard below is therefore a source-backed qualitative pass, not a measured prototype comparison — recorded honestly as such rather than fabricating benchmark numbers.

| Criterion | Three.js + R3F | RepliCAD + OCCT.js | CascadeStudio / cascade-core | JSCAD |
|---|---:|---:|---:|---:|
| License compatibility | 5 (MIT) | 3 (LGPL-2.1 OCCT core) | 3 (same OCCT core) | 5 (MIT/Apache) |
| Maintenance activity | 5 | 3 | 2 (community-maintained fork) | 3 |
| Browser/Electron compatibility | 5 | 3 (large WASM, worker-required) | 3 | 4 |
| React integration | 5 (R3F is purpose-built) | 2 (manual) | 2 (manual) | 2 (manual) |
| Bundle/WASM size | 5 (no WASM) | 2 (multi-MB WASM) | 2 | 4 |
| Cold startup | 5 | 2 | 2 | 4 |
| Worker support | 5 (well documented) | 3 (required for OCCT) | 3 | 4 |
| Exact planar extrusion | 5 (`ExtrudeGeometry`, exact input polygons) | 5 (kernel-exact, but unneeded) | 5 | 4 |
| Nested contours and holes | 5 (`Shape.holes`, matches our topology output directly) | 5 | 5 | 4 |
| Invalid-geometry failure behavior | 5 (we control it — findings, not silent repair) | 3 (kernel may throw opaque errors) | 3 | 3 |
| Deterministic repeated output | 5 | 4 | 4 | 4 |
| Material rendering | 5 | 2 (needs a separate renderer anyway) | 2 | 2 |
| Interaction and view controls | 5 (Drei helpers) | 1 (needs Three.js anyway) | 1 | 1 |
| Screenshot capture | 5 | 1 (needs Three.js anyway) | 1 | 1 |
| High-DPI support | 5 | n/a | n/a | n/a |
| GPU fallback strategy | 4 (standard WebGL context-loss handling) | n/a | n/a | n/a |
| Testability | 5 (pure-JS scene contract, no GPU needed for unit tests) | 3 | 3 | 3 |
| Installer impact | 5 (small, no WASM) | 2 | 2 | 3 |
| Integration complexity | 5 | 2 | 2 | 3 |
| Value inside approved M14 scope | 5 (covers 100% of required scope alone) | 1 (adds nothing M14 needs) | 1 | 1 |

CAD-kernel candidates score low specifically because they'd be adopted *in addition to* Three.js (something still has to render), not instead of it — they'd add license, bundle, and startup cost for zero required capability.

### Required benchmark fixtures — not exercised this slice

The template's seven benchmark fixtures (closed single face, multi-hole face, layered assembly, transformed/grouped design, open contour, self-intersecting contour, high-complexity sign) are reserved for Phase 3 stress testing once the pure adapter and renderer exist. Phase 0 does not require running them against CAD-kernel candidates because the decision rule (below) was never triggered.

### Decision rules applied

Per the evaluation template: *"Choose Three.js + React Three Fiber for the rendering layer unless another option demonstrates a specific approved M14 requirement that it cannot satisfy truthfully."* No such requirement was found. A CAD kernel requires all five conditions in the template's decision rules to hold simultaneously; condition 1 ("a current M14 preview requirement is blocked without it") is false, so the rest are moot.

## Final decision

- **Selected renderer:** Three.js.
- **Selected helper libraries:** React Three Fiber (`@react-three/fiber`); `@react-three/drei`, narrowly for `OrbitControls` only — the orbit/pan/zoom need materialized in this Phase 2 slice, matching the condition set out above. No other Drei export is imported.
- **CAD kernel:** rejected for the current scope. Re-open only if a specific approved M14 requirement (not present today) proves unreachable through planar extrusion.
- **Exact dependency versions and licenses:** installed in this Phase 2 slice 1, scoped to `apps/physical-3d-preview-lab/package.json` only (production desktop dependencies untouched) — see "Phase 2 slice 1 — dependencies and measured facts" below.
- **Architecture:** `Validated LaserxProject snapshot -> physical-layer selection (replicated production-export predicate) -> single-layer-scoped analyzeDocumentCutability -> region topology reinterpreted with extrusion polarity -> PhysicalPreviewScene (pure, serializable) -> [Phase 2] React Three Fiber adapter -> THREE.Shape/ExtrudeGeometry per layer`.
- **Known unsupported geometry (this slice):** any layer whose scoped `analyzeDocumentCutability` returns `status: "ambiguous"` (open contours, self-intersections, duplicate/overlapping segments, zero-area/degenerate contours) — the layer contributes findings and zero shapes rather than an invented or repaired solid.
- **Performance budget proposal:** deferred to Phase 3 measurement against representative fixtures; no number is asserted without a measurement behind it.
- **First implementation slice:** see below.
- **Conditions that would force reconsideration:** a concrete M14 requirement appears for true 3D boolean operations, non-planar surfaces, or bends/welds — none of which are in current M14 scope per Issue #30's exclusion list.

## First implementation slice (this session)

Single-physical-layer scene builder in `packages/physical-preview-3d`:

- `buildPhysicalPreviewScene(project: LaserxProject, options: { layerId: string })` — accepts an already-validated snapshot and one physical layer ID; throws for a missing or non-physical (`non-cut-preview`/untagged) layer, matching `production-export`'s existing fail-closed behavior.
- Builds a single-layer-scoped copy of the document (forcing that one layer `visible: true`, independent of its editor visibility toggle — a real bug class avoided: cutability's own visibility filter would otherwise silently omit a hidden-but-physical layer from the preview).
- Calls `analyzeDocumentCutability` on that scoped document; on `status: "ambiguous"` emits findings and no shapes; on `"complete"` builds one `PhysicalPreviewShape` per even-depth region with its direct children as holes, per the polarity decision above.
- Computes a dependency-free deterministic fingerprint (FNV-1a-style, same technique as `@laserx/domain`'s `deriveStableId`) rather than `node:crypto` — `physical-preview-3d` is consumed by a plain Vite/React browser app (`apps/physical-3d-preview-lab`), not Electron's Node-enabled main process, so a Node-only hash primitive would break browser bundling. This was caught before it became a Phase 2 integration bug.

Deferred to a later slice, unchanged from the approved plan: multi-layer assembled/exploded Z-stacking, the React Three Fiber adapter, and the `apps/physical-3d-preview-lab` UI.

## Phase 2 slice 1 — dependencies and measured facts

Completed 2026-08-02, same session, on the same branch. Scope: the smallest real browser-rendering vertical slice per the READY review — one fixture, one physical layer, front + perspective views, orbit/pan/zoom, reset, exact dimension readouts, WebGL-unavailable fallback.

### Exact pinned dependency versions and licenses

All added to `apps/physical-3d-preview-lab/package.json` only. `apps/desktop/package.json` was not touched; `pnpm-lock.yaml` gained new entries only for these packages and their own transitive dependencies.

| Package | Version | License | Role |
|---|---|---|---|
| `three` | `0.185.1` | MIT | Renderer, `Shape`/`ExtrudeGeometry`, scene graph |
| `@react-three/fiber` | `9.7.0` | MIT | React reconciler for Three.js (`Canvas`, hooks) |
| `@react-three/drei` | `10.7.7` | MIT | Narrowly for `OrbitControls` only |
| `@types/three` | `0.185.3` | MIT | Type declarations (`three` does not bundle its own) |
| `react` / `react-dom` | `19.2.8` | MIT | Matches `apps/desktop`'s pinned version exactly |
| `@vitejs/plugin-react`, `vite`, `vitest`, `typescript`, `@playwright/test`, `playwright`, `@types/node`, `@types/react`, `@types/react-dom` | same versions as `apps/desktop` | MIT/Apache-2.0 | Build/test tooling, kept version-aligned with the rest of the workspace |

Peer-dependency compatibility verified before pinning: `@react-three/fiber@9.7.0` requires `react`/`react-dom` `>=19 <19.3` and `three >=0.156`; `@react-three/drei@10.7.7` requires `react`/`react-dom` `^19`, `@react-three/fiber ^9.0.0`, and `three >=0.159`. `react@19.2.8` and `three@0.185.1` satisfy all of these.

### Measured bundle size (`pnpm --filter @laserx/physical-3d-preview-lab build`, Vite 8.2.0 production build)

```text
dist/index.html                     0.44 kB │ gzip:   0.30 kB
dist/assets/index-*.css             0.72 kB │ gzip:   0.42 kB
dist/assets/index-*.js          1,276.81 kB │ gzip: 350.13 kB
build time: 839ms
```

Vite's default 500 kB chunk-size warning fires; this slice does not code-split (a single fixture, single view). Code-splitting (e.g. lazy-loading Three.js/R3F behind a dynamic `import()`) is a reasonable Phase 3 optimization if bundle size becomes a concrete constraint — not applied here to avoid unmeasured complexity in a first slice.

### Measured startup timing

Measured with Playwright (headless Chromium, same version pinned above) against `vite preview` (the production build) on `http://127.0.0.1:4173`, this development machine, three consecutive navigations in one browser context:

| Run | `window.onload` | Canvas visible (mount → WebGL ready) |
|---|---|---|
| Cold (first navigation, empty cache) | 190 ms | 281 ms |
| Warm (reload, cached) | 30 ms | 88 ms |
| Warm (reload again) | 34 ms | 76 ms |

These are local-machine, single-sample measurements, not a CI-tracked performance budget — reported honestly as what was actually measured, not fabricated or extrapolated. A repeatable, representative-fixture performance budget remains Phase 3 work per the existing plan.

### Verified against the fixture

`fixtures/physical-preview/single-layer-face-plate.laserx` (200×120 mm stock, one `face` layer, mild steel, 3 mm, a 160×80 mm rectangle with one 30 mm-diameter through-hole) renders correctly in both front and perspective views: exact readout `160.0 mm × 80.0 mm × 3.0 mm`, the through-hole is visually faithful (confirmed by screenshot during manual verification, not committed), and the WebGL-unavailable fallback renders without throwing when `HTMLCanvasElement.prototype.getContext` is stubbed to return `null`.

## Phase 2 slice 2 — multi-layer assembly foundation and assembled/exploded preview

Completed 2026-08-02, same session, same branch. Closes the two non-blocking evidence gaps from the Phase 2 slice 1 review and builds the smallest coherent multi-layer vertical slice, per the READY review.

### Multi-layer assembly in `@laserx/physical-preview-3d`

- `buildPhysicalPreviewAssembly(project, options?)` is new and additive — `buildPhysicalPreviewScene` (single layer) is unchanged in behavior (all 10 prior tests pass unmodified) and now shares its per-layer contour/topology logic with the new function through a private `buildLayerProjection` helper, so cutability's region classification is still called from exactly one place.
- Physical-layer selection reuses the same `manufacturing !== undefined && role !== "non-cut-preview"` predicate (now named `isPhysicalManufacturingLayer` and exported), applied in `document.layers` order.
- **Spacing is ephemeral presentation data, never authoritative or persisted:** `PhysicalPreviewSpacingOptionsMm { assembledGapMm, explodedGapMm }` is an optional argument to `buildPhysicalPreviewAssembly`, defaults `{ assembledGapMm: 0, explodedGapMm: 20 }`, is never written to schema v9, and is kept in a distinct `spacing` field of the returned assembly rather than mixed into any layer's exact `thicknessMm`.
- **Z convention (this package's own deterministic definition — no existing LaserX contract mandates a direction):** the first physical layer in document order is placed front-most (the top of the stack's Z range); each subsequent layer stacks behind it toward `Z = 0`, the back face of the last physical layer. This keeps the degenerate single-physical-layer case numerically identical to `buildPhysicalPreviewScene`'s implicit `[0, thicknessMm]` extrusion range. `assembledGapMm` sits between adjacent layers in both modes; `explodedGapMm` adds further separation on top of it, only in exploded mode.
- **Status semantics, defined and documented (never invented/repaired geometry, and corrected 2026-08-02 — see "Repair" below):** `"complete"` requires every declared physical layer to have produced at least one renderable shape and have no topology failure. There is no concept of a "legitimately empty" physical layer: a declared physical layer with zero shapes always carries a finding — either a cutability topology finding, or the package-owned `EMPTY_PHYSICAL_LAYER` finding when cutability itself reports nothing wrong (no objects, or objects that resolve to no closed candidate contour) — which by construction rules out `"complete"`. `"partial"` — at least one physical layer exists but at least one produced no shapes, whether ambiguous or empty (still positioned, still name/material/thickness-readable and still counted in `assembledDepthMm`, just not rendered — the other layers are unaffected). `"unavailable"` — the document declares zero physical manufacturing layers, so there is nothing to assemble at all.
- `assembledDepthMm` is the real physical stack depth: sum of every physical layer's exact `thicknessMm` plus `assembledGapMm` between them — distinct from any exploded-mode presentation spread.

### Two evidence gaps closed

1. **Hole-opening proof** (`apps/physical-3d-preview-lab/tests/sceneToThree.test.ts`): a new test casts a `THREE.Raycaster` ray straight through the extrusion's Z axis at the hole's center and asserts zero intersections (genuinely open through both caps), then casts through a point in retained material and asserts exactly two intersections at `z=0` and `z=thicknessMm` (front cap + back cap), and a third cast entirely outside the outer contour asserts zero. Building this test surfaced and fixed a real bug in the test helper itself: `Raycaster.intersectObject` on a default `MeshBasicMaterial` (implicit `FrontSide`) culls back-facing triangles, so the back cap was invisible to the ray until the test mesh was given an explicit `DoubleSide` material — evidence the proof is exercising real triangle geometry, not a tautology.
2. **Deterministic camera poses**: `src/cameraPose.ts` is a new pure module (no React, no Three.js scene graph, no DOM) exporting `computeCameraPose(view, target, distance)` for `front | back | edge | perspective`, unit-tested with exact position/up assertions for all four views plus a front/back mirror-symmetry check. `CameraRig.tsx` now calls this function instead of inlining the pose math.

### Browser lab: assembled/exploded, back/edge, material appearance, disposal

- Switched the app's loaded fixture to the new two-layer `fixtures/physical-preview/two-layer-face-backing.laserx` (`face`: mild steel 3 mm with a circular through-hole; `backing`: acrylic 6 mm, larger, with a rectangular slot cutout; plus a third `non-cut-preview` layer that must be and is excluded).
- Added an Assembled/Exploded mode toggle (`data-testid="mode-assembled"`/`"mode-exploded"`, `aria-pressed`) that only changes each layer's Z position (`assembledZRangeMm` vs `explodedZRangeMm`); the underlying 2D contour/hole geometry is built once per layer and never rebuilt on mode switch.
- Added Back and Edge view buttons alongside the existing Front/Perspective/Reset, all driven by `computeCameraPose`.
- Added a per-layer readout list (name, material, thickness) and the exact total assembled depth in the toolbar.
- `src/materialAppearance.ts` maps each of domain's six `ManufacturingMaterial` values to a distinct presentation-only color/metalness/roughness/opacity (acrylic is semi-transparent) — confirmed visually distinct by screenshot during manual review (mild steel dark/matte, acrylic lighter and translucent enough to see the face layer's hole through the backing in back view), not committed as an artifact.
- Geometries are built with `new THREE.ExtrudeGeometry(...)` outside React (unchanged architectural boundary) and attached to meshes via the `geometry` prop, so React Three Fiber does not auto-manage their disposal the way it does for JSX-declared geometries. Added an explicit `useEffect` cleanup that calls `.dispose()` on every generated geometry whenever the memoized geometry set changes or the component unmounts, preventing GPU resource accumulation across future fixture/mode changes.

### Measured bundle size delta (`pnpm --filter @laserx/physical-3d-preview-lab build`)

```text
dist/assets/index-*.js   1,282.43 kB │ gzip: 351.36 kB   (was 1,276.81 kB / 350.13 kB)
build time: 671ms
```

+5.62 kB raw / +1.23 kB gzip for the entire slice 2 feature set (assembly logic, camera-pose module, material-appearance module, mode toggle UI) — no new runtime dependency was added, so the delta is application code only.

### Measured startup timing delta

Same methodology as slice 1 (Playwright, headless Chromium, `vite preview`, three consecutive navigations):

| Run | `window.onload` | Canvas visible |
|---|---|---|
| Cold | 180 ms (was 190 ms) | 282 ms (was 281 ms) |
| Warm | 29 ms (was 30 ms) | 84 ms (was 88 ms) |
| Warm again | 29 ms (was 34 ms) | 71 ms (was 76 ms) |

No measurable regression — within normal local-machine run-to-run noise. Still local-machine, single-sample measurements, not a CI-tracked performance budget.

## Repair — empty physical layer falsely reported as a complete assembly (2026-08-02)

**Defect:** an explicit physical manufacturing layer with zero objects (or objects that resolve to no closed candidate contour) produces `analyzeDocumentCutability` `status: "complete"`, zero regions, and zero topology findings — cutability has nothing to say about an empty input. `buildLayerProjection` therefore returned zero shapes and zero findings for that layer, and `buildPhysicalPreviewAssembly`'s status check (`projection.findings.length > 0`) never saw it, so the whole assembly was reported `"complete"` while silently contributing an invisible layer's `thicknessMm` to `assembledDepthMm` and Z placement, with no warning anywhere. There is no supported concept of a "legitimately empty" physical layer in any authoritative LaserX contract, so this violated the experiment's fail-visible/non-inventing boundary.

**Fix:** `buildLayerProjection` now checks, after computing shapes and topology findings, whether a layer produced zero shapes *and* has zero existing findings — meaning cutability reported nothing wrong but there is still nothing to render. In that case it appends a package-owned `EMPTY_PHYSICAL_LAYER` finding (`{ code: "EMPTY_PHYSICAL_LAYER", layerId, objectIds: [], message }`), reusing the exact same `PhysicalPreviewFinding` shape as cutability-sourced findings. Because `buildPhysicalPreviewAssembly`'s status computation already treats "any layer with findings" as non-`"complete"`, no separate status-logic change was needed beyond this one addition — `hasLayerWithFindings` (renamed from `hasAmbiguousLayer` for accuracy) now correctly catches both ambiguous and empty layers. `buildPhysicalPreviewScene` inherits the fix for free through the same shared `buildLayerProjection` helper — a single empty physical layer can no longer return a finding-free, apparently valid single-layer scene either. The layer's declared name/material/thickness remain fully inspectable in both APIs; no contour is invented and the layer is never silently omitted.

**Regression coverage added:** `packages/physical-preview-3d/tests/assembly.test.ts` (one valid + one empty physical layer → `"partial"` with the finding; all physical layers empty → `"partial"`, never `"complete"`/`"unavailable"`; determinism; source immutability) and `tests/scene.test.ts` (single empty physical-layer scene → zero shapes plus the finding, determinism, immutability). A new fixture, `fixtures/physical-preview/partial-assembly-empty-layer.laserx`, and a corresponding Playwright test (loaded via the `?fixture=partial-assembly` test-only query hook in `loadFixtureProject.ts`) prove the browser warning banner is visible and the empty layer's identity/material/thickness still appear in the readout list.
