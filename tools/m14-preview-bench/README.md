# @laserx/tool-m14-preview-bench

Measurement harness for **M14 gate G1** (Issue #30): how does the accepted physical-preview pipeline scale on realistic, text-heavy signs?

Developer-only tooling. Nothing here ships. `three` is a **devDependency of this private tool**, not a production dependency — ADR 0024 §8 classifies the benchmark harness as experiment tooling.

## Commands

```bash
pnpm --filter @laserx/tool-m14-preview-bench bench       # measure; writes g1-results.json
pnpm --filter @laserx/tool-m14-preview-bench test        # unit tests (fast)
pnpm --filter @laserx/tool-m14-preview-bench typecheck
```

`bench` takes several minutes: the largest fixture alone costs ~15 s per sample and there are 12 samples plus 3 warmups per fixture. It is kept out of the default `test` glob for that reason — `test` runs only `tests/`, `bench` runs only `bench/`.

Results are written to `docs/experiments/m14-physical-3d-preview/g1-results.json`; the analysis is in `G1_SCALING_EVIDENCE.md` beside it.

## What it measures

`parse → analyze → build scene → convert to Three`, with the analysis broken into the four phases `analyzeDocumentCutability` reports through its public `onProgress` callback. Timestamping that callback attributes cost inside the **real production analysis** without forking, copying, or patching it.

## Fixtures

Text fixtures are generated from real font outlines through the production `@laserx/fonts` engine, so glyph counters become genuine interior holes. The `*-point-count` fixtures use deterministic lobed contours to isolate point-count scaling from text structure. All fixtures are byte-stable: fixed timestamps, fixed IDs, no randomness.

## Scope

`packages/physical-preview-3d` and `packages/physical-preview-three` do not exist until G2/G3, so the scene-assembly and Three-conversion steps in `src/pipeline.ts` are local to this harness and written to match the accepted Issue #34 contract at head `9a4a90c6fa891ed0d9baf9bc8c99d41b04d54136`. They are not production code and are not promoted by G1. Region topology comes from the production `@laserx/cutability` analysis, which is what the G1 decision actually rests on.
