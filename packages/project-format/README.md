# @laserx/project-format

M02 writes strict deterministic JSON schema version 2 for canonical documents,
viewport preferences, stable IDs, and minimal placeholder objects. It opens
schema-v1 files through a deterministic reviewed migration. The package owns
validation, serialization, safe error classification, and the migration
registry. It contains no filesystem access.

See `docs/decisions/0009-project-schema-v2-migration.md` and the reviewed
fixtures under `fixtures/projects/`.
