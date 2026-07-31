# Raster fixtures

`m07-raster-trace-goldens.json` is the reviewed, deterministic M07 fixture set.
It describes clean-logo, noisy-photo, anti-aliased-text, and high-resolution
raster pixels without committing branded or proprietary artwork. Tests
materialize the pixels, run the pinned trace adapter, and compare exact
millimeter paths, node counts, and speckle-removal evidence.

The packaged Windows test materializes the clean-logo descriptor as a real PNG
in its isolated temporary directory. PNG/JPEG decoding itself remains owned by
Electron main; no source path or pixel buffer crosses renderer IPC.
