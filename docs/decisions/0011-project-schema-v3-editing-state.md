# ADR 0011: Project Schema V3 Editing State

## Status

Accepted.

## Decision

Make schema version 3 the current `.laserx` write format. It extends the
schema-v2 document with:

- ordered layers with stable IDs, names, visibility, and lock state;
- one active layer ID;
- ordered guides with stable IDs, axes, and millimeter positions;
- one affine transform and layer reference on every object;
- recursive group objects whose children retain stable IDs;
- grid, guide, object, and document snapping preferences.

Object array order remains z-order within layer order. Serialization remains
strict deterministic formatted UTF-8 JSON with a trailing newline. Validation
rejects unknown fields, invalid matrices or geometry, duplicate/invalid
structure, missing active layers, and dangling object-to-layer references.
Selection, clipboard, camera position, and history are not serialized.

Schema-v2 files migrate on read. The migration derives one deterministic
default-layer UUID from the stable document ID, assigns that layer and an
identity transform to every object, creates no guides, and supplies the new
snapping defaults. It records a v2-to-v3 migration using the source
`updatedAt`. Schema-v1 files continue through the existing v1-to-v2 migration
and then v2-to-v3. Opening never rewrites the source; explicit save writes
schema v3.

The reviewed golden files are:

- `fixtures/projects/editing-v3.laserx`;
- `fixtures/projects/migrated-v2-to-v3.laserx`;
- the retained schema-v1 and schema-v2 sources.

## Rationale

Layers, transforms, groups, guides, and order are saved design intent required
for M03 reopen fidelity. A deterministic derived layer ID avoids random or
clock-dependent migrations. Chained registry entries preserve compatibility
without making the parser guess which historical shape it received.

## Alternatives

- Mutating schema v2 in place was rejected because old and new object shapes
  would be ambiguous.
- Generating a random migration layer ID was rejected because identical source
  files would migrate differently.
- Persisting selection and undo history was rejected because those are
  application-session concerns.
- Flattening groups during save was rejected because it would discard editable
  hierarchy and transform intent.
- Automatically rewriting a migrated file on open was rejected because open
  must remain non-destructive.

## Consequences

All new saves use schema v3. The parser must keep both migrations and their
fixtures green. Future persistent fields require another explicit schema
version, migration entry, and reviewed fixture rather than silently widening
schema v3.
