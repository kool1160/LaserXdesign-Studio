# Raster trace engine license review

`laserx-grid-trace` 1.0.0 is original LaserX source in this repository. It
contains no third-party tracing implementation, model, fixture artwork, or
runtime dependency. The package depends only on other `@laserx/*` workspaces.

Electron `nativeImage` is part of the already-pinned desktop runtime and is
used only to normalize PNG/JPEG decode in the privileged main process. It is
not copied into this package and is not the tracing engine.

ADR 0019 records the reviewed engine, boundary, alternatives, and consequences.
