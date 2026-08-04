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
- validate captured PNG **structure** and, given pixel evidence, **content**;
- build deterministic capture filenames;
- own and dispose every geometry and material it allocates.

## Non-responsibilities

- drawing, rendering loops, or owning a WebGL context;
- React components, Canvas composition, or orbit-control UI;
- writing files, downloading, or any privileged capture (ADR 0024 §6 — that is
  G5, behind typed Electron IPC);
- inventing, repairing, closing, simplifying, unioning, or reinterpreting
  geometry. A layer the scene package failed closed on carries zero shapes and
  therefore produces zero geometry here.

## Capture validation cannot detect a blank frame on its own

Encoded-header validation proves signature, `IHDR`, and non-zero dimensions. It
**cannot** prove anything was drawn: a WebGL canvas that cleared its drawing
buffer encodes to a perfectly valid PNG of the correct size.

`validatePngCapture()` therefore returns `status: "structure-only"` with
`ok: false` unless the caller supplies pixel evidence. Pass `content` — RGBA
bytes, dimensions, expected background, optional tolerance and minimum coverage
ratio — and `analyzePixelContent()` proves at least one meaningful
non-background pixel exists before the result becomes `status: "verified"`.

Only `"verified"` is a successful capture. G4 supplies the bytes from the real
renderer; this package never reads a canvas itself beyond `toDataURL`.

### The evidence is bound to the capture, not merely present

Supplying *some* non-background RGBA bytes is not enough: they must be bytes
*of this capture*. `validatePngCapture()` requires the content evidence's
`widthPx`/`heightPx` to exactly equal both the canvas's own `width`/`height` and
the encoded `IHDR` dimensions before it will report `"verified"`. Evidence of a
different size — even genuinely non-background evidence — is rejected.
`analyzePixelContent()` also requires the RGBA buffer length to equal exactly
`width * height * 4`, not merely be at least that size, and rejects non-finite
or out-of-range background/tolerance/ratio parameters rather than silently
misinterpreting them.

**What this package cannot enforce:** that the caller actually read the encoded
bytes and the RGBA evidence from the *same* capture transaction. Two same-sized
but unrelated reads would still pass dimension binding. **G4 must obtain both
from one frame, read back once** — this package can only prove the shapes are
consistent, not the provenance.

## Camera fit is solved, not estimated

`computeCameraFit()` takes the view, viewport, and optional FOV/padding, and
returns the **complete** descriptor it solved for — including `fovDeg`, `aspect`,
`position`, `near`, `far`, and the `boundsMm` it framed — so a consumer cannot
pair the distance with a different projection and clip the model.

It fits the visible layers' actual `boundsMm`, which may extend outside the stock
rectangle, and falls back to the stock only when nothing is visible. The box's
half-extent is projected onto the camera's right/up/forward axes, so a narrow
viewport pushes the camera back rather than cropping. The test suite builds a
real `PerspectiveCamera` from each descriptor and projects **every corner** of
the bounds into normalised device coordinates, across wide/narrow/square
viewports, both modes, all four views, single/multi-layer, geometry outside
stock, empty, and hidden-all states.

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
