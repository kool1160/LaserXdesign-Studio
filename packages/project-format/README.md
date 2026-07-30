# @laserx/project-format

M03 writes strict deterministic JSON schema version 3 for canonical documents,
ordered layers/guides, recursive groups, stable IDs, affine transforms, locks,
visibility, z-order, and viewport/snapping preferences.

The package opens schema-v1 and schema-v2 files through explicit deterministic
migrations. It owns validation, serialization, safe error classification, and
the migration registry, with no filesystem access.

See ADRs 0009 and 0011 plus the reviewed fixtures under `fixtures/projects/`.
