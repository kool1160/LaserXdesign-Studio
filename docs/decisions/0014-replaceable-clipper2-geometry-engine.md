# ADR 0014: Replaceable Clipper2 Geometry Engine

## Status

Accepted.

## Decision

Use `clipper2-ts` version `2.0.1-18` as M05's single polygon boolean and
offset engine behind the `GeometryEngine` interface in `packages/geometry`.
The adapter exposes union, subtract, intersection, XOR, and signed polygon
offsets without exposing Clipper types to the domain, application, worker, or
renderer. Millimeter coordinates are quantized centrally to integer
micrometers (`1,000,000` engine units per millimeter), checked against the
JavaScript safe-integer range, and normalized deterministically on return.

Curve flattening, node editing, simplification, cleanup, and
self-intersection reporting remain LaserX-owned pure geometry. Clipper2 owns
only closed-polygon topology and offsets. Expensive operations run in a
dedicated Electron `worker_threads` entry point. The main-process coordinator
captures a document fingerprint, terminates the worker on cancellation, and
commits one undoable replacement only if the source document is unchanged.

Application preparation passes contours to the adapter in selection order.
Subtract treats the first selected contour as its subject and every later
contour as a clip. Boolean and multi-path offset operands must share one
editable layer; invalid cross-layer requests fail before worker execution and
leave every source object and history entry unchanged.

The dependency is pinned and audited by `pnpm audit:geometry`. The reviewed
Boost Software License 1.0 text is retained under
`packages/geometry/licenses`. The upstream source package also contains
third-party benchmark data notices; benchmark sources are not part of the
published runtime package or LaserX bundle.

## Rationale

Clipper2 implements all reliable M05 boolean variants and polygon offsets in
one zero-runtime-dependency TypeScript package. Integer micrometer inputs make
the tolerance boundary explicit and reproducible, while the LaserX adapter
keeps a later WASM, native, or alternative TypeScript engine replaceable
without UI or document changes.

## Alternatives

- A handwritten clipping engine was rejected because touching and
  near-tolerance topology would require substantially more validation.
- Combining one clipping library with a different offset library was rejected
  because it would create two tolerance and winding contracts.
- A WASM/native engine was deferred until the recorded performance baseline
  demonstrates a bottleneck that justifies packaging and security complexity.
- Clipper2 triangulation is not used; it is outside M05 and upstream currently
  warns that the triangulation implementation is not reliable.

## Consequences

Closed topology is quantized to one micrometer and coordinates above the
documented safe range are rejected. Holes remain separate, oppositely wound
contours and are never silently discarded. Cancellation and stale-result
checks leave the authoritative document byte-identical. Replacing the engine
requires adapter conformance against the same golden fixtures, license audit,
and performance baseline rather than renderer changes.
