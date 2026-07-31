# M05 Geometry Performance Baseline

Recorded on 2026-07-31 for the replaceable `laserx-geometry-engine-v1`
adapter backed by `clipper2-ts` 2.0.1-18.

## Method

The reproducible Vitest workload performs one warm-up and seven measured runs
for each case. It reports the median and maximum elapsed wall-clock time and
retains a deliberately generous 5,000 ms maximum guard against gross
regressions on slower CI hosts.

Run it from the repository root:

```powershell
pnpm --filter @laserx/geometry exec vitest run tests/performance-baseline.test.ts --reporter=verbose
```

## Workloads and result

| Workload | Input size | Median | Maximum |
| --- | ---: | ---: | ---: |
| Boolean union | 400 overlapping rectangles / 1,600 nodes | 1.62 ms | 4.48 ms |
| Round outward offset | 1 closed contour / 4,096 nodes | 22.32 ms | 32.01 ms |

The run completed on 64-bit Windows 11 10.0.26220, a 12th Gen Intel Core
i7-12700H (14 cores / 20 logical processors), Node.js 24.18.0, and pnpm
11.18.0. Timings are a baseline, not a cross-machine user-interface latency
guarantee. Production boolean and offset requests remain off the renderer
thread and are cancellable regardless of their measured duration.
