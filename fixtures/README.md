# Fixtures

Reviewed, non-proprietary inputs and golden outputs used to prove scale, topology, tracing, cutability, migrations, and export behavior. Every fixture subdirectory explains provenance and expected behavior.

M02 project fixtures:

- `projects/blank-v1.laserx` — valid M01 source project;
- `projects/migrated-v1-to-v2.laserx` — deterministic reviewed migration result;
- `projects/populated-v2.laserx` — exact 24 in × 12 in schema-v2 document with
  viewport preferences and all four placeholder object types;
- `projects/corrupt-v1.laserx` and `projects/future-v99.laserx` — safe rejection
  cases.

M03 project fixtures:

- `projects/editing-v3.laserx` — reviewed schema-v3 project with layers,
  visibility/locking, guide, affine transforms, recursive group, stable IDs,
  and deterministic order;
- `projects/migrated-v2-to-v3.laserx` — deterministic reviewed migration of
  `projects/populated-v2.laserx`, retaining the schema-v2 source for
  compatibility coverage.

M12 production fixtures:

- `production/m12-package-goldens.json` — reviewed two- and three-layer
  filenames, physical roles, shared millimeter origin/stock, and numerically
  identical explicitly designated registration holes.
