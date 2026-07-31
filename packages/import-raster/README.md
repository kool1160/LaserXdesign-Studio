# @laserx/import-raster

Safe raster metadata inspection, deterministic preprocessing, and replaceable
vector tracing. The package owns no filesystem paths, Electron APIs, renderer
state, or document mutation.

M07 pins the original LaserX `laserx-grid-trace` 1.0.0 adapter. Inputs are
decoded to bounded RGBA by an injected privileged desktop codec, transferred to
a worker, and processed with explicit crop, quarter-turn rotation, grayscale,
contrast, threshold, invert, blur, denoise, background, speckle, smoothing, and
simplification settings.

The result contains normalized millimeter paths, warnings, assumptions,
node/path/smallest-feature summaries, exact speckle-removal evidence, and
bounded original/black-white/edge preview pixels. The adapter never claims
that a trace is cut-ready.
