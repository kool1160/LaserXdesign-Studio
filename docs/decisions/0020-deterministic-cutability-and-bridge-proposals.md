# ADR 0020: Deterministic Cutability and Bridge Proposals

## Status

Accepted.

## Decision

M08 stores editable manufacturing inputs in project schema v6. The persisted
record contains process, material, thickness, kerf, minimum feature, minimum
bridge, minimum gap, contour spacing, optional heat-distortion spacing,
tolerance preset, source preset ID, and the fields changed by the user. The
four bundled presets are transparent starting points, not authoritative
machine tables. Schema-v5 projects migrate deterministically by adding the
document defaults and retaining the source `updatedAt` in migration history.

`packages/cutability` owns a pure deterministic analysis over visible geometry
normalized to world millimeters. Curves and ellipses flatten at 0.01 mm, and a
run is limited to 50,000 flattened segments. Stock outside every valid closed
contour is explicitly assumed retained; each containment depth toggles removed
and retained material. Any open, degenerate, self-intersecting, or mutually
intersecting contour makes every preview region ambiguous rather than emitting
a false definitive material classification.

The engine reports the twelve codes in `docs/CUTABILITY_RULES.md`. Every issue
contains severity, stable affected object/segment references, a world-mm
location, finite measured evidence, the configured limit, an explanation, and
a suggested action. The kerf, width, gap, and spacing checks are conservative
geometric approximations. Every result keeps `cutReady: false` and includes the
manufacturing-guidance disclaimer.

Electron main snapshots the authoritative document and runs analysis in a
dedicated worker. Renderer IPC carries only an operation ID and selected object
IDs; it cannot submit project geometry or analysis results. Cancellation
terminates the worker. Progress and completed results publish only for the
active operation, and an analysis-input fingerprint rejects late results after
any relevant change. That fingerprint contains manufacturing settings, layer
visibility/lock state, and visible objects; display units, viewport
preferences, guides, and layer names are deliberately excluded. The one-entry
cache keys the exact input fingerprint and normalized analysis scope.
Geometry/import/text/manufacturing commands invalidate analysis;
selection-only navigation and display preferences do not.

Manual bridge requests select a cardinal direction. Automatic bridge requests
evaluate the same four cardinal candidates and deterministically choose the
shortest collision-free candidate. Width must meet the current minimum bridge
setting. A proposal contains ordinary world-mm preview geometry but cannot
mutate the project. Acceptance revalidates the analysis-input fingerprint,
materializes ordinary closed `PathObject` replacements through the existing
Clipper2 geometry boundary, and records exactly one undoable topology command.
Rejection has no project or history effect.

The M08 bridge baseline is intentionally limited to a disconnected island and
its containing top-level editable path on the same unlocked layer. It does not
repair grouped, text, cross-layer, or arbitrary non-cardinal geometry. Those
cases retain issues and guidance without pretending to provide a safe repair.

## Rationale

Persisting settings makes an analysis reproducible after save/reopen and makes
every warning auditable against the values the user actually selected. A pure
world-mm engine avoids renderer and display-scale drift. Conservative
ambiguity protects users from a polished but incorrect retained-metal preview.

Candidate-only repairs preserve user control and reuse the established command
and history model. Worker termination, exact input fingerprinting, and an exact cache
key keep heavy analysis responsive without allowing stale manufacturing
conclusions to enter current state.

## Alternatives

- Character-name rules were rejected because imported, traced, outlined, and
  edited geometry has no reliable semantic letter identity.
- Renderer-side analysis was rejected because it would duplicate authoritative
  geometry across the IPC boundary and risk UI stalls.
- Persisting analysis results was rejected because they are derived data that
  becomes stale after geometry or setting changes.
- Automatically applying bridges was rejected because repair placement affects
  appearance and must remain an explicit preview/accept decision.
- Machine-vendor process tables were rejected because M08 does not certify
  machine safety, material quality, or manufacturability.

## Consequences

Schema v6 is the first native format that persists manufacturing settings.
Older projects receive documented editable defaults and write v6 only on an
explicit save. Analysis is bounded, deterministic, cancellable, and testable
without Electron. The preview communicates topology and configured-risk
evidence, but it is not CAM, simulation, cut ordering, or a cut-ready guarantee.
