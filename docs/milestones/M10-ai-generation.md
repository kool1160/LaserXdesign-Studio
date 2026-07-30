# M10 — Prompt and Image-to-Sign AI Pipeline

## User-visible outcome

A user can describe a sign or provide a reference image, choose from concepts, and receive editable geometry that already respects basic size, wording, style, layer, and cutability constraints.

## Included

- provider-neutral AI request/result interfaces;
- secure credential configuration outside renderer/source control;
- prompt fields for wording, dimensions, style, process, detail level, bridges, holes, layers, and backing plate;
- reference-image attachment with explicit consent;
- multiple concept previews;
- structured-vector path when provider supports it;
- raster-to-trace fallback through M07;
- normalization and group/layer heuristics;
- mandatory M08 cutability analysis before acceptance;
- prompt/result provenance controls;
- retry, cancellation, rate-limit, and offline behavior;
- cost/usage transparency available before generation where provider data allows;
- safe failure preserving the open project.

## Explicitly excluded

Exact replication of protected logos, autonomous export without user review, hidden provider selection, sending the full project unnecessarily, and dependence on AI for normal editing.

## Acceptance tests

1. Prompt-generated result enters the editor as normal editable objects.
2. Wording is verified and presented for correction before final insertion.
3. Provider/network failure leaves the project unchanged and usable.
4. Generated geometry cannot bypass normalization or cutability analysis.
5. Secrets never appear in renderer bundles, logs, fixtures, or committed config.
6. User can discard a concept without project mutation.
7. General motorcycle-badge, farmhouse, industrial, and address-sign prompts produce usable candidate workflows without bundled trademark assets.

## Exit checklist

- [ ] Provider/security ADR accepted.
- [ ] Privacy and provenance behavior documented.
- [ ] Prompt-to-editable end-to-end test passes with mocked provider.
- [ ] Real-provider validation procedure documented separately from CI.
- [ ] Status advances to M11.
