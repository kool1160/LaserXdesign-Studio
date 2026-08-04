# `@laserx/physical-preview-three`

Pure, deterministic Three.js adapter over the accepted
`@laserx/physical-preview-3d` scene contract. Created in M14 gate G3.

## Boundary

Allowed **runtime** dependencies — exactly two, and this list is exhaustive:

- `three`;
- `@laserx/physical-preview-3d`.

Forbidden:

- React and React Three Fiber;
- `@react-three/drei` — ADR 0024 §3 rejects it. `three` already ships
  `OrbitControls`, and G4 wires that directly;
- Electron;
- `@laserx/production-export` and any material catalog — both would drag
  `node:crypto` or unaccepted M16 identity into the lazily loaded renderer chunk;
- DOM orchestration, filesystem access, and privileged capture.

Enforced mechanically by `pnpm audit:physical-preview` across `dependencies`,
`devDependencies`, `peerDependencies`, and `optionalDependencies`, with negative
probes proving each rejection.

Every module is unit-testable in Node **without a WebGL context**, which is why
this is a package rather than code inside `apps/desktop`.

## Responsibilities

- convert outer/hole contours to `Shape`/`Shape.holes` and exact-thickness
  `ExtrudeGeometry`;
- carry authoritative assembled/exploded Z placement verbatim;
- provide deterministic front/back/edge/perspective poses and camera fit;
- map current schema materials to presentation-only appearances, with a neutral
  fallback for anything unrecognised;
- validate captured PNG bytes and build deterministic filenames;
- own and dispose every geometry and material it allocates.

## Non-responsibilities

- drawing, rendering loops, or owning a WebGL context;
- React components, Canvas composition, or orbit-control UI;
- writing files, downloading, or any privileged capture (ADR 0024 §6 — that is
  G5, behind typed Electron IPC);
- inventing, repairing, closing, simplifying, unioning, or reinterpreting
  geometry. A layer the scene package failed closed on carries zero shapes and
  therefore produces zero geometry here.

## Rendered precision — read before trusting a measurement

Three stores vertex positions in a `Float32Array`, so **canonical millimetres
cannot be represented exactly in rendered geometry**. Gauge thickness
`1.51892 mm` reads back from the buffer as `1.5189199447631836 mm` — an error of
about `5.5e-8 mm`, larger than domain's `COORDINATE_TOLERANCE_MM` (`1e-9`) and
smaller than `GEOMETRY_ENGINE_TOLERANCE_MM` (`1e-6`).

This is a property of the renderer, not of LaserX geometry. The exact value stays
exact on `PhysicalPreviewLayer.thicknessMm`, in dimension readouts, and in every
manufacturing export. `RENDERED_MM_TOLERANCE` pins the bound, and the test suite
asserts both facts separately: the authoritative depth is passed through with
exact equality, and the rendered buffer matches within float32 precision.

**Never treat a value read back out of a geometry buffer as manufacturing
evidence.**

## Dependency provenance

| Package | Version | License |
|---|---|---|
| `three` | 0.185.1 | MIT |
| `@types/three` (dev) | 0.185.3 | MIT |

`pnpm audit --prod`: no known vulnerabilities.

## Governing documents

- ADR 0024 — production physical 3D preview boundary;
- `docs/experiments/m14-physical-3d-preview/G1_SCALING_EVIDENCE.md` — why
  `curveSegments: 1` is used for already-flattened contours.
