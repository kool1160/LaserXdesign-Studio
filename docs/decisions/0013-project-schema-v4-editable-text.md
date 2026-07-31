# ADR 0013: Project Schema V4 Editable Text

## Status

Accepted.

## Decision

Make schema version 4 the current `.laserx` write format. It extends schema v3
with editable text objects containing:

- content, origin, affine transform, and layer identity;
- font ID, family, style, SHA-256 fingerprint, and millimeter size;
- tracking, word spacing, line spacing, and alignment;
- optional circular arc parameters;
- materialized closed/open millimeter contours;
- a missing-font status flag.

Groups may optionally retain an editable text source record after conversion to
ordinary path children. Unknown fields, empty content, invalid font
fingerprints, invalid spacing/arc values, empty contours, and existing
ID/layer/matrix violations are rejected.

Schema v3 migrates deterministically by changing only the schema version and
appending a v3-to-v4 migration record using the source `updatedAt`. Existing
geometry does not need rewriting. Schema v1 and v2 continue through the full
registry chain. Opening remains non-destructive; explicit save writes v4.

## Rationale

Editable text, arc intent, font identity, and portable materialized geometry
are persistent design intent. Widening schema v3 in place would make old
readers and validators ambiguous.

## Alternatives

- Leaving text renderer-only was rejected because it would not survive reopen.
- Saving outlines only was rejected because it would discard editability.
- Embedding font binaries was rejected because it adds licensing, size, and
  security concerns not required for deterministic reopen.

## Consequences

All new saves use schema v4. The explicit v3 migration and reviewed v4 fixtures
must stay green. Font substitution and text-to-outline conversion are regular
undoable editor commands.
