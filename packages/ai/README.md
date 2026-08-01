# @laserx/ai

Provider-neutral prompt/reference-image contracts and the OpenAI Responses API
adapter for M10.

The package owns request bounds, strict structured-output parsing, usage
metadata, cancellation, and recoverable provider error classification. It does
not own credential persistence, Electron IPC, project mutation, raster
decoding/tracing, or cutability. Those boundaries ensure provider output cannot
bypass M07 normalization, M08 analysis, wording review, or explicit user
acceptance.

The adapter sends `store: false`, never serializes the credential into the
request body, and accepts an injected fetch implementation for deterministic
tests. See `docs/AI_PIPELINE.md` for privacy and real-provider validation.
