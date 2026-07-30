# AI Prompt and Image Pipeline

## Goal

Turn a prompt and optional reference image into candidate sign artwork that becomes editable, normalized geometry inside the standard editor.

## Pipeline

1. Collect prompt, wording, dimensions, process preset, style, layers, and constraints.
2. Produce multiple concept previews or structured vector candidates.
3. Let the user choose a candidate.
4. Remove/normalize background as needed.
5. Trace or parse into paths.
6. Simplify using explicit tolerance.
7. Separate obvious semantic groups when confidence is sufficient.
8. Run geometry normalization.
9. Run cutability analysis.
10. Preview warnings and proposed repairs.
11. Insert accepted objects through an application command.

## Provider boundary

Provider-specific code lives only in `packages/ai`. The rest of the application uses provider-neutral requests and results.

## Failure behavior

Network/provider failure must not damage the project. Partial results are temporary until the user accepts them. Generated content never bypasses validation or directly writes DXF.

## Intellectual-property behavior

Do not ship copied trademark assets. Prefer general design-language prompts such as vintage motorcycle badge, shield emblem, winged garage sign, or racing-inspired crest rather than exact brand reproduction.
