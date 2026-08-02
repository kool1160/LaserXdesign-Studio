# AI Prompt and Image Pipeline

## User flow

LaserX turns a bounded prompt and optional consented PNG/JPEG reference into
two to four temporary concepts. The user reviews ordinary editable geometry,
checks exact wording and the standard manufacturing analysis, then either
accepts one concept or discards all of them. Nothing enters project history
until acceptance.

The explicit request controls are wording, millimeter dimensions, style,
manufacturing process, detail, bridge preference, mounting-hole diameter and
inset, one to three layers, backing plate, and concept count. Provider output
cannot override these authoritative constraints.

## Provider and credential boundary

`packages/ai` defines a provider-neutral request/result contract. The initial
adapter uses OpenAI's Responses API with strict structured output, `store:
false`, a bounded output-token budget, and the current configured model. Only
Electron main can read a credential or make the provider request. Renderer IPC
contains bounded intent parameters and concept summaries, never a credential,
authorization header, provider endpoint, local path, source pixels, or
provider-supplied geometry.

On Windows, key entry uses a visible app-owned password dialog outside the
renderer. The prompt has a two-minute ceiling, exposes an in-app Cancel action,
and is terminated on cancel or timeout. Either outcome restores the prior
connection state and releases the renderer's global busy state so the user can
retry or continue manual work. The
main process tests the key before encrypting it with Electron `safeStorage`;
only the encrypted envelope is written under Electron user data. Replace and
disconnect update or delete that envelope without changing the open project.
LaserX never embeds a shared key, resells credits, or requires AI for manual
editing.

The production provider policy selects `gpt-5.6-sol`, verified against the
[official model page](https://developers.openai.com/api/docs/models/gpt-5.6-sol)
on 2026-08-01. That API model supports the Responses endpoint, image input,
and structured outputs required by this pipeline. The ID lives in the exported
provider policy rather than renderer/UI code, so a reviewed policy update can
replace it without changing the provider contract. Connection testing probes
that exact configured model and reports model-not-found or inaccessible-model
responses separately from invalid credentials and offline failures.

## Reference privacy

A reference is read only after an explicit consent checkbox enables the
native picker. Main validates its signature, dimensions, decoded form, eight-
MiB byte ceiling, and twelve-million-pixel ceiling. A bounded preview may be
shown in renderer state. The source data is included only in a generation
request whose consent flag is still true. Removing the reference, replacing
the project, or exiting drops the in-memory attachment.

Prompts and references are sent to OpenAI only when the user chooses Generate.
They are not sent during connection testing and are not stored in `.laserx`.
Users should not attach material they lack permission to share, and LaserX does
not promise exact replication of protected logos.

## Normalization and acceptance

Structured concepts are interpreted through the existing versioned M09 sign
generator and bundled-font engine. Raster fallback data must pass the same M07
header, decode, trace, size, cancellation, and object-count boundaries as a
manual raster import. Each result becomes ordinary layers and domain objects;
provider IDs and formats never become manufacturing geometry.

Every concept receives standard M08 analysis before it is published. This is
advisory: `cutReady` remains false, issues are visible, and the user remains
responsible for process/material review. Exact wording is compared after
canonical whitespace/case normalization. A mismatch disables acceptance;
structured wording can be corrected locally and renormalized without another
provider call. Raster wording requires a revised request.

Acceptance rechecks the source-project fingerprint and dispatches one ordinary
`objects.import` command. The accepted IDs immediately receive a fresh M08
analysis. One Undo removes the whole accepted concept. Provider failure,
refusal, malformed output, cancellation, stale work, or discard leaves the
project, dirty state, and history unchanged. Generation and local wording
correction both retain the exact source-project fingerprint through every
awaited normalization step; the application layer rejects a preview whose
source fingerprint no longer matches instead of stamping it onto newer state.

## Provenance, usage, and persistence

Concept review shows provider/model, structured-versus-raster source, request
usage when supplied, and a conservative cost note. OpenAI bills the connected
account directly; LaserX cannot state an exact cost before the provider reports
token usage.

The current schema persists only accepted ordinary geometry. Prompt text,
reference media, concept alternatives, provider/model/request IDs, usage, and
AI provenance are intentionally transient (`provenanceSaved: false`). This is
a privacy choice, not a claim that provider-side processing did not occur.

## Failure and recovery

The UI distinguishes disconnected, invalid-key, no-credit, rate-limited,
offline, and unavailable states. Retry timing is retained when OpenAI supplies
it. Key setup and billing buttons open official OpenAI Platform pages. Users
can test, replace, or disconnect the credential; all manual commands remain
available in every settled connection state. Credential entry is the only
temporarily modal connection step and is always cancelable and time-bounded.

## Real-provider validation (manual, never CI)

1. Use a dedicated, spending-limited OpenAI project and key entered through the
   native LaserX prompt. Never place the key in the repository or terminal.
2. Test the connection, then generate two concepts without a reference and two
   with a small, non-sensitive reference after explicit consent.
3. Confirm wording mismatch blocks acceptance, correction is local, selection
   changes only the overlay, and accepted geometry is editable and undoable.
4. Exercise invalid-key, no-credit/rate-limit where safely possible, offline,
   cancellation, replace, and disconnect behavior; confirm project bytes and
   history do not change on failure.
5. Inspect the saved `.laserx`, application logs, renderer state, and packaged
   renderer bundle for the key, prompt, image bytes, and provider metadata.
6. Delete the test key in the OpenAI Platform after validation and disconnect
   LaserX. Record only pass/fail evidence and provider request IDs that contain
   no user content or credentials.

CI and packaged Playwright tests use the deterministic main-process provider
and in-memory credential ports. They never call OpenAI or consume account
credit.
