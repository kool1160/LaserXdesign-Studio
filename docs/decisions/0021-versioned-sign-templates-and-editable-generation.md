# ADR 0021: Versioned Sign Templates and Editable Generation

## Status

Accepted.

## Decision

M09 introduces `packages/sign-tools` as a deterministic, renderer-independent
generation boundary. It accepts bounded parameter requests plus the
authoritative document selection and emits candidate layers and ordinary
domain objects. Rectangle, ellipse, path, and text objects remain the only
persistent geometry; there is no locked template-object type.

Exact lengths, offsets, hole diameters, hole centers, tab/slot dimensions, text
sizes, and arc radii are canonical millimeters. Borders normalize selected
closed geometry and use the existing Clipper2 union/offset boundary. Baseline
and arc helpers produce requests for the existing font engine. Electron main
materializes text outlines from the audited font catalog, so renderer requests
contain parameters but cannot submit contours, IDs, or font paths.

The application session owns the candidate, fresh IDs, and an exact project
fingerprint. Preview is non-mutating and noninteractive. Acceptance rejects a
stale fingerprint and dispatches one `objects.import` command for every
candidate layer and object. The controller then runs the accepted object IDs
through the standard M08 cutability worker. Rejecting a candidate changes no
project or history state.

Project schema v7 adds `document.templates`. A saved template is a strict,
version-1 parameter record with a stable UUID, user name, template kind, style
preset ID, outer shape, exact dimensions, border and mounting-hole settings,
font/text settings, and optional arc radius. Saved templates do not embed
generated geometry or derived analysis. Schema-v6 projects migrate
deterministically by adding an empty template library and recording the source
`updatedAt`; older migrations chain through v6 before v7.

Bundled presets reference only LaserX-authored algorithmic primitives and fonts
already covered by the M04 font catalog. `packages/sign-tools/sign-assets.json`
is the audited provenance manifest. `pnpm audit:templates` verifies unique
records, runtime/manifest correspondence, font-catalog license identity, and
repository license files.

## Rationale

Parameter templates remain small, stable, and migratable while regeneration
continues to benefit from later generator fixes. Ordinary output preserves all
existing editing, export, undo, and cutability behavior. Keeping generation
and font outlining out of React and behind strict IPC maintains the established
authority boundary.

## Alternatives

- Persisting a custom locked template object was rejected because it would
  require parallel edit, export, and cutability semantics.
- Saving generated geometry inside each template was rejected because it would
  duplicate project data and freeze generator defects into reusable records.
- Renderer-side geometry or text outline generation was rejected because the
  renderer is not authoritative and must not supply trusted geometry.
- Downloaded logo/style libraries were rejected because a marketplace and
  copyrighted-logo catalog are outside M09.

## Consequences

Template schema changes require an explicit `templateVersion` migration. A
style preset selects its audited font and shape; user text and exact dimensions
remain editable parameters. Multi-layer results must be reviewed per intended
material stack, and cutability output remains advisory with `cutReady: false`.
M09 adds no nesting, full mechanical joints, CAM, G-code, DWG, machine control,
or AI generation.
