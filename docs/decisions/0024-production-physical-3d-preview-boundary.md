# ADR 0024: Production Physical 3D Preview Boundary

## Status

Accepted for M14 G0.

This ADR locks the architecture before any 3D runtime dependency or promoted
experiment code enters the desktop application. It records decisions only; it
adds no production feature code, no dependency, and no user-visible behavior.

## Context

Issue #34 delivered accepted physical-preview research at experiment head
`9a4a90c6fa891ed0d9baf9bc8c99d41b04d54136`, and Issue #42 delivered accepted
material-aware rendering research at `76fa77a8edeb976b46e8e345a4a232b938768b3f`.
Both were built in an isolated lab application and were explicitly **not**
authorized for merge.

M14 turns that research into a production feature. The research established the
approach works; it also established that a large part of the lab exists only to
support research and must never ship. This ADR draws that line before the code
moves, because the failure mode it prevents — a debug renderer handle or a
bundled test fixture reaching a shipped build — is exactly the kind that
survives ordinary code review.

## Decision

### 1. Authoritative sources are unchanged

The physical preview is a **derived, read-only consumer**. These remain the sole
authorities and are not modified by preview work:

- `packages/domain` — document model, physical layers, canonical `thicknessMm`;
- `packages/geometry` — paths, transforms, tolerances;
- `packages/cutability` — region topology and manufacturing analysis;
- `packages/project-format` — schema v9 parsing, validation, migration;
- `packages/production-export` — deterministic production packages;
- `packages/io-svg` / `packages/io-dxf` — manufacturing interchange.

The preview never becomes manufacturing evidence. SVG, DXF, production packages,
and cutability analysis remain the record of what will be cut. A rendered image
is never proof of manufacturability.

**No project-schema change belongs to M14.** Preview state — camera, assembled or
exploded mode, exploded spacing, layer-visibility toggles, capture state — is
derived and non-persistent. It is not project data unless a later migration
explicitly says otherwise.

### 2. Package responsibilities

```text
LaserxProject (schema v9, validated by @laserx/project-format)
        │  read-only snapshot; never mutated
        ▼
packages/physical-preview-3d/          pure, renderer-independent
  physical-layer selection · region topology via @laserx/cutability
  extrusion polarity · exact thicknessMm · Z stackup · findings
  deterministic fingerprint
  no React · no Three · no DOM · no filesystem · no GPU
        │  PhysicalPreviewAssembly (serializable)
        ▼
packages/physical-preview-three/       renderer adapter (new in G3)
  Shape/Shape.holes + ExtrudeGeometry · deterministic camera poses
  material appearance mapping · pure capture validation
  depends on: three, @laserx/physical-preview-3d
  no React · no Electron · no filesystem
        │  BufferGeometry + pose/material descriptors
        ▼
apps/desktop/src/features/physical-preview/    React + R3F orchestration
  Canvas · controls · readouts · findings surface · fallbacks
  lazy-loaded chunk
        │  save request
        ▼
Electron main via typed preload IPC    privileged PNG write
```

`packages/physical-preview-3d` must not gain a dependency on Three, React,
Electron, or any material catalog. `packages/physical-preview-three` must not
gain a dependency on React or Electron. Both consume authoritative snapshots and
never mutate them.

React components contain no geometry algorithms. Every conversion step is
unit-testable in Node without a GPU.

### 3. Three.js and React Three Fiber

The renderer is **Three.js with React Three Fiber**. Both are MIT. The research
delivered every approved M14 preview requirement on this stack with no unmet
capability: exact-thickness extrusion, genuine through-holes, ordered multi-layer
assemblies, assembled/exploded views, the four view presets with orbit/pan/zoom/
reset, material-aware appearance, deterministic regeneration, fail-visible
invalid geometry, GPU fallback and context-loss recovery, validated PNG capture,
and bounded high-DPI.

`@react-three/drei` is **not adopted**. The lab used it for exactly one import
(`OrbitControls`), which `three` already ships under the same license. G3 wires
that directly and avoids the extra dependency tree. If direct wiring proves
impractical, adopting drei requires a recorded decision in the G3 PR rather than
an inherited default.

Exact versions, licenses, and `pnpm audit --prod` results are gated at the G3/G4
PRs that actually add the dependency. This ADR approves the stack, not a
specific unaudited version.

### 4. No CAD kernel

**No CAD kernel is adopted for M14.** No current M14 requirement is blocked
without one. A kernel would be adopted *in addition to* Three.js — something
still has to render — buying multi-megabyte WASM, worker requirements, licensing
review, and cold-start cost for zero required capability.

This decision **must be re-taken, not extended by assumption**, if any of the
following is ever approved:

- true 3D boolean operations between solids;
- non-planar surfaces;
- bends, welds, bevels, or embossing;
- STEP, STL, IGES, or 3MF solid interchange.

All four are outside M14 by the milestone's own exclusions.

### 5. Lazy-loading boundary

The entire preview feature — Three.js, React Three Fiber, the renderer adapter,
and the preview UI — is a **lazily-loaded chunk**, loaded only when the user
first opens the physical preview.

The measured lab bundle was 1,344.38 kB raw / 356.93 kB gzip. That is too much to
add unconditionally to an editor whose startup budgets M13 already gated, so code
splitting is a hard requirement rather than an optimization.

- Editing, import, analysis, save, and export must not pay for the preview.
- A bounded loading state is shown while the chunk loads.
- A **failed chunk load degrades like the WebGL-unavailable state** and must never
  block editing, saving, or export.
- G4 verifies with a post-build check that the main entry chunk excludes Three.js.

### 6. Privileged PNG capture

Capture crosses a **typed Electron preload/main IPC boundary**. The renderer never
writes the filesystem.

The lab's `Blob` object-URL anchor download is explicitly **rejected for
production**. It is a browser idiom that bypasses the privileged-write boundary
and provides no overwrite or rollback policy.

The pure validation half is retained and promoted: PNG signature, IHDR
dimensions, non-empty pixel content, and deterministic filenames. The new IPC
surface must be typed, sender-checked, path-validated, and subject to the
existing overwrite policy, and must report failures explicitly rather than
failing silently.

`preserveDrawingBuffer: true` is required for reliable capture readback and is a
deliberate, documented cost.

### 7. Non-mutation and failure behavior

Preview interaction must not change geometry, dirty state, undo/redo history,
selection, analysis results, save behavior, SVG/DXF output, or production
packages. Layer-visibility toggles are presentation-only and stay that way.

The preview must never silently close, repair, scale, union, discard,
reinterpret, or invent physical geometry. Open, self-intersecting, ambiguous,
empty, and unsupported physical layers **fail visibly** with source-linked
findings and no invented solids, and partial assemblies must be described as
declared-incomplete rather than verified depth.

Rendering failure is never allowed to block normal editing, saving, or
manufacturing export. Both evidenced states must survive promotion: WebGL
unavailable at startup, and context lost at runtime with automatic recovery.

Determinism and immutability become **continuous guarantees**, not one-off
measurements: fingerprint- and geometry-equality assertions and the immutability
mechanism are promoted into the production package's own suite. The immutability
**negative tests are promoted with it** — during the research an immutability
check passed while proving nothing, and only a test that can fail demonstrates
otherwise.

### 8. Production exclusions

The following are experiment-only and **must never ship in a production bundle**:

- the lab application shell, its entry point, and its styles;
- the `__laserxPreviewLab` benchmark hook, which deliberately exposes the live
  `WebGLRenderer`;
- the fixture registry, the fixture loader, and the `?fixture=` URL selection
  surface;
- the `?material=` URL selection surface;
- bundled research fixture payloads, including any `import.meta.glob` over
  `fixtures/**` and any `?raw` import of a `.laserx` file;
- the benchmark harness.

Production code reads the **currently open document** from existing application
state — never a bundled fixture. Test fixtures load from disk at test time.

These exclusions are enforced mechanically by `pnpm audit:physical-preview`
(`scripts/physical-preview-boundary-audit.mjs`), not by review alone. The audit
matches the **actual** accepted research patterns rather than convenient
literals: the lab selects fixtures with `new URLSearchParams(search).get("fixture")`
and materials with `.get("material")`, so URL-search-param selection is rejected
directly. It also rejects imports, `new URL()` references, and build/packaging
configuration that reach into repository `fixtures/`, fixture-registry modules,
and `.laserx` payloads placed in the desktop static-asset folder.

Forbidden dependency couplings are rejected across **every** dependency field —
`dependencies`, `devDependencies`, `peerDependencies`, and
`optionalDependencies` — because a forbidden runtime coupling installs just as
really from an optional or dev field, and the pure scene contract must not need
a renderer even to run its own tests.

`pnpm audit:physical-preview-guard`
(`scripts/test-physical-preview-boundary-audit.mjs`) proves each rule actually
fails on the real research patterns, and proves the guard does **not** fire on
ordinary production code such as a `Map` lookup keyed `"material"` or the
renderer adapter's legitimate `three` dependency.

### 9. Component-by-component promotion, never a branch merge

The experiment branch is **never merged wholesale**. Each slice promotes reviewed
components into production paths with their tests, adapting them to production
boundaries. The lab remains a research record.

Promotion disposition:

| Component | Disposition |
|---|---|
| Pure scene/assembly contract | Promote largely intact (G2) |
| Three geometry, camera poses, material mapping, capture validation | Promote into `packages/physical-preview-three/` (G3) |
| React preview UI | Adopt the interaction model, rewrite against the open document (G4) |
| PNG download path | Reject as built; rewrite behind typed IPC (G5) |
| Lab shell, bench hook, fixture registry/loader | Never ships |
| Benchmark harness, research fixtures | Experiment-only; a fixture subset may be promoted as disk-loaded test fixtures |

### 10. G1 evidence is a precondition for arbitrary-document wiring

The research measured cost on rectangle- and circle-based fixtures only. It also
measured that cost is dominated by **reused cutability analysis**, not rendering
— 8.3256 ms scene conversion versus 0.2741 ms Three conversion on one fixture,
roughly 30× — and that cost scales with flattened contour points rather than
object count.

LaserX converts text to outlines, and each glyph contributes multiple closed
contours. Text-heavy signs are therefore **unmeasured and the clearest scaling
risk**.

**G1 must produce text-heavy and high-point-count measurements before the preview
is wired to arbitrary user documents.** G1 also evaluates whether a narrower
topology-only entry point from `packages/cutability` is justified. That entry
point, if pursued, is an export-surface change that **must not fork or duplicate
the region-classification algorithm**, requires its own ADR, and must not weaken
fail-visible findings. It is an optimization gate, not a blocker: if declined,
the preview ships on the existing analysis path.

## Rationale

Locking the boundary before promotion is what keeps a research harness from
becoming product surface by accident. The separation of the pure package from the
renderer adapter is not cosmetic — the Three conversion is already proven to run
and be fully tested in Node with no WebGL context, and anything Node-testable
belongs in a package rather than inside an app, where its tests would depend on
the desktop build.

Lazy-loading and the capture boundary are the two places where the research
implementation is knowingly wrong for production, so both are recorded as
requirements rather than left for the implementing slice to rediscover.

## Alternatives

- **Merging the experiment branch** was rejected: it would ship the lab shell,
  the debug renderer handle, the fixture surface, and bundled test payloads.
- **Keeping Three conversion inside `apps/desktop`** was rejected because it makes
  GPU-free unit tests depend on the desktop app build.
- **Adopting a CAD kernel** was rejected because no M14 requirement needs one.
- **Eager-loading the preview** was rejected because it charges every user the
  full 3D bundle to open the editor.
- **Promoting the anchor-download capture** was rejected because it bypasses the
  privileged-write boundary.
- **Wiring the preview to arbitrary documents before G1** was rejected because the
  dominant cost is unmeasured on text-heavy work.
- **Enforcing the exclusions by review alone** was rejected because a debug handle
  or bundled fixture is precisely what review misses.

## Consequences

M14 proceeds as bounded reviewed slices G0–G6, each stopping for independent
exact-head audit. G0 adds documentation and one narrow audit; it adds no
production code, no dependency, and no user-visible behavior.

The audit in this slice checks the boundary **conditionally**: the physical-preview
packages do not exist yet, so it asserts the forbidden-symbol, fixture-payload,
and CAD-kernel rules against current production source, and applies the
package-dependency rules only once those packages exist. It does not assert that
unbuilt packages are present.

Reopening the no-CAD-kernel or no-drei decisions requires a new or amended ADR.
Persisting any preview state requires a schema migration and its own ADR.
