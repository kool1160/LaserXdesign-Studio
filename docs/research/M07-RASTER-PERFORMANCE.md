# M07 Raster Performance and Safeguard Baseline

## Targets

- A representative 512 x 512 noisy-logo candidate must trace in under 5
  seconds on the test host.
- A reviewed 2560 x 1800 high-resolution logo fixture must cross the trace
  downsample boundary, complete inside the 30-second whole-operation deadline,
  and match its exact geometry/node golden.
- Source files are limited to 12 MiB, 10,000 pixels per axis, 20 million
  decoded pixels, and 80 MiB decoded RGBA.
- Trace work is downsampled deterministically when needed to at most 4 million
  pixels; preview images are at most 800 pixels on their longest axis.
- Boundary extraction fails above 800,000 edges and materialization fails above
  200,000 editable nodes.
- Cancellation terminates the worker. The controller reserves before the file
  chooser and applies one post-selection 30-second deadline across read,
  inspection, decode, worker execution, preview encoding, and publication.
  It rejects stale results and never commits a partial candidate.

## Recorded baseline

The unit performance case uses a 512 x 512 filled logo plus deterministic
isolated noise and prints its measured duration on every run. The exact
high-resolution golden uses a 2560 x 1800 source with 4,608,000 pixels and
therefore exercises deterministic downsampling to 2385 x 1677. Both execute
the same production adapter. GitHub's Windows M07 workflow and the packaged
Electron PNG/JPEG tests provide the delivery-host evidence.

The 2026-07-31 local verification completed the representative 512 x 512 case
in 117.909 ms, below the 5-second gross target. This is a single-host safety
baseline, not a cross-machine throughput guarantee; CI continues to enforce
the target on every M07 change.

These limits are safety and responsiveness boundaries, not manufacturing
tolerances. The selected simplification tolerance is reported separately in
millimeters and verified geometrically.
