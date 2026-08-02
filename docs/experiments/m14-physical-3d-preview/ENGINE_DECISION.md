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
- **Selected helper libraries:** React Three Fiber (`@react-three/fiber`); Drei only if a specific Phase 2 interaction/view-preset need arises (not installed in this slice — no dependency added without a concrete use).
- **CAD kernel:** rejected for the current scope. Re-open only if a specific approved M14 requirement (not present today) proves unreachable through planar extrusion.
- **Exact dependency versions and licenses:** not yet installed — no 3D dependency is added in this Phase 1 slice (see below); Three.js/R3F installation is deferred to the Phase 2 browser-lab slice, at which point exact pinned versions and licenses will be recorded here.
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
