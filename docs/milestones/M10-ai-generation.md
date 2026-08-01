# M10 — Prompt and Image-to-Sign AI Pipeline

## User-visible outcome

A user can describe a sign or provide a reference image, choose from concepts, and receive editable geometry that already respects basic size, wording, style, layer, and cutability constraints.

## Launch connection model

M10 launches with OpenAI as the first supported provider through a provider-neutral
adapter. The user supplies their own OpenAI API access and is billed directly by
OpenAI:

1. LaserX opens the official OpenAI Platform setup or billing page.
2. The user signs in or creates an API account and enables billing or prepaid
   credit.
3. The user creates a dedicated API key for LaserX.
4. LaserX stores the credential only in the operating-system credential vault.
5. Electron main uses the credential through the OpenAI provider adapter.

The credential-acquisition method is replaceable. A future OpenAI or ChatGPT
delegated account-authorization flow may replace manual API-key setup without
changing the generation, concept-review, normalization, tracing, cutability, or
project-insertion pipeline.

LaserX does not resell AI credits or embed a shared provider key in the initial
commercial model. All manual editing and non-AI workflows remain available
without an AI connection.

## Included

- provider-neutral AI request/result interfaces;
- OpenAI-first provider implementation using user-owned API billing;
- secure credential configuration through the operating-system credential
  vault, outside renderer, project files, logs, fixtures, and source control;
- connect, test, replace, disconnect, invalid-key, no-credit, rate-limit, and
  offline states;
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
- safe failure preserving the open project;
- an authentication boundary that can later accept delegated OpenAI/ChatGPT
  authorization without changing provider-independent generation behavior.

## Explicitly excluded

Exact replication of protected logos, autonomous export without user review, hidden provider selection, sending the full project unnecessarily, dependence on AI for normal editing, a shared LaserX-owned API key in distributed software, and LaserX-managed credit resale in the initial commercial model.

## Acceptance tests

1. Prompt-generated result enters the editor as normal editable objects.
2. Wording is verified and presented for correction before final insertion.
3. Provider/network failure leaves the project unchanged and usable.
4. Generated geometry cannot bypass normalization or cutability analysis.
5. Secrets never appear in renderer bundles, logs, fixtures, telemetry, crash
   reports, project files, or committed config.
6. User can discard a concept without project mutation.
7. General motorcycle-badge, farmhouse, industrial, and address-sign prompts produce usable candidate workflows without bundled trademark assets.
8. OpenAI connection can be tested, replaced, and disconnected without
   changing the open project.
9. The application remains fully usable for non-AI work with no credential,
   network connection, or provider balance.
10. Mocked provider tests prove that credential acquisition can be replaced
    without changing the prompt-to-editable pipeline.

## Exit checklist

- [x] Provider/security ADR 0017 remains satisfied by the implementation.
- [x] Privacy and provenance behavior documented.
- [x] Prompt-to-editable end-to-end test passes with mocked provider.
- [x] Real-provider validation procedure documented separately from CI.
- [x] Operating-system credential-vault behavior is tested without exposing a
  real secret.
- [ ] Status advances to M11.
