# ADR 0019: Secure Replaceable Raster Tracing

## Status

Accepted.

## Decision

Use the LaserX-owned `laserx-grid-trace` engine version `1.0.0` as M07's
single raster-to-vector adapter in `packages/import-raster`. The engine uses
deterministic preprocessing, four-connected foreground filtering, oriented
pixel-boundary contours, optional Chaikin smoothing, and the existing
world-millimeter simplification contract. It is behind the `RasterTraceEngine`
interface and exposes no engine-specific records to application, document,
worker, IPC, or React code.

No third-party trace implementation or training data is included. The engine
is original LaserX source governed by the repository's own licensing terms, so
there is no additional runtime license text or reciprocal-license obligation.
`pnpm audit:raster` verifies that the adapter has only LaserX workspace
dependencies, that the engine ID/version remain pinned, and that this license
record is present. Electron's already-pinned `nativeImage` runtime decodes PNG
and JPEG in main process; it is not the trace engine.

Raster sources are untrusted. Electron main owns native file dialogs, a 12 MiB
bounded binary read, format/header inspection, decoded-dimension verification,
and preview PNG encoding. The renderer submits only validated settings and a
fresh operation ID; it never submits or receives a local path or raw pixel
buffer. Source dimensions are checked before native decode. Decoded input is
limited to 10,000 pixels per axis, 20 million pixels, and 80 MiB RGBA.

Preprocessing and tracing run in a dedicated worker thread after decode. Trace
working resolution is bounded to 4 million pixels, boundary extraction to
800,000 edges, and accepted output to 200,000 editable nodes. The worker has a
30-second deadline, emits progress stages, and is terminated on cancellation.
The controller rejects a completed result if the document fingerprint changed.

Crop, quarter-turn rotation, luminance/average grayscale, contrast, threshold,
invert, box blur, median denoise, alpha-background selection, speckle area,
smoothing, and simplification settings are explicit and deterministic.
Speckle removal reports the selected pixel-area threshold, removed component
count, and removed pixel area. Simplification is accepted only when measured
source-to-result deviation stays within the selected millimeter tolerance.

Trace preview is application state plus bounded main-generated data URLs. It
does not mutate the document, dirty state, or history. Acceptance materializes
ordinary schema-v5 closed `PathObject` geometry on one new editable layer
through a single `objects.import` command. The source bitmap and preview data
are not persisted. Accepted IDs immediately enter the `packages/cutability`
analysis interface, which reports that manufacturing settings are required and
sets `cutReady: false`; M07 does not implement M08 manufacturing rules.

## Rationale

An in-repository engine gives M07 a deterministic, reviewable baseline without
introducing a native/WASM tracing dependency or a license incompatible with
desktop distribution. The interface, exact goldens, performance boundary, and
worker contract preserve a clean replacement path if later profiling proves a
better engine is necessary.

Pre-decode header limits prevent compressed pixel bombs from reaching native
decode unchecked. Worker termination and fingerprint checks preserve the same
no-stale-commit guarantee used for geometry operations. Persisting only normal
paths keeps `.laserx` independent from decoder, preview, and trace-engine
versions.

## Alternatives

- Potrace-family dependencies were not selected because an external engine was
  unnecessary for the approved baseline and would add packaging and license
  review surface.
- Renderer-side browser decoding/tracing was rejected because it would widen
  IPC with local file contents and move expensive untrusted work into the UI
  process.
- Persisting source bitmaps or engine records was rejected because M07 requires
  editable vector results and the current project container does not justify
  embedded binary assets.
- Native/WASM acceleration remains deferred until reviewed fixtures show the
  bounded TypeScript adapter misses the recorded targets.

## Consequences

Diagonal pixels are separate four-connected islands unless connected by an
edge. Pixel contours describe the thresholded raster rather than semantic logo
features. Smoothing can intentionally reshape the threshold boundary;
simplification separately honors its explicit deviation tolerance. Very noisy
or oversized candidates fail with a clear limit instead of returning partial
geometry. Traced results always require downstream manufacturing review and
never carry an automatic cut-ready claim.
