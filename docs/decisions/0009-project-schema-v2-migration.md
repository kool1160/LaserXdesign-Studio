# ADR 0009: Project Schema V2 Migration

## Status

Accepted.

## Decision

Make schema version 2 the write format for `.laserx` projects. It replaces the
schema-v1 empty document with:

- a stable document ID;
- canonical width and height in millimeters;
- fixed Cartesian origin;
- display unit;
- ruler, grid, grid-spacing, and snapping preferences;
- an ordered array of line, rectangle, ellipse, and path placeholder objects.

The parser remains strict and rejects unknown, corrupt, or future-version data.
Serialization remains deterministic formatted JSON with a trailing newline.

Schema-v1 files migrate on read. Migration preserves project metadata,
dimensions, display unit, and prior migration history; uses the project ID as
the new document ID; supplies reviewed default viewport preferences; and creates
an empty object array. The migration timestamp uses the v1 `updatedAt` value,
making repeated migration deterministic without a clock or random ID.

Recovery keeps its schema-v1 envelope but parses and migrates the embedded
project with the same project-format boundary. Explicit save after opening or
recovering writes schema v2.

## Rationale

The existing schema must remain openable while M02 begins persisting real
document state. Deterministic identity and timestamps make migration fixtures
stable and prevent opening a file from changing its serialized result
arbitrarily.

## Alternatives

- Mutating schema v1 in place was rejected because existing files would become
  ambiguous.
- Generating a random document ID during migration was rejected because the
  same source would produce different projects.
- Saving migrated projects automatically on open was rejected because opening a
  file must not modify it without an explicit save.
- Adding M03 layers, transforms, and selection data was rejected as out of
  scope.

## Consequences

All new saves use schema v2. `blank-v1.laserx` and
`migrated-v1-to-v2.laserx` are the reviewed migration pair;
`populated-v2.laserx` proves the current object and preference shape. Future
schema changes require another explicit registry entry and fixtures.
