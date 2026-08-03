# Material-Aware 3D Presentation — First Slice

Research record for GitHub Issue #42, on `experiment/material-aware-3d-presentation`.

> **Isolated research only.** This does not activate M14, authorize production integration, or permit merge to `main`. M13 remains the active gate.

## Provenance

| | |
|---|---|
| Branch base (accepted 3D head) | `9a4a90c6fa891ed0d9baf9bc8c99d41b04d54136` |
| Material catalog merged at exact head | `17c78a259e99e711b0e035dc5b6824ae0e2073b8` |
| Merge result | No conflicts |

The catalog branch adds only `packages/material-catalog/**` on top of `main`; everything else it carried was inherited `main` advances (including the Issue #36 PR-template fix). Verified after merging that the 3D contract, the catalog contract, and `main` are each byte-identical to their sources — no contract was weakened to make the merge succeed.

`packages/material-catalog/**` was treated as **read-only input** and is unmodified.

## Architecture

```text
LaserxProject (schema v9)                     ← unchanged, never mutated
        ▼
@laserx/physical-preview-3d                   ← pure scene contract
  + ephemeral catalogMaterialIds option
  + per-layer catalogMaterialId passthrough
  NO catalog dependency · NO Three · NO React
        ▼  PhysicalPreviewAssembly
src/materialAdapter.ts                        ← the ONLY catalog-aware module
  catalog appearance → bounded Three params
  unknown ID → neutral fallback + finding
        ▼  ResolvedLayerMaterial[]
src/LayerMaterial.tsx + App.tsx               ← React consumes descriptors only
```

### Why the pure package stays catalog-agnostic

`@laserx/physical-preview-3d` carries the catalog identifier through **verbatim and uninterpreted**. It gains no dependency on the catalog, does not validate the ID, and does not report unknown-material findings — those belong to the adapter.

This keeps the scene contract simultaneously renderer-independent *and* catalog-independent, so a different catalog (or none) can be swapped in without touching it. The identifier has exactly the same ephemeral status as `PhysicalPreviewSpacingOptionsMm`: presentation-only, never persisted, never schema data.

### Why React holds no material identity

`LayerMaterial.tsx` branches only on the descriptor's own `materialClass`. It contains no catalog IDs, no material names, and no per-material conditionals. Adding an eleventh catalog entry requires no React change.

## Appearance mapping

| Catalog kind | Three material | Distinguished by |
|---|---|---|
| `wood` | `MeshStandardMaterial` | Opaque, high roughness, per-material base colour |
| `opaque` | `MeshStandardMaterial` | Opaque, lower roughness than wood |
| `mirrored` | `MeshStandardMaterial` | High metalness + very low roughness + environment |
| `transparent` | `MeshPhysicalMaterial` | Highest transmission, lowest roughness |
| `translucent` | `MeshPhysicalMaterial` | Mid transmission, mid roughness |
| `frosted` | `MeshPhysicalMaterial` | Mid transmission, **high** roughness (scatter) |

Roughness is what visually separates clear → translucent → frosted, and this ordering is asserted by test rather than left to inspection.

### Bounded transparency and reflection

The catalog already constrains its values to 0..1, but the adapter does not depend on that staying true, and some physically-valid values are still poor *presentation* values. Hard caps, asserted by tests:

| Bound | Value | Reason |
|---|---|---|
| `maxTransmission` | 0.85 | Full transmission renders a sheet effectively invisible |
| `maxMetalness` | 0.95 | Avoids a fully mirrored surface with no diffuse response |
| `minRoughness` | 0.03 | A perfectly sharp mirror reads as a rendering artefact |
| `minOpacity` | 0.12 | Keeps every sheet visible |
| `ior` | 1.0–1.6 | Bounded refraction |

Out-of-range and non-finite inputs are clamped, not trusted — covered by a test that feeds deliberately hostile values.

### Environment map — required, and local

Mirrored acrylic needs an environment or a high-metalness surface renders **near-black**; transmissive acrylic needs something to refract or clear/translucent/frosted look nearly identical. `PreviewEnvironment.tsx` bakes Three's own `RoomEnvironment` through `PMREMGenerator` **in-process**.

`RoomEnvironment` is procedural geometry and lights — **no texture is downloaded and no network request is made**, satisfying the "no remote texture downloads" constraint.

#### Lifecycle (repaired after review)

`PMREMGenerator.fromScene()` returns a **`WebGLRenderTarget`, not a texture**. The target owns a framebuffer and a renderbuffer in addition to `target.texture`, so the whole target is retained and disposed with `target.dispose()`; disposing only the texture leaks the rest. On unmount the environment slot is cleared **only if it still holds our texture**, so a component that legitimately replaced it is not clobbered.

`PreviewEnvironment` is mounted only while a *visible* material actually needs it (`needsEnvironment` on the resolved descriptor). When nothing does, no render target is held open and the pre-catalog rendering path is preserved exactly.

This defect was invisible on a fresh page load and only appeared across mount/unmount inside one long-lived renderer, so the evidence is a same-renderer E2E test that never navigates. It counts **live WebGL framebuffers and renderbuffers** by wrapping the context's create/delete methods — deliberately *not* `renderer.info.memory.textures`, which decrements on texture-only disposal and therefore cannot distinguish the bug:

| Cycle | Before repair | After repair |
|---|---|---|
| baseline (mounted) | 6 fb / 4 rb | 6 fb / 4 rb |
| 1 | 7 fb / 5 rb | 6 fb / 4 rb |
| 2 | 8 fb / 6 rb | 6 fb / 4 rb |
| 3 | 9 fb / 7 rb | 6 fb / 4 rb |
| 4 | 10 fb / 8 rb | 6 fb / 4 rb |
| 5 | 11 fb / 9 rb | 6 fb / 4 rb |

One framebuffer and one renderbuffer leaked per cycle, climbing monotonically and never released. After the repair every cycle returns **exactly** to baseline, and the test fails against the old implementation on the first cycle.

## Fallback behaviour

Three distinct cases, deliberately kept separate:

| Case | Appearance | `(fallback)` marker | Finding |
|---|---|---|---|
| Known catalog ID | Catalog appearance | no | none |
| **Unknown** catalog ID | Neutral grey, fully opaque, clearly visible | **yes** | `UNKNOWN_CATALOG_MATERIAL` |
| No catalog ID claimed | Pre-existing domain-material appearance | no | none |

The third case matters: an early draft degraded *every* non-catalog layer to neutral grey, which silently regressed the ten pre-existing fixtures. Nothing failed in that case, so it must not look like a failure — and keeping neutral grey reserved for genuine failures keeps it a meaningful signal.

**Repaired after review:** the *appearance* was correct but the *label* still leaked the old assumption — the marker was driven by `status !== "catalog"`, so a layer that never claimed a catalog material was labelled `(fallback)` despite the adapter deliberately raising no finding. Only `fallback-unknown-id` is a genuine resolution failure, and only it is marked. A regression test pins this against the pre-existing, pre-catalog `two-layer` fixture: both layers keep their own domain material labels (`mild-steel`, `acrylic`), no `(fallback)` marker appears anywhere in the layer list, and no material-findings banner is shown.

## Fixtures

| Fixture | Purpose |
|---|---|
| `material-swatch-wood.laserx` | One wood layer; catalog material varied via `?material=` so every entry is judged on an identical shape |
| `material-swatch-acrylic.laserx` | Same, for acrylic entries |
| `material-mixed-assembly.laserx` | Four layers: mirrored face (3 mm), clear spacer (6 mm), translucent diffuser (4 mm), MDF backing (12 mm) — 25 mm total |

All generated from the `@laserx/domain` API and round-tripped through the strict schema-v9 parser before being written.

## Evidence

Screenshots and `manifest.json` (with per-file SHA-256) are in [`screenshots/`](./screenshots/): wood ×2, clear, translucent, frosted, mirrored, mixed assembled/exploded/edge, and the unknown-material fallback.

Preserved and re-proven with materials applied: exact per-layer thickness, layer order, assembled/exploded behaviour, per-layer visibility, all four view presets, keyboard operability, PNG capture, real `WEBGL_lose_context` recovery, and GPU-resource stability across repeated material switches.

## Known limitations

- **Clear acrylic is background-dependent.** Over the dark studio background an isolated clear swatch correctly reads *dark* rather than obviously "clear". True see-through behaviour is visible in the mixed assembly, where the translucent diffuser shows through the face aperture. No backdrop or wall was added — that is out of scope.
- **Cast and extruded clear acrylic look nearly identical**, because the catalog intends them to; they differ in process compatibility, not appearance.
- **No photorealism is claimed.** These are bounded presentation approximations, not optical simulations, and no rendered result is manufacturing evidence.
- **`transmission` costs a render pass.** Acceptable at the measured fixture sizes; not profiled against a text-heavy or very large multi-layer stack.
- **Opaque acrylic uses the catalog's neutral default colour.** Real stock colour is a future stock attribute, as the catalog's own notes state.
- **Headless Chromium only**, single machine. No real-GPU or Windows/Electron validation.

## Explicitly not done

No glass or stone contracts were invented. No engraving or marking artwork was converted into solids. No schema, migration, production export, `.github`, M13/M14 status, CAD, CAM, toolpath, machine-setting, or machine-control file was touched, and `packages/material-catalog/**` was not modified.
