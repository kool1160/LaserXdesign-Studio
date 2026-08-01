# @laserx/cutability

Pure deterministic manufacturing analysis over normalized world-millimeter
geometry. The package owns editable starting presets, all documented M08 issue
classes, retained/drop-out/ambiguous region classification, exact analysis
fingerprints and cache keys, manual/automatic bridge candidates, and ordinary
path materialization.

Analysis never mutates a document. Every issue carries measured evidence and a
configured limit, and every result explicitly keeps `cutReady: false`. Bridge
proposals retain the original until the application accepts one through its
normal command/history model. See `docs/CUTABILITY_RULES.md` and ADR 0020 for
assumptions, limits, and repair scope.
