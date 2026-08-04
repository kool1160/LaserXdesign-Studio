# M14 G1 — Text-Heavy Scaling and Topology-Cost Evidence

Gate G1 of Issue #30. Measures realistic physical-preview cost **before** any arbitrary-document desktop wiring or production scene-package promotion.

> This gate promotes no production code, adds no production dependency, and wires no UI. It exists to answer one question with numbers: what does the accepted preview pipeline actually cost on the content LaserX really produces?

- Harness: [`tools/m14-preview-bench`](../../../tools/m14-preview-bench)
- Raw results: [`g1-results.json`](./g1-results.json)
- Command: `pnpm --filter @laserx/tool-m14-preview-bench bench`

## Why this gate exists

The accepted Issue #34 research measured only rectangle- and circle-based signs, and its most consequential finding was that cost scales with **flattened contour points**, not object count. LaserX converts text to outlines, and every glyph contributes multiple closed contours. So the single most common real workload — a sign with words on it — was entirely unmeasured, and the integration recommendation flagged it as the open scaling risk.

## Method

Fixtures are built from **real font outlines** through the production `@laserx/fonts` engine, so glyph counters (`O`, `R`, `A`, `8`, `&`) become genuine interior holes rather than synthetic circles. No geometry is invented; the contours are whatever the shipped font engine emits.

Cost is attributed using `analyzeDocumentCutability`'s own `onProgress` callback, which is part of its public options contract. Timestamping it observes the **real production code path** — nothing is forked, copied, or patched to obtain the split:

| Phase | Reported at | Work | Does the preview need it? |
|---|---|---|---|
| `normalizing` | 5 → 25 | Path normalization, segment building, `OPEN_CONTOUR`, `UNSUPPORTED_GEOMETRY` | **Yes** |
| `topology` | 25 → 55 | Duplicate/overlapping segments, **`SELF_INTERSECTION`** | **Partly** — see below |
| `spacing` | 55 → 85 | Minimum feature width, kerf collapse, gap, contour proximity | **No** |
| `classifying` | 85 → 100 | `classifyRegions` + island/dropout/bridge issues | **Yes** (regions) |

12 samples per fixture after 3 warmup runs; conventional median, nearest-rank p95 — the same conventions as the Issue #34 evidence so the two sets are directly comparable.

**Scope honesty:** `packages/physical-preview-3d` and `packages/physical-preview-three` do not exist yet (G2/G3). The scene-assembly and Three-conversion steps are a harness local to this tool, written to match the accepted contract at head `9a4a90c6fa891ed0d9baf9bc8c99d41b04d54136`. The part the decision rests on — region topology — is the real production analysis, not a copy.

## Environment

Node v24.18.0, win32-x64, Intel64 Family 6 Model 154 Stepping 3 (i7-12700H class), headless. **One machine, one configuration.** These are comparative figures, not production budgets.

## Results

| Fixture | Objects | Contour points | Parse (median) | **Analysis (median)** | Scene | **Three (median)** | Analysis ÷ Three |
|---|---:|---:|---:|---:|---:|---:|---:|
| `text-short` | 6 | 455 | 0.71 ms | **55.72 ms** | 0.01 ms | **1.25 ms** | 44.6× |
| `text-sign` | 23 | 1,964 | 1.64 ms | **444.52 ms** | 0.03 ms | **5.64 ms** | 78.8× |
| `text-heavy` | 110 | 9,433 | 5.35 ms | **2,018.53 ms** | 0.27 ms | **23.59 ms** | 85.6× |
| `high-point-count` | 24 | 5,760 | 2.71 ms | **1,288.59 ms** | 0.02 ms | **11.27 ms** | 114.4× |
| `very-high-point-count` | 48 | 23,040 | 9.27 ms | **9,889.28 ms** | 0.06 ms | **50.39 ms** | 196.2× |

p95 analysis: 67.4 ms, 509.8 ms, **2,122.3 ms**, 1,313.3 ms, 10,329.2 ms respectively.

Extruded vertex counts, which are deterministic: 5,400 / 23,292 / 112,176 / 68,832 / 275,904.

### Phase breakdown (median ms and share of analysis)

| Fixture | normalizing | topology | spacing | classifying |
|---|---:|---:|---:|---:|
| `text-short` | 9.6 (17.2%) | 15.8 (28.3%) | 25.5 (45.7%) | 5.0 (9.0%) |
| `text-sign` | 100.6 (22.6%) | 165.5 (37.2%) | 167.3 (37.6%) | 11.4 (2.6%) |
| `text-heavy` | 417.3 (20.7%) | 682.6 (33.8%) | 839.4 (41.6%) | 72.8 (3.6%) |
| `high-point-count` | 307.1 (23.8%) | 499.6 (38.8%) | 470.5 (36.5%) | 3.1 (0.2%) |
| `very-high-point-count` | 2,343.6 (23.7%) | 3,804.7 (38.5%) | 3,711.4 (37.5%) | 11.9 (0.1%) |

### Run-to-run variance is large

An earlier run of the identical harness on the same machine produced `text-heavy` 2,522.65 ms and `very-high-point-count` 15,018.37 ms — **25% and 52% above** the committed figures. The *shape* of the result (phase shares, the analysis ÷ Three ratio, the scaling exponent) was stable across both runs; the absolute milliseconds were not.

Treat every absolute number here as an order of magnitude on one machine, and treat only the ratios and shares as durable. This is also why no performance budget is proposed in this gate.

## Findings

### 1. Cost is dominated by reused cutability work, overwhelmingly

The Issue #34 research measured a ~30× gap between scene conversion and Three conversion. On text it is **45× to 196×**. Three.js geometry conversion is not the problem and never was — extruding 275,904 vertices takes 50 ms.

Scene assembly itself (region → shape/hole mapping and Z stackup) is negligible at **0.01–0.27 ms**. Parsing is negligible. Essentially all preview cost is `analyzeDocumentCutability`.

### 2. A realistic text sign is already too slow

`text-heavy` is an ordinary five-line shop sign — not a stress case. It costs **2.02 s median, 2.12 s p95** before a single pixel is drawn. Opening a preview cannot block for that long, and this is on a fast laptop CPU.

### 3. Scaling is superlinear in contour points

Within the same generator family, 4.00× the points costs 7.67× the time — an exponent of **~1.47**. Three conversion over the same step scales at exponent **~1.08**, essentially linear.

Comparing across fixture *kinds* is not a clean power law (`text-heavy` has 1.64× the points of `high-point-count` but only 1.57× the time), because the pairwise segment work depends on spatial distribution, not just count. The superlinearity claim is therefore made only within a family, where geometry kind is held constant.

### 4. Roughly three quarters of the analysis is computed and discarded

The preview consumes only region topology and geometry-validity findings. Normalizing plus classifying is **23.8%–26.2%** of analysis time across every fixture. The rest is manufacturing-limit work the preview never reads.

### 5. But the discardable share cannot simply be skipped — `SELF_INTERSECTION` lives in it

This is the finding that changes the recommendation.

ADR 0024 §7 and Issue #30 require open, self-intersecting, and unsupported geometry to **fail visibly**. Mapping each issue code to its emitting phase:

- `OPEN_CONTOUR`, `UNSUPPORTED_GEOMETRY` → `normalizing` (kept for free);
- **`SELF_INTERSECTION` → `topology`**, alongside the discardable `DUPLICATE_SEGMENT` and `OVERLAPPING_SEGMENT`;
- `FEATURE_TOO_NARROW`, `KERF_COLLAPSE_RISK`, `GAP_TOO_SMALL`, `CONTOURS_TOO_CLOSE` → `spacing` (all discardable);
- `DISCONNECTED_ISLAND`, `BRIDGE_TOO_NARROW`, `ENCLOSED_DROPOUT` → `classifying`.

A topology-only entry point that skipped phases 25→85 wholesale would be fast **and would silently lose self-intersection detection**, which the accepted research specifically proved must produce zero shapes and a visible finding. That is not an acceptable trade.

The achievable saving is therefore bounded:

| Scope | Saving | `text-heavy` after |
|---|---:|---:|
| Skip `spacing` only (safe, no finding lost) | **36.5% – 45.7%** | ~1,179 ms |
| Also drop duplicate/overlap while keeping self-intersection | up to **~74–76%** | ~490 ms |

The upper bound is not yet evidence — `onProgress` gives four boundaries, so the self-intersection share *within* the topology phase was not separately measured. Splitting it would require instrumenting `packages/cutability` itself, which is out of G1 scope.

### 6. A topology-only entry point is necessary but not sufficient

Even at the optimistic ~76% saving, `text-heavy` still costs ~490 ms and `very-high-point-count` ~2.4 s. Faster is not the same as fast enough.

## Decision: a topology-only cutability entry point is justified

**Recommended: yes — pursue it, with a separate ADR, scoped correctly.**

The evidence supports it plainly: the preview pays 45×–197× the rendering cost for analysis, and at minimum ~36% of that is provably discardable without losing any finding the preview needs.

Required scope, matching the assignment's constraints:

1. It must **reuse** the accepted `classifyRegions` implementation — an export-surface change, never a second implementation of region classification.
2. It must preserve fail-visible findings: `OPEN_CONTOUR`, `UNSUPPORTED_GEOMETRY`, **and `SELF_INTERSECTION`**. Naming it "topology-only" must not be read as "skip everything except regions".
3. It must remain deterministic for identical input.
4. It requires its own ADR before implementation, because it changes a package's public API.
5. It remains **optional**: if the ADR is declined, the preview ships on the existing analysis path and the cost is carried by the mitigations below instead.

### It must not be the only mitigation

Because saving 76% of 2.0 s is still ~490 ms, G4 must not wire the preview to arbitrary documents on the strength of this entry point alone. In preference order:

1. **Off the UI thread.** `AGENTS.md` §8 already sanctions Web Workers for measured expensive geometry, and this is now measured. A 2 s main-thread block is a frozen editor.
2. **Cache on the existing scene fingerprint.** The accepted contract already computes a deterministic fingerprint; re-analysis on unchanged geometry is pure waste, and preview toggles (view, mode, visibility) change nothing that affects topology.
3. **Progress and cancellation.** `analyzeDocumentCutability` already reports progress; a preview that opens on a large sign needs a bounded, cancellable path rather than an unbounded wait.

Coarser preview-only flattening tolerance is deliberately **not** recommended: it would make the preview disagree with the authoritative geometry, which ADR 0024 §1 forbids.

## Limitations

- **One machine, one configuration**, headless Node. No cross-hardware, cross-GPU, or Electron data. These figures are comparative, not budgets.
- **Heap deltas are not trustworthy** and are excluded from the findings: the harness runs without `--expose-gc`, so `globalThis.gc()` is a no-op and the recorded deltas are dominated by GC timing (two fixtures report negative growth). Deterministic vertex and geometry counts are reported instead as the resource-scaling signal.
- **Three conversion here is CPU-side geometry construction only.** No GPU upload, no draw calls, no renderer. Real GPU behaviour remains unmeasured until G3/G6.
- **The self-intersection share within the topology phase is unmeasured**, so the ~76% upper bound is an estimate and the ~36% lower bound is the only figure that should be relied on for planning.
- **`very-high-point-count` is deliberately beyond any realistic sign.** It exists to expose the scaling exponent, not to represent user work.
- Scene assembly and Three conversion are measured through a tool-local harness matching the accepted contract, not through the production packages, which do not exist until G2/G3.

## Not done in this gate

No production scene-package promotion, no Three/R3F production dependency, no desktop or open-document wiring, no PNG capture, no experiment-branch merge or cherry-pick, no material catalog or schema promotion, no M15 work. `three` is a devDependency of a private `tools/` benchmark package only, which ADR 0024 §8 classifies as experiment tooling.
