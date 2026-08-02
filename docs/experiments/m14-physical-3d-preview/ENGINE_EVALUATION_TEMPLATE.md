# Physical Preview Engine Evaluation Template

Complete this document as `ENGINE_DECISION.md` before committing major rendering or CAD-kernel dependencies.

## Current LaserX source contracts

Document the exact current files, types, and functions that provide:

- validated project loading and migration;
- physical manufacturing-layer designation and order;
- material identity and appearance metadata;
- canonical `thicknessMm`;
- stock designation presentation data;
- authoritative transformed contours;
- cutout/hole topology;
- non-cut preview/reference exclusion;
- cutability findings;
- deterministic production-package evidence.

Identify any missing contract. Do not invent data to compensate.

## Candidate scorecard

Score each candidate from 1 (poor) to 5 (strong), with source-backed notes and a measured prototype where practical.

| Criterion | Three.js + R3F | RepliCAD + OCCT.js | CascadeStudio / cascade-core | JSCAD |
|---|---:|---:|---:|---:|
| License compatibility | | | | |
| Maintenance activity | | | | |
| Browser/Electron compatibility | | | | |
| React integration | | | | |
| Bundle/WASM size | | | | |
| Cold startup | | | | |
| Worker support | | | | |
| Exact planar extrusion | | | | |
| Nested contours and holes | | | | |
| Invalid-geometry failure behavior | | | | |
| Deterministic repeated output | | | | |
| Material rendering | | | | |
| Interaction and view controls | | | | |
| Screenshot capture | | | | |
| High-DPI support | | | | |
| GPU fallback strategy | | | | |
| Testability | | | | |
| Installer impact | | | | |
| Integration complexity | | | | |
| Value inside approved M14 scope | | | | |

## Required benchmark fixtures

Use the same authoritative LaserX-derived fixtures for every candidate that reaches benchmark stage:

1. one closed single-layer face without holes;
2. one face with multiple through-holes and nested cutouts;
3. one layered face/backing assembly with different materials and thicknesses;
4. one transformed/grouped design;
5. one intentionally open contour;
6. one self-intersecting or ambiguous contour;
7. one high-complexity representative sign.

## Measurements

Record:

- dependency and bundled output size;
- WASM size where applicable;
- cold and warm initialization time;
- conversion time per fixture;
- peak or representative memory use where practical;
- interaction performance;
- deterministic output comparison;
- unsupported/failure behavior;
- implementation effort and new maintenance surface.

## Decision rules

Choose Three.js + React Three Fiber for the rendering layer unless another option demonstrates a specific approved M14 requirement that it cannot satisfy truthfully.

Do not choose a CAD kernel solely for future STEP/STL/solid-editing possibilities because those are outside M14.

A CAD kernel may be recommended only when all are true:

1. a current M14 preview requirement is blocked without it;
2. the blocked case is reproduced with authoritative LaserX fixtures;
3. the candidate resolves the case deterministically and fails safely;
4. bundle, startup, worker, licensing, and installer costs are acceptable;
5. the kernel remains behind the pure preview adapter and does not become authoritative project geometry.

## Final decision

State:

- selected renderer;
- selected helper libraries;
- whether a CAD kernel is rejected, deferred, or narrowly adopted;
- exact dependency versions and licenses;
- architecture diagram;
- known unsupported geometry;
- performance budget proposal;
- first implementation slice;
- conditions that would force reconsideration.
