# ADR 0007: Project Schema V1, Atomic Saves, and Recovery

## Status

Accepted.

## Decision

Use strict, deterministic, UTF-8 JSON for `.laserx` schema version 1. M01
stores only:

- schema version;
- project UUID, name, created/updated timestamps;
- an explicitly empty document;
- display unit and blank-workspace width/height in millimeters;
- migration history.

The migration registry is explicit and empty for version 1. Corrupt,
structurally invalid, and future-version files fail with distinct safe error
messages.

Explicit saves serialize validated data and atomically replace the chosen
`.laserx` file through a same-directory temporary file. Autosave writes a
validated recovery envelope under Electron's per-user application-data
directory. It never writes to or replaces the explicit project path.
Successful save/open removes stale recovery. A recovered session remains dirty
until explicitly saved.

Recent projects are capped at ten and persisted separately in per-user
application data.

## Rationale

Readable JSON is sufficient for an empty M01 document and makes schema
validation and migration behavior transparent. Atomic replacement avoids
partially written project files. Separate recovery storage preserves the last
explicit save and supports interrupted-session recovery.

## Alternatives

- ZIP/container packaging was deferred until embedded assets justify it.
- Writing autosave over the project was rejected because interruption could
  destroy the last explicit save.
- Defining M02 layers, objects, or geometry in schema v1 was rejected as
  premature scope.

## Consequences

Schema additions or changes require a migration and fixture. M01 limits project
files to 10 MB. Recovery is a single active local snapshot; multi-document
recovery management and retention policies are later hardening work.
