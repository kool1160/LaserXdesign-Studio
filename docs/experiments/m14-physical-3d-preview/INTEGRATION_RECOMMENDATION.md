# Integration Recommendation — Physical 3D Sign Preview

Final research deliverable for GitHub Issue #34, written on `experiment/m14-physical-3d-preview-lab` at head `bcb4f94b25740ee3da385137e80a53b1a3174fc1`, under the "Phase 3 COMPLETE; READY for final integration recommendation" authorization.

> **This document does not activate M14, authorize any merge, change milestone status, or approve any code into `main`.** It is a research recommendation for independent owner review. M13 remains the active gate; M14 remains blocked; the experiment branch remains non-merge-ready. Nothing here may be treated as approval to begin production implementation.

Companion evidence: [`ENGINE_DECISION.md`](./ENGINE_DECISION.md) (Phase 0–2), [`PHASE3_EVIDENCE.md`](./PHASE3_EVIDENCE.md) and [`phase3-results.json`](./phase3-results.json) (Phase 3), [`screenshots/`](./screenshots/).

---

## 1. Decision

**ADOPT** — with a component-level split and mandatory pre-integration gates.

The architecture proved out. The approach is sound, the correctness properties that matter for manufacturing (determinism, source immutability, fail-visible invalid geometry, exact `thicknessMm`) are demonstrated rather than asserted, and no CAD kernel is warranted. But "adopt" applies to *the approach and the pure package*, not to the lab application, which was built as a research harness and must not be promoted.

The recommendation is therefore adopt-by-component:

| Component | Decision | Rationale |
|---|---|---|
| `@laserx/physical-preview-3d` (pure scene contract) | **Adopt — promote largely intact** | Already production-shaped: no React/Three/DOM/filesystem. Correctness proven across 10 fixtures. |
| Three.js renderer adapter (geometry, camera, materials, capture validation) | **Adopt — promote, relocated into a new package** | Logic is correct and Node-testable; it is currently misfiled inside an app. |
| React preview UI | **Adopt the interaction model — rewrite the implementation** | Behaviors validated; the lab's fixture-loading shell is not what the desktop needs. |
| PNG download path | **Reject as built — rewrite** | Browser anchor download violates the Electron privileged-write boundary. |
| Lab app shell, bench hook, fixture registry/loader | **Reject for production — experiment-only** | Research scaffolding and a deliberate debug surface. Must never ship. |
| Benchmark harness | **Retain as experiment tooling** | Valuable as a regression harness; not product code. |
| Research fixtures | **Experiment-only for bundling; promote a subset as disk-loaded test fixtures** | Must not be inlined into a production bundle. |

No part of this is "revise and re-test" in the Phase 4 sense — the experiment does not need another research cycle to answer the architecture question. The open items in §9 are M14 implementation gates, not unresolved research.

---

## 2. What the evidence actually established

Grounding for the decision above. Every claim here is measured; see the cited evidence documents.

**Proven (correctness):**

- **Determinism.** All 10 reviewed fixtures: exactly 1 distinct scene fingerprint and 1 distinct geometry output across 12 independent re-parse-and-rebuild repeats (`PHASE3_EVIDENCE.md` §4).
- **Source immutability.** 12/12 repeats per fixture, verified on the exact object passed through both scene and geometry conversion, with four negative tests proving the checker detects real mutations. This claim was vacuous in the first Phase 3 submission and was repaired before being relied on — that history is recorded rather than hidden.
- **Fail-visible invalid geometry.** Open and self-intersecting contours produce zero shapes, `partial` status, `declared-incomplete` depth, and source-linked findings. No invented or repaired solids.
- **Exact canonical thickness.** Gauge `1.51892 mm`, fractional-inch `3.175 mm`, millimeter `6 mm` carried exactly; mixed-stock declared depth sums to exactly `14.24738 mm`.
- **Bounded GPU resources.** Over 60 stress cycles: geometries 10, textures 1, programs 1 — net delta 0/0/0, sampled every 10 cycles so the curve distinguishes bounded from linear.
- **Real WebGL context loss.** `WEBGL_lose_context` loss and restore both handled, readouts preserved, 0 uncaught page errors across the entire browser run.
- **Capture integrity.** PNG signature + IHDR 1280×694 + SHA-256 + 806 distinct colors + 5.063% non-background pixels, with identical digests on repeat capture.

**Proven (performance, this machine only):**

- Scene conversion median 13.9369 ms worst case (58-object sign); geometry conversion median 0.9831 ms.
- Canvas readiness 166–339 ms median across fixtures, including full page load.
- Assembled↔exploded toggle 20.05–22.20 ms median (≈ one 60 Hz frame).
- PNG capture 174.5 ms median through the real in-app path.

**The most consequential measured finding.** Cost is dominated by *reused cutability analysis*, not by rendering. For `gauge-stock`: scene conversion **8.3256 ms** versus Three geometry conversion **0.2741 ms** — a ~30× gap. And for equal object counts, curve flattening dominates: `fractional-inch-stock` (2 rectangles, 8 contour points) converts in **0.1010 ms** while `gauge-stock` (1 rectangle + 2 circles, 158 contour points) takes **8.3256 ms**, ~82×.

This matters architecturally: the preview currently pays for a full `analyzeDocumentCutability` run — spacing, kerf-collapse, bridge-width, contour-proximity checks — and then discards everything except region topology. That is the single clearest optimization target and it drives a concrete recommendation in §4.3.

---

## 3. Recommended production architecture

### 3.1 Layering

```text
LaserxProject (schema v9, validated by @laserx/project-format)
        │  read-only snapshot; never mutated
        ▼
@laserx/physical-preview-3d          ← pure, renderer-independent
  • physical-layer selection (replicated production-export predicate)
  • region topology via @laserx/cutability (reused, not duplicated)
  • extrusion-polarity reinterpretation (solid vs hole)
  • exact thicknessMm, Z stackup, findings, deterministic fingerprint
  no React · no Three · no DOM · no filesystem · no GPU
        │  PhysicalPreviewAssembly (serializable)
        ▼
@laserx/physical-preview-three       ← NEW package, renderer adapter
  • Shape/Shape.holes + ExtrudeGeometry conversion
  • deterministic camera poses
  • material appearance mapping
  • capture validation (pure; no DOM writes)
  depends on: three, @laserx/physical-preview-3d
  no React · no Electron · no filesystem
        │  THREE.BufferGeometry + pose/material descriptors
        ▼
apps/desktop/src/features/physical-preview/   ← React + R3F orchestration
  • Canvas, controls, readouts, findings surface, fallbacks
  • lazy-loaded chunk (§7)
        │  save request
        ▼
Electron main boundary (typed preload IPC)    ← privileged PNG write
```

### 3.2 Boundary rules this preserves

Directly aligned to `AGENTS.md` §7 and `docs/WORKSTREAM_OWNERSHIP.md`:

- React components contain **no** geometry algorithms — all conversion lives in packages and is unit-testable in Node without a GPU, exactly as it is today.
- `packages/domain` and `packages/geometry` remain untouched; the preview is a *consumer*, never a second authority.
- No project-schema change. The preview is derived, never persisted. Ephemeral spacing options stay ephemeral.
- Filesystem writes stay in the Electron main boundary behind a narrow typed service — which is precisely why the lab's anchor-download capture cannot be promoted.
- The preview never becomes manufacturing evidence: SVG/DXF, production packages, and cutability analysis remain authoritative.

### 3.3 Why a separate `@laserx/physical-preview-three` package

Not cosmetic. The Three conversion is already proven to run and be fully tested in Node with no WebGL context (`sceneToThree.test.ts`, including a raycast-based proof that holes are genuinely open through both caps). Anything Node-testable belongs in a package, not an app — putting it in `apps/desktop` would make that test suite depend on the desktop app's build. Keeping it separate also means a future non-Electron consumer (or a future headless render service, explicitly out of scope now) needs no rework.

---

## 4. Engine questions

### 4.1 Is Three.js + React Three Fiber sufficient?

**Yes — sufficient and recommended.** Every approved M14 preview requirement was delivered on it without a single unmet capability:

| M14 requirement | Delivered on Three.js/R3F | Evidence |
|---|---|---|
| Exact `thicknessMm` extrusion | Yes | Exact thickness across gauge/fractional/mm fixtures |
| Visible through-holes and cutouts | Yes | `Shape.holes`; raycast proof of genuine openings |
| Ordered multi-layer assemblies | Yes | Document-order stack, per-layer material/thickness |
| Assembled and exploded views | Yes | Z-repositioning only; no geometry rebuild |
| Orbit/pan/zoom/reset, front/back/edge/perspective | Yes | Pure `computeCameraPose`, unit-tested |
| Material-aware appearance | Yes | All six domain materials covered |
| Deterministic regeneration | Yes | 1 fingerprint / 1 geometry across 12 repeats × 10 fixtures |
| Fail-visible invalid geometry | Yes | Findings, zero shapes, `partial` status |
| GPU fallback and context loss | Yes | Unavailable state + real `WEBGL_lose_context` recovery |
| Customer-preview PNG | Yes | Validated by signature, dimensions, digest, pixel content |
| Bounded high-DPI | Yes | `dpr=[1,2]`, verified clamping at a simulated 3× device |

### 4.2 Is any CAD kernel justified?

**No — reject for M14 scope.** The Phase 0 decision rule required *all five* conditions to hold before adopting a kernel; condition one ("a current M14 preview requirement is blocked without it") is false, so the rest are moot. RepliCAD/OpenCascade.js, CascadeStudio, and JSCAD would each be adopted *in addition to* Three.js — something still has to render — buying multi-megabyte WASM, worker requirements, LGPL considerations, and cold-start cost for zero required capability.

**Conditions that would reopen this**, none of which are in current M14 scope: true 3D boolean operations between solids; non-planar surfaces; bends, welds, bevels, or embossing; or STEP/STL/IGES solid interchange. If any of those is ever approved, this decision must be re-taken — not extended by assumption.

### 4.3 One recommended change to how the preview uses `@laserx/cutability`

The preview needs region topology (`parentRegionId`, `depth`, `points`). It currently obtains that by running the full `analyzeDocumentCutability`, which additionally computes minimum feature width, kerf-collapse risk, bridge width, contour spacing, and gap analysis — all discarded. §2 quantifies the cost: ~30× the actual geometry work.

**Recommendation:** during M14, evaluate exposing a narrower topology-only entry point from `@laserx/cutability` (working name `classifyDocumentRegions`) that returns regions and ambiguity status without the manufacturing-limit passes, and have `@laserx/physical-preview-3d` consume that instead.

Important constraints on this:
- It **must not** fork or duplicate the region-classification algorithm. Reuse remains mandatory; this is an export-surface change, not a second implementation.
- It changes a package's public API and therefore requires an **ADR** before implementation.
- It is an **optimization gate, not a blocker** — current performance is already acceptable at representative scale. If the ADR is declined, ship as-is.
- The preview must keep surfacing genuine topology findings (`OPEN_CONTOUR`, `SELF_INTERSECTION`, etc.); this change must not weaken fail-visible behavior.

---

## 5. File-by-file promotion map

`P` = promote, `R` = rewrite, `X` = experiment-only (never ships).

### 5.1 `packages/physical-preview-3d` → promote in place

| Current | Action | Proposed production path | Notes |
|---|---|---|---|
| `src/index.ts` | **P** | `packages/physical-preview-3d/src/index.ts` | Split into `scene.ts` / `assembly.ts` / `findings.ts` / `types.ts` as it grows; behavior unchanged. Revise only for §4.3 if that ADR is accepted. |
| `tests/scene.test.ts` | **P** | same | Single-layer, transform, hole-topology, immutability coverage. |
| `tests/assembly.test.ts` | **P** | same | Multi-layer order, Z placement, depth status, empty/ambiguous layers. |
| `package.json`, `tsconfig.json`, `README.md` | **P** | same | Already conforms to workspace conventions. |

### 5.2 `apps/physical-3d-preview-lab/src` → split

| Current | Action | Proposed production path | Notes |
|---|---|---|---|
| `sceneToThree.ts` | **P** | `packages/physical-preview-three/src/geometry.ts` | Move unchanged; already pure and Node-tested. |
| `cameraPose.ts` | **P** | `packages/physical-preview-three/src/cameraPose.ts` | Pure, unit-tested, no dependencies. |
| `materialAppearance.ts` | **P** | `packages/physical-preview-three/src/materialAppearance.ts` | Presentation-only; exhaustive over `ManufacturingMaterial`. |
| `captureFilename.ts` | **P** | `packages/physical-preview-three/src/captureFilename.ts` | Deterministic naming; keep as-is. |
| `capturePng.ts` → `capturePreviewPng` | **P** | `packages/physical-preview-three/src/capture.ts` | Validation half is pure and testable against a mock canvas. |
| `capturePng.ts` → `downloadCapturedPng` | **R** | Electron main-process save via typed preload IPC | **Must not ship as written.** Anchor + object-URL download bypasses the privileged-write boundary and gives no overwrite/rollback policy. |
| `webgl.ts` | **P** | `packages/physical-preview-three/src/webglAvailability.ts` | Trivial; keep with the renderer package. |
| `CameraRig.tsx` | **R** | `apps/desktop/src/features/physical-preview/CameraRig.tsx` | Rewrite to drop `@react-three/drei` (§7.1); pose math already extracted and reusable. |
| `App.tsx` | **R** | `apps/desktop/src/features/physical-preview/PhysicalPreviewPanel.tsx` | Interaction model adopted; implementation rewritten to consume the **open document**, not a fixture loader, and to integrate with existing desktop state/undo boundaries. |
| `benchHook.ts` | **X** | — | Deliberate global debug surface (`window.__laserxPreviewLab` exposing the live `WebGLRenderer`). **Must never ship.** |
| `fixtureRegistry.ts`, `loadFixtureProject.ts` | **X** | — | Research fixture selection and the `?fixture=` query hook. Must never ship (§7.2). |
| `main.tsx`, `index.html`, `styles.css` | **X** | — | Standalone lab shell; desktop has its own entry and design system. |

### 5.3 Tests

| Current | Action | Notes |
|---|---|---|
| `tests/sceneToThree.test.ts` | **P** | Move with the module. Includes the raycast hole-opening proof — keep it; it caught a real single-sided-material bug. |
| `tests/cameraPose.test.ts`, `materialAppearance.test.ts`, `captureFilename.test.ts`, `capturePng.test.ts` | **P** | Move with their modules. |
| `tests/projectImmutability.test.ts` | **P (pattern)** | Promote the *mechanism* into `@laserx/physical-preview-3d`'s own suite so production conversion is continuously proven non-mutating, with the negative tests intact. |
| `tests/phase3Fixtures.test.ts` | **R** | Adapt to whichever fixtures are promoted (§5.5). |
| `tests/e2e/lab.spec.ts` | **R** | Rewrite as desktop Playwright coverage against the packaged app. |
| `tests/benchStats.test.ts`, `tests/pngInspect.test.ts` | **X** | Test benchmark helpers; stay with the harness. |

### 5.4 Benchmark harness

| Current | Action | Notes |
|---|---|---|
| `bench/**` (all 9 files) | **X — retain as experiment tooling** | Genuinely useful as a performance-regression harness. If M14 wants tracked budgets, promote a trimmed version under `tools/` in a **separate** reviewed change; do not smuggle it in with the feature. |

### 5.5 Fixtures

| Current | Action | Notes |
|---|---|---|
| `fixtures/physical-preview/*.laserx` (10) | **X for bundling** | Must not be inlined into the production bundle (§7.2). |
| Subset: `gauge-stock`, `fractional-inch-stock`, `multi-layer-mixed-stock`, `invalid-open-contour`, `invalid-self-intersecting`, `high-complexity` | **P as disk-loaded test fixtures** | Directly satisfy Issue #30's gauge/fractional/millimeter and fail-visible acceptance items. Load from disk in tests only, following existing `fixtures/projects` conventions. |
| `docs/experiments/**` (all evidence) | **X — retain as research record** | Historical evidence; never product documentation. |

---

## 6. Considerations

### 6.1 Licensing

| Package | Version | License | Disposition |
|---|---|---|---|
| `three` | 0.185.1 | MIT | Adopt |
| `@react-three/fiber` | 9.7.0 | MIT | Adopt |
| `@react-three/drei` | 10.7.7 | MIT | **Recommend dropping** (§7.1) |
| `@types/three` | 0.185.3 | MIT | Adopt (dev) |

All MIT and compatible with the existing dependency posture. No copyleft, no WASM blobs, no bundled fonts/icons/trademarks, no attribution obligations beyond MIT notice retention. `pnpm audit --prod` and the existing license audits must gate the actual dependency addition — this is a review of license *type*, not a substitute for running those audits at integration time.

### 6.2 Security

- **The bench hook must not ship.** `window.__laserxPreviewLab` intentionally exposes the live `WebGLRenderer` for measurement. In a renderer process it is an unnecessary surface. Enforce its absence with a build-time check, not just a code review.
- **The `?fixture=` query hook must not ship.** Arbitrary fixture selection from a URL parameter has no place in the product.
- **No new trust boundary.** The preview consumes an already-validated, already-parsed project snapshot. It performs no I/O, no network access, no script evaluation, and adds no new parser. Imported/AI-generated geometry is validated upstream exactly as today.
- **Electron posture unchanged.** Three.js and R3F are browser libraries requiring no Node access; context isolation and the narrow preload API stay as-is. The **only** new IPC surface is the PNG save request, which must be typed, sender-checked, path-validated, and subject to existing overwrite/rollback policy.
- **`preserveDrawingBuffer: true`** is required for reliable capture readback and is a deliberate, documented cost (retained buffer each frame). If profiling on real hardware shows it material, the alternative is a render-on-demand capture path — noted, not required.
- **No secrets, telemetry, or user content leave the process.** Capture writes only where the user chooses.

### 6.3 Bundle

Measured lab bundle: **1,344.38 kB raw / 356.93 kB gzip**, of which **+54.97 kB raw** is inlined research fixtures that must not ship. The remaining ~1.29 MB raw / ~353 kB gzip is Three.js + R3F + app code.

That is too much to add unconditionally to an editor whose M13 startup budgets are already gated. §7 makes code-splitting a hard requirement, not an optimization.

### 6.4 GPU / WebGL

Two distinct states are already implemented and evidenced, and both must survive promotion:

1. **WebGL unavailable at startup** — a clear explanatory state; the project is untouched; editing and saving are unaffected.
2. **Context lost at runtime** — real `WEBGL_lose_context` handled with `preventDefault()`, a readout-preserving overlay, and automatic recovery on restore. 0 uncaught page errors.

**Unvalidated:** real GPU hardware, real driver context loss, Windows/Electron GPU process crashes, software-rendering fallback (SwiftShader), and multi-GPU/hybrid-graphics switching. All headless-only so far. This is gate G3 in §9.

### 6.5 Determinism and mutation safety

Both are proven and both must become *continuous* guarantees, not one-off measurements:

- Promote the fingerprint-equality and geometry-digest-equality assertions into the production package's test suite.
- Promote the immutability-check mechanism **with its negative tests**. The negative tests are the load-bearing part — the original check passed while proving nothing, and only a test that can fail demonstrates otherwise.
- Preview interaction (mode, view, visibility, capture) must remain provably non-mutating for geometry, dirty state, undo/redo, selection, analysis, SVG/DXF, and production packages. Visibility toggles are presentation-only today and must stay that way.

### 6.6 Accessibility

**Evidenced:** all controls are native `<button>`/`<input type="checkbox">`, keyboard-operable via Tab/Enter/Space with focus retained across re-render; state exposed through `aria-pressed`/`checked` rather than colour alone; DPR bounded `[1,2]` with clamping verified at a simulated 3× device.

**Not evidenced, required for M14:** screen-reader semantics for the canvas and for findings (an `aria-live` region for warnings is likely needed); focus management when overlays appear/disappear; visible focus indicators against the dark canvas; real high-DPI Windows displays; reduced-motion preference; and the documented Windows resolution matrix. Gate G4.

### 6.7 Capture

Validation is genuinely strong — signature, IHDR dimensions, SHA-256, and decoded pixel content (806 distinct colours, 5.063% non-background), with identical digests on repeat capture from an unchanged scene. Filenames are deterministic per project/view/mode.

The **delivery mechanism is the part to replace**: a `Blob` object-URL anchor click is a browser idiom. In the product this must go through the Electron main boundary with a real save dialog, path validation, overwrite policy, and error surfacing. Retain the pure validation; discard the download plumbing.

### 6.8 Performance

Comfortable at representative scale on this machine: worst-case scene conversion median 13.9369 ms, geometry conversion 0.9831 ms, mode toggle ~20 ms, capture 174.5 ms.

**The unmeasured risk is text-heavy signs.** LaserX converts text to outlines, and each glyph contributes multiple closed contours. Every fixture here is rectangle- and circle-based; the largest has 640 flattened contour points. A realistic text-heavy sign could plausibly be an order of magnitude larger, and §2 shows cost scales with flattened contour points superlinearly (via cutability's pairwise segment work), not with object count. **This must be measured before the preview is wired to arbitrary user documents** — gate G1.

Mitigations available if it bites, in preference order: the narrower topology entry point (§4.3); Web Worker offload (already sanctioned by `AGENTS.md` §6 for expensive geometry); incremental/cached conversion keyed on the existing scene fingerprint; and coarser flattening tolerance for preview only — the last with care, since preview must not misrepresent geometry.

---

## 7. Dependency and code-splitting strategy

### 7.1 Dependencies

Add to `apps/desktop` only (and `three` additionally to the new renderer package):

```jsonc
"three": "0.185.1",              // MIT
"@react-three/fiber": "9.7.0",   // MIT
// dev
"@types/three": "0.185.3"        // MIT
```

**Recommend dropping `@react-three/drei` entirely.** It is used for exactly one import in one file (`OrbitControls` in `CameraRig.tsx`), and `three` already ships `three/examples/jsm/controls/OrbitControls.js` under the same MIT licence. Wiring that directly into R3F costs a small amount of code and removes a whole dependency — with its own transitive tree and update cadence — from the production surface. If direct wiring proves awkward, keeping drei is acceptable; the point is that the choice should be deliberate rather than inherited from the lab.

Peer compatibility is already verified: `@react-three/fiber@9.7.0` requires React `>=19 <19.3` and `three >=0.156`; the desktop app pins React `19.2.8`.

### 7.2 Excluding research fixtures from the production bundle

The lab bundles all ten fixtures via:

```ts
import.meta.glob("../../../fixtures/physical-preview/*.laserx", { query: "?raw", eager: true })
```

That is correct for a self-contained research lab and **wrong for production** (+54.97 kB of test data, plus a URL-selectable fixture surface). Requirements:

1. Production code contains **no** `import.meta.glob` over `fixtures/**` and **no** `?raw` import of any `.laserx` file.
2. The preview reads the **currently open document** from existing application state — never a bundled fixture.
3. Test fixtures load from disk at test time, following `fixtures/projects` conventions.
4. Add a build-time assertion that the production bundle contains no fixture payload and no `__laserxPreviewLab` symbol. A grep-based check in `pnpm verify` is sufficient and cheap; the failure mode it prevents (shipping a debug renderer handle or test data) is exactly the kind that survives code review.

### 7.3 Code splitting

The 3D preview must be a **lazily-loaded chunk**:

- Load Three.js/R3F only when the user first opens the physical preview, via `React.lazy` + dynamic `import()`.
- Editing, import, analysis, save, and export must not pay for it — protecting M13's measured startup budgets.
- Show a bounded loading state; a failed chunk load must degrade like the WebGL-unavailable state, never blocking editing or saving.
- Verify with a post-build check that the main entry chunk excludes Three.js, and record the delta to the eager-load baseline.

---

## 8. Limitations, risks, and non-goals

### 8.1 Limitations of the evidence

- **One machine, one configuration** (i7-12700H / win32-x64 / headless Chromium 151). No cross-hardware, cross-GPU, or cross-browser data. Nothing here is a production budget.
- **Headless only.** Frame-interval figures reflect scheduler cadence, not real display/GPU behaviour.
- **No Electron integration whatsoever.** Everything was validated in a standalone browser app. Behaviour inside the packaged Electron renderer — GPU process, context isolation, preload boundary, packaged asset loading — is entirely unvalidated.
- **`high-complexity` is representative, not a ceiling.** No degradation limit was sought or found.
- **Heap figures are approximate** and include the harness's own retained arrays; heap is the one stress metric that is not perfectly flat (+512 KB across cycles 10→60).
- **A one-time +20 DOM-node step is unexplained** — bounded and non-recurring, but not chased down.
- **Pixel analysis proves non-blank, not correct.** Geometric correctness rests on the deterministic contour/hole unit tests, not on the screenshots.

### 8.2 Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Text-heavy signs exceed acceptable conversion time | **High** | Gate G1 measurement before wiring to user documents; §6.8 mitigations |
| Bundle regresses M13 startup budgets | **High** | Mandatory lazy chunk (§7.3) with post-build verification |
| Real-GPU/driver context loss behaves unlike the simulated path | Medium | Gate G3 on real hardware, including a GPU-process kill |
| Debug hook or fixtures reach production | Medium | Build-time assertions (§7.2), not review alone |
| Cutability API change (§4.3) destabilises M08 behaviour | Medium | ADR + optional; decline safely and ship as-is |
| Accessibility gaps surface late | Medium | Gate G4 before feature-complete |
| Preview mistaken for manufacturing evidence | **High** | Persistent non-certification language in UI and docs; keep `cutReady: false` semantics untouched |

### 8.3 Explicit non-goals

Unchanged from the brief and Issue #30, restated so promotion cannot quietly widen scope: no general-purpose 3D CAD; no mesh or solid editing; no 3D sketching; no bends, welds, bevels, embossing, or engraving depth; no STL/STEP/IGES/3MF or solid export; no CAM, nesting, toolpaths, G-code, or machine control; no schema changes; no second authoritative document model; no wall preview or scene composition; no headless/server rendering; no AI involvement in preview generation.

---

## 9. Staged M14 implementation plan

Each gate is independently reviewable with its own rollback point. **No gate may begin before M14 is formally activated.**

### G0 — Preconditions (no preview code)

- M13 closed, Issue #13 closed, `docs/status/CURRENT.md` records completion, owner explicitly advances.
- Repository prerequisites in §10 satisfied.
- ADR accepted for: adding Three.js/R3F to the production dependency surface, and the new `@laserx/physical-preview-three` package boundary.
- **Rollback:** nothing to roll back.

### G1 — Scaling validation (measurement only)

- Build a text-heavy fixture using real outlined text via `@laserx/fonts`, plus a stress fixture materially larger than `high-complexity`.
- Measure with the existing harness; decide whether §4.3's narrower cutability entry point is required or optional.
- **Acceptance:** documented conversion timings at realistic worst case, and an explicit go/no-go on the optimization.
- **Rollback:** discard fixtures; no product code touched.

### G2 — Promote the pure package

- Promote `@laserx/physical-preview-3d` with its tests plus the immutability mechanism and its negative tests.
- **Acceptance:** determinism, immutability, hole topology, layer order, Z placement, depth status, and fail-visible findings all green in CI on the exact head; zero production-surface change.
- **Rollback:** delete the package; nothing consumes it yet.

### G3 — Renderer package and real-hardware GPU validation

- Create `@laserx/physical-preview-three` from the promotion map; add pinned dependencies; resolve the drei question (§7.1).
- Validate on real Windows hardware: real GPU, GPU-process kill, software-rendering fallback, real high-DPI displays.
- **Acceptance:** Issue #30's "GPU/rendering failure degrades safely without blocking normal editing or saving" demonstrated on real hardware; geometry/camera/material/capture-validation tests green.
- **Rollback:** delete the package and dependencies; the desktop app still does not import it.

### G4 — Desktop integration behind a lazy chunk

- Build `apps/desktop/src/features/physical-preview/`, wired to the open document.
- Enforce lazy loading and the §7.2 build-time exclusions.
- Complete the accessibility work in §6.6.
- **Acceptance:** startup budgets unchanged versus M13 baseline; main chunk verifiably free of Three.js; no fixture payload or debug symbol in the bundle; keyboard/screen-reader/high-DPI evidence on the supported Windows matrix; preview provably non-mutating for geometry, dirty state, undo/redo, analysis, SVG/DXF, and production packages.
- **Rollback:** feature-flag off, or revert the feature directory; packages remain harmless and unreferenced.

### G5 — Capture through the privileged boundary

- Implement PNG save via typed preload IPC with path validation, overwrite policy, cancellation, and error surfacing.
- **Acceptance:** capture writes only where the user chooses; failures surface clearly; no renderer filesystem access; security audit clean.
- **Rollback:** disable the capture control; the preview remains fully functional without it.

### G6 — Acceptance evidence against Issue #30

Map each M14 acceptance item to exact-head evidence. Current standing from this research:

| Issue #30 acceptance item | Research status | Remaining |
|---|---|---|
| Exact-thickness preview for gauge / fractional-inch / millimetre stock | **Evidenced** | Re-prove in the desktop app |
| Layered sign, every layer in order with own material and thickness, assembled and exploded | **Evidenced** | Re-prove in the desktop app |
| Orbit/pan/zoom/reset, front/back/edge, mouse and keyboard, high-DPI Windows matrix | Partly — keyboard and bounded DPR evidenced headlessly | Real Windows high-DPI matrix (G4) |
| Through-holes and cutouts match authoritative 2D contours | **Evidenced** (raycast proof) | Re-prove in the desktop app |
| Invalid/ambiguous contours fail visibly, no mutation, no invented solids | **Evidenced** | Re-prove in the desktop app |
| Preview interaction provably non-mutating | Partly — proven for conversion | Extend to dirty state, undo/redo, analysis, exports (G4) |
| GPU/rendering failure degrades safely | Partly — headless only | Real hardware (G3) |
| Deterministic regeneration after accepted changes | **Evidenced** for identical input | Prove regeneration after real edits (G4) |
| Documented/tested high-DPI, keyboard, non-colour-only, GPU fallback, bounded performance | Partly | Screen-reader, reduced-motion, real displays (G4) |

**Overall acceptance for the preview scope:** all of the above green on the exact reviewed head, required CI green, no unresolved P0/P1 findings, and explicit owner advancement. Merge remains gated on the normal `Check LaserX` / `Advance LaserX` protocol.

---

## 10. Repository prerequisites

These are **preconditions on the repository**, not preview work, and are outside this experiment's authority to perform.

1. **Exact-head CI for the experiment branch.** No dedicated workflow currently runs on this branch — every result in this document is locally produced and self-reported. Before any promotion decision is finalised, a workflow must run typecheck, unit tests, browser tests, and build on the exact head, so evidence is independently reproducible rather than trusted. Local evidence is acceptable for isolated research; it is **not** acceptable as promotion evidence.

2. **Issue #36 — Windows case-colliding PR templates.** `.github/PULL_REQUEST_TEMPLATE.md` and `.github/pull_request_template.md` are both committed with different content and collide into one physical file on case-insensitive Windows checkouts. A Windows worktree therefore cannot report genuinely clean status: `git restore` merely flips which committed blob appears modified. Every evidence report from this workstream has had to caveat "clean except this pre-existing collision", which is exactly the noise that makes exact-head evidence harder to trust. **Resolve Issue #36 before M14 promotion evidence is collected.** This experiment deliberately never modified `.github`.

3. **`scripts/repository_guard.py` currently fails on `main`.** Running it during this deliverable's documentation checks produced:

   ```text
   Repository guard failed:
   - M13 must advance to M14 rather than stopping at maintenance/planning
   ```

   This is **not caused by this experiment**. Verified three ways: the failure is byte-identical with and without this document present; `docs/milestones/M13-windows-installer-beta-hardening.md` on this branch is byte-identical to `origin/main`; and `origin/main`'s own copy does not contain the `"Status advances to M14"` string the guard requires at `scripts/repository_guard.py:203`. The M13 milestone document was rewritten on `main` into the private-testing gate without the phrasing the guard still expects.

   Because `py -3 scripts/repository_guard.py` is one of the repository's required verification commands (`AGENTS.md` §20), **the guard is currently red for every branch**, which would make any promotion-evidence run fail for a reason unrelated to the change under review. Repairing it requires editing M13 milestone-status content, which this experiment is explicitly forbidden to touch — so it is reported here rather than fixed. **Resolve before M14 promotion evidence is collected**, either by restoring the expected phrasing or by updating the guard to match the accepted private-testing gate.

4. **ADRs required before implementation:** (a) Three.js/R3F entering the production dependency surface; (b) the `@laserx/physical-preview-three` package boundary; (c) optionally, the narrower `@laserx/cutability` topology entry point (§4.3).

5. **Fresh branch from then-current `main`.** Per `docs/WORKSTREAM_OWNERSHIP.md`, the experiment branch must never be merged wholesale. Promotion happens as reviewed, staged changes on a new branch — this branch is a research record, not a delivery vehicle.

---

## 11. What this document does not do

To be unambiguous:

- It **does not activate M14.** M13 remains the active gate under Issue #13 and `docs/status/CURRENT.md`.
- It **does not authorize any merge** into `main`, and does not make this branch merge-ready.
- It **does not modify milestone status**, close any issue, or advance any gate.
- It **does not authorize starting implementation.** Every gate in §9 is contingent on M14 activation and explicit owner authorization.
- It **does not change** schema, production exports, cutability behaviour, the desktop application, `.github`, or any CAD/CAM/machine-control surface — and no such file was touched in producing it.
- It is **a recommendation for independent owner review**, not a decision that has been taken.

The preview remains, in all cases, a visual aid. SVG, DXF, production packages, cutability analysis, and the native project file remain the sole manufacturing authorities, and no rendered result is manufacturing evidence.
