# @laserx/project-format

M04 writes strict deterministic JSON schema version 4 for canonical documents,
including editable text intent, font fingerprints, arc settings, materialized
contours, and optional source metadata on converted outline groups.

The package opens schema-v1, schema-v2, and schema-v3 files through explicit deterministic
migrations. It owns validation, serialization, safe error classification, and
the migration registry, with no filesystem access.

See ADRs 0009, 0011, and 0013 plus the reviewed fixtures under
`fixtures/projects/`.
