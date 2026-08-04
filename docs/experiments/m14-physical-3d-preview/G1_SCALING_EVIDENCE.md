# M14 G1 — Text-Heavy Scaling and Topology-Cost Evidence

Gate G1 of Issue #30. Measures realistic physical-preview cost **before** any arbitrary-document desktop wiring or production scene-package promotion.

> This gate promotes no production code, adds no production dependency, and wires no UI. It exists to answer one question with numbers: what does the accepted preview pipeline actually cost on the content LaserX really produces?

- Harness: [`tools/m14-preview-bench`](../../../tools/m14-preview-bench)
- Raw and summary results: [`g1-results.json`](./g1-results.json)
- Command: `pnpm --filter @laserx/tool-m14-preview-bench bench`

## Why this gate exists

The accepted Issue #34 research measured only rectangle- and circle-based signs, and its most consequential finding was that cost scales with **flattened contour points**, not object count. LaserX converts text to outlines, and every glyph contributes multiple closed contours. So the single most common real workload — a sign with words on it — was entirely unmeasured, and the integration recommendation flagged it as the open scaling risk.

## Method

Fixtures are built from **real font outlines** through the production `@laserx/fonts` engine, so glyph counters (`O`, `R`, `A`, `8`, `&`) become genuine interior holes rather than synthetic circles. No geometry is invented; the contours are whatever the shipped font engine emits.

Cost is attributed using `analyzeDocumentCutability`'s own `onProgress` callback, which is part of its public options contract. Timestamping it observes the **real production code path** — nothing is forked, copied, or patched to obtain the split:

| Phase | Reported at | Work | Discardable for preview? |
|---|---|---|---|
| `normalizing` | 5 → 25 | Path normalization, segment building, `OPEN_CONTOUR`, `UNSUPPORTED_GEOMETRY` | **No** |
| `topology` | 25 → 55 | Duplicate segments, overlapping segments, self-intersections, separate-contour intersections | **No** — every check feeds the ambiguity flag |
| `spacing` | 55 → 85 | Minimum feature width, kerf collapse, gap, contour proximity | **Yes** — manufacturing advisory only |
| `classifying` | 85 → 100 | `classifyRegions` + island/dropout/bridge issues | **No** |

20 samples per fixture after 3 warmup runs. Conventional median; nearest-rank p95, which at 20 samples selects the 19th value and is therefore genuinely distinct from max.

**Raw per-sample arrays for every stage are committed** in `g1-results.json`, and every published summary is derived from those exact rounded arrays — `tests/results.test.ts` recomputes each one and fails if they disagree.

**Scope honesty:** `packages/physical-preview-3d` and `packages/physical-preview-three` do not exist yet (G2/G3). The scene-assembly and Three-conversion steps are a harness local to this tool, written to match the accepted contract at head `9a4a90c6fa891ed0d9baf9bc8c99d41b04d54136`. The part the decision rests on — region topology and its ambiguity flag — is the real production analysis, not a copy.

## Environment

Node v24.18.0, win32-x64, Intel64 Family 6 Model 154 Stepping 3 (i7-12700H class), headless. **One machine, one configuration.** These are comparative figures, not production budgets.

## Results

| Fixture | Objects | Points | Segments | Parse | **Analysis** | Scene | **Three** | Analysis ÷ Three |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `text-short` | 6 | 455 | 455 | 0.46 ms | **37.91 ms** | 0.01 ms | **0.77 ms** | 49.3× |
| `text-sign` | 23 | 1,964 | 1,964 | 1.21 ms | **336.37 ms** | 0.02 ms | **4.27 ms** | 78.8× |
| `text-heavy` | 110 | 9,433 | 9,433 | 4.20 ms | **1,724.72 ms** | 0.22 ms | **20.32 ms** | 84.9× |
| `high-point-count` | 24 | 5,760 | 5,760 | 2.57 ms | **1,234.42 ms** | 0.02 ms | **10.56 ms** | 116.9× |
| `very-high-point-count` | 48 | 23,040 | 23,040 | 9.51 ms | **9,719.08 ms** | 0.06 ms | **52.39 ms** | 185.5× |

All values are medians. Analysis p95 / max: 40.5/40.6, 344.5/359.1, 1,786.7/1,801.6, 1,253.3/1,265.0, 9,777.1/9,808.9 ms — p95 is distinct from max for every fixture.

Every scaling fixture analyses to status `complete`. Extruded vertex counts, which are deterministic: 5,400 / 23,292 / 112,176 / 68,832 / 275,904.

### Phase breakdown (median ms and share of analysis)

| Fixture | normalizing | topology | spacing | classifying |
|---|---:|---:|---:|---:|
| `text-short` | 6.2 (16.5%) | 10.8 (28.4%) | 17.1 (45.1%) | 3.4 (8.8%) |
| `text-sign` | 76.2 (22.6%) | 123.2 (36.6%) | 127.7 (38.0%) | 8.6 (2.5%) |
| `text-heavy` | 356.2 (20.7%) | 584.1 (33.9%) | 721.8 (41.8%) | 61.9 (3.6%) |
| `high-point-count` | 299.8 (24.3%) | 482.9 (39.1%) | 447.2 (36.2%) | 2.9 (0.2%) |
| `very-high-point-count` | 2,351.3 (24.2%) | 3,790.1 (39.0%) | 3,554.7 (36.6%) | 12.4 (0.1%) |

### Fail-closed fixtures

Four fixtures exist purely to prove the harness does not invent solids from geometry the analysis cannot resolve — one per condition that raises the ambiguity flag:

| Fixture | Status | Key finding | Shapes built |
|---|---|---|---:|
| `invalid-duplicate-segment` | `ambiguous` | `DUPLICATE_SEGMENT` | **0** |
| `invalid-overlapping-segment` | `ambiguous` | `OVERLAPPING_SEGMENT` | **0** |
| `invalid-self-intersecting` | `ambiguous` | `SELF_INTERSECTION` | **0** |
| `invalid-cross-intersecting` | `ambiguous` | `UNSUPPORTED_GEOMETRY` | **0** |

Because these are recorded in the same artifact, the scaling timings above are provably taken from geometry the analysis resolved (`complete`), not from invented solids.

## Findings

### 1. Cost is dominated by reused cutability work, overwhelmingly

The Issue #34 research measured a ~30× gap between scene conversion and Three conversion. On text it is **49× to 186×**. Three.js geometry conversion is not the problem and never was — extruding 275,904 vertices takes 52 ms.

Scene assembly itself (region → shape/hole mapping and Z stackup) is negligible at **0.01–0.22 ms**. Parsing is negligible. Essentially all preview cost is `analyzeDocumentCutability`.

### 2. A realistic text sign is already too slow

`text-heavy` is an ordinary five-line shop sign — not a stress case. It costs **1.72 s median, 1.79 s p95** before a single pixel is drawn. Opening a preview cannot block for that long, and this is on a fast laptop CPU.

### 3. Scaling is superlinear in contour points

Within the same generator family, 4.00× the points costs 7.87× the time — an exponent of **~1.49**. Three conversion over the same step scales at exponent **~1.16**, essentially linear.

Comparing across fixture *kinds* is not a clean power law (`text-heavy` has 1.64× the points of `high-point-count` but only 1.40× the time), because the pairwise segment work depends on spatial distribution, not just count. The superlinearity claim is therefore made only within a family, where geometry kind is held constant.

### 4. Only the spacing phase is safely discardable — and that is the whole saving

An earlier draft of this document claimed roughly three quarters of the analysis was discardable, on the grounds that the preview only reads region topology. **That claim was wrong and is withdrawn.**

`analyzeDocumentCutability` maintains a single `ambiguous` flag, and the topology phase raises it for **all** of:

- `DUPLICATE_SEGMENT`;
- `OVERLAPPING_SEGMENT`;
- `SELF_INTERSECTION`;
- intersections between separate contours, reported as `UNSUPPORTED_GEOMETRY`.

That flag is then passed straight into `classifyRegions(paths, ambiguous)`, which marks **every** region `"ambiguous"` when it is set, and it gates whether region issues are emitted at all. So the topology phase is not advisory work the preview happens to ignore — it is what determines whether region classification can be trusted.

Dropping duplicate/overlap detection to "keep only self-intersection" would let a duplicated, overlapping, or cross-intersecting file reach region classification **without** the ambiguity flag and without visible findings, and the preview would then build confident solids from geometry that is genuinely unresolvable. That is precisely the invented-solid failure Issue #30 and ADR 0024 §7 forbid.

The only measured saving that preserves every validity and ambiguity check is the manufacturing-advisory `spacing` phase:

| Scope | Saving | `text-heavy` after |
|---|---:|---:|
| Skip `spacing` only — no finding, no ambiguity check lost | **36.2% – 45.1%** | ~1,003 ms |

No larger figure is claimed, and no larger figure should be planned against.

### 5. A preview entry point is worth having, but it is not sufficient on its own

Saving ~40% of 1.72 s still leaves ~1 s. Faster is not the same as fast enough.

## Decision: a preview region-classification entry point is justified

**Recommended: yes — pursue it, with a separate ADR, and scope it correctly.**

Name and scope matter here. It is **not** a "topology-only" path that skips most topology work. It is a **preview/region-classification entry point** that returns region topology plus complete geometry-validity and ambiguity detection, and omits only the manufacturing-advisory limit passes.

Required scope:

1. It must **reuse** the accepted `classifyRegions` implementation — an export-surface change, never a second implementation of region classification.
2. It must preserve **every ambiguity-producing check**: open contours, unsupported geometry, duplicate segments, overlapping segments, self-intersections, and separate-contour intersections — and must surface the resulting findings and `ambiguous` status.
3. It must fail closed: an ambiguous analysis yields no solids, exactly as `buildScene` now does in the harness.
4. It must remain deterministic for identical input.
5. It requires its own ADR before implementation, because it changes a package's public API.
6. It remains **optional**: if the ADR is declined, the preview ships on the existing analysis path and the cost is carried by the mitigations below instead.

### It must not be the only mitigation

Because saving ~40% of 1.72 s still leaves ~1 s, G4 must not wire the preview to arbitrary documents on the strength of this entry point alone. In preference order:

1. **Off the UI thread.** `AGENTS.md` §8 already sanctions Web Workers for measured expensive geometry, and this is now measured. A 1.7 s main-thread block is a frozen editor.
2. **Cache on the existing scene fingerprint.** The accepted contract already computes a deterministic fingerprint; re-analysis on unchanged geometry is pure waste, and preview toggles (view, mode, visibility) change nothing that affects topology.
3. **Progress and cancellation.** `analyzeDocumentCutability` already reports progress; a preview opened on a large sign needs a bounded, cancellable path rather than an unbounded wait.

Coarser preview-only flattening tolerance is deliberately **not** recommended: it would make the preview disagree with the authoritative geometry, which ADR 0024 §1 forbids.

## Limitations

- **One machine, one configuration**, headless Node. No cross-hardware, cross-GPU, or Electron data. These figures are comparative, not budgets.
- **Between-run variance is not characterised by the committed evidence.** Earlier exploratory runs of this harness produced materially different absolute timings, but their raw samples were not retained, so no cross-run stability claim is made here. What the committed data does support is **within-run** spread: the max ÷ min ratio across 20 samples is 1.02×–1.13× for four fixtures and 1.73× for `text-sign`. Absolute milliseconds should be treated as an order of magnitude; the ratios and phase shares are the durable part.
- **Memory is not measured.** An earlier draft reported heap deltas; they were removed because the harness runs without `--expose-gc`, so `globalThis.gc()` is a no-op and the figures were dominated by GC timing (two fixtures showed negative growth). Deterministic vertex, geometry, and segment counts are reported instead as the resource-scaling signal.
- **Three conversion here is CPU-side geometry construction only.** No GPU upload, no draw calls, no renderer. Real GPU behaviour remains unmeasured until G3/G6.
- **The cost of individual checks within the topology phase is unmeasured.** `onProgress` exposes four boundaries; splitting further would mean instrumenting `packages/cutability`, which is outside G1. This does not affect the decision, because the whole phase must be retained regardless.
- **`very-high-point-count` is deliberately beyond any realistic sign.** It exists to expose the scaling exponent, not to represent user work.
- Scene assembly and Three conversion are measured through a tool-local harness matching the accepted contract, not through the production packages, which do not exist until G2/G3.

## Not done in this gate

No production scene-package promotion, no Three/R3F production dependency, no desktop or open-document wiring, no PNG capture, no experiment-branch merge or cherry-pick, no material catalog or schema promotion, no M15 work. `three` is a devDependency of a private `tools/` benchmark package only, which ADR 0024 §8 classifies as experiment tooling.
