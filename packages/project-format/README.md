# @laserx/project-format

M01 implements strict deterministic JSON schema version 1 for an explicitly
empty `.laserx` project. The package owns validation, serialization, safe error
classification, and the migration registry. It contains no filesystem access.

See `docs/decisions/0007-project-v1-and-recovery.md` and
`fixtures/projects/blank-v1.laserx`.
