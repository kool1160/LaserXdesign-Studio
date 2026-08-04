# `@laserx/physical-preview-3d`

Pure deterministic adapter from a validated LaserX project snapshot to a renderer-independent physical-preview scene description.

## Boundary

Allowed **runtime** dependencies — exactly three, and this list is exhaustive:

- `@laserx/domain`;
- `@laserx/geometry`;
- `@laserx/cutability`.

`@laserx/project-format` is **test/tool-only**: it may be used to parse fixtures
in this package's own tests, and must never become a runtime dependency.

Forbidden dependencies:

- React;
- Electron;
- Three.js;
- any material catalog;
- `@laserx/production-export` — it imports `node:crypto`, which is not safe to
  pull into the lazily loaded Electron **renderer** chunk this package ships in.
  The physical-layer predicate is therefore deliberately *replicated* here
  (`isPhysicalManufacturingLayer`) rather than imported. The two definitions are
  currently kept in agreement by review only; a cross-check test would need to
  import `production-export` into this suite, so if that risk is to be closed it
  belongs in an external test rather than here;
- browser globals;
- filesystem APIs;
- GPU APIs.

This boundary is enforced mechanically by `pnpm audit:physical-preview`, not by
this document — the audit rejects each forbidden package across `dependencies`,
`devDependencies`, `peerDependencies`, and `optionalDependencies`.

## Responsibilities

- identify explicit physical manufacturing layers;
- carry exact canonical material thickness in millimeters;
- carry material and stock-designation presentation metadata;
- preserve authoritative world transforms, dimensions, layer order, outer contours, and interior cutouts;
- derive assembled and exploded Z placement from explicit preview settings;
- return source-linked findings for unsupported or ambiguous geometry;
- produce deterministic serializable scene output and fingerprints;
- prove source-project immutability.

## Non-responsibilities

- drawing or GPU rendering;
- modifying the LaserX document;
- repairing or closing contours;
- manufacturing exports;
- cutability approval;
- project persistence;
- general solid modeling;
- CAD-kernel or mesh editing;
- CAM or machine control.

## Fail-closed contract

`analyzeDocumentCutability` maintains a single ambiguity flag, raised by open
contours, unsupported geometry, duplicate segments, overlapping segments,
self-intersections, and intersections between separate contours. When it is set,
`classifyRegions` marks **every** region `"ambiguous"` and no region may be
trusted as solid or hole.

This package therefore builds **zero shapes** from a non-`complete` analysis. The
layer is still returned with its declared name, role, material, and exact
`thicknessMm`, and the assembly reports `status: "partial"` with
`depthStatus: "declared-incomplete"` — so a failure is visible and attributed
rather than silently vanishing, and declared depth is never presented as
verified. No geometry is ever invented, closed, simplified, or guessed.

Each ambiguity class has its own regression test in `tests/failClosed.test.ts`.

## Analysis path

This package uses the **full** `analyzeDocumentCutability` path. M14 G1 measured
that roughly 36–45% of that cost is the manufacturing-advisory spacing phase,
which the preview never reads, and recommended a narrower
preview/region-classification entry point in `@laserx/cutability`.

That optimization is **deferred, not rejected.** It changes a package's public
API and requires its own ADR plus proof that it reuses `classifyRegions` rather
than copying it and preserves every ambiguity-producing check. Adding it was
explicitly optional for G2, and shipping the promotion on the already-proven
path keeps this slice's risk in one place. See
`../../docs/experiments/m14-physical-3d-preview/G1_SCALING_EVIDENCE.md`.

## Governing documents

- ADR 0024 — production physical 3D preview boundary;
- `docs/milestones/M14-production-physical-3d-preview.md`;
- `docs/experiments/m14-physical-3d-preview/` — the accepted Issue #34 research
  and the G1 scaling evidence. Research records only; never product
  documentation, and never shipped.
