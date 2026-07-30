# Native project fixtures

Store one reviewed fixture for every shipped `.laserx` schema version plus corrupt, future-version, recovery, and migration cases.

M01 fixtures:

- `blank-v1.laserx` — canonical valid empty project;
- `corrupt-v1.laserx` — truncated project input;
- `future-v99.laserx` — unsupported future schema sentinel;
- `recovery-v1.json` — recovery envelope that retains the original path.
