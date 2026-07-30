# Fixtures

Reviewed, non-proprietary inputs and golden outputs used to prove scale, topology, tracing, cutability, migrations, and export behavior. Every fixture subdirectory explains provenance and expected behavior.

M02 project fixtures:

- `projects/blank-v1.laserx` — valid M01 source project;
- `projects/migrated-v1-to-v2.laserx` — deterministic reviewed migration result;
- `projects/populated-v2.laserx` — exact 24 in × 12 in schema-v2 document with
  viewport preferences and all four placeholder object types;
- `projects/corrupt-v1.laserx` and `projects/future-v99.laserx` — safe rejection
  cases.
