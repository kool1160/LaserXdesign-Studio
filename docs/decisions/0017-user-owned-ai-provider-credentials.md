# ADR 0017: User-Owned AI Provider Credentials

## Status

Accepted.

## Decision

LaserX will launch AI sign generation with an OpenAI-first, provider-neutral
adapter boundary. The initial commercial connection model is bring-your-own
OpenAI API access:

- the user signs in to the OpenAI Platform outside LaserX;
- the user enables API billing or prepaid credit directly with OpenAI;
- the user creates a dedicated API key for LaserX;
- LaserX stores that credential only in the operating-system credential vault;
- OpenAI bills the user directly for their API usage.

The Electron main process owns credential retrieval and provider network calls.
The renderer receives only connection state, capability metadata, estimates,
progress, and normalized candidate results. API keys must never enter renderer
bundles, project files, logs, fixtures, telemetry, crash reports, clipboard
history, or committed configuration.

The provider interface must separate credential acquisition from generation.
A future delegated OpenAI or ChatGPT account authorization flow may replace the
manual API-key setup without changing prompt construction, concept review,
normalization, tracing, cutability analysis, or project insertion.

AI output is always a candidate, never authoritative manufacturing geometry.
Every result must pass LaserX normalization, wording review, geometry rules,
cutability analysis, and explicit user acceptance before entering the project.
All non-AI editing, tracing, analysis, and export workflows remain usable
without an AI account, credential, network connection, or provider balance.

Where provider data makes it possible, LaserX should show an estimated cost or
usage warning before generation and clear connection states such as connected,
invalid credential, insufficient credit, rate limited, unavailable, and
disconnected.

## Rationale

User-owned API billing lets LaserX offer commercial AI features without
reselling credits, carrying unpredictable inference costs, or embedding a
shared vendor secret in distributed desktop software. A provider-neutral
boundary prevents the product from becoming structurally dependent on one
credential method or one vendor-specific response format.

Separating authentication from generation preserves a clean migration path if
OpenAI later exposes broad third-party account authorization for paid ChatGPT
users. Keeping AI downstream of deterministic LaserX geometry and cutability
systems prevents a visually convincing image from being mistaken for a safe or
manufacturable design.

## Alternatives

- Shipping a LaserX-owned OpenAI key was rejected because desktop binaries
  cannot safely contain a shared secret and abuse would place all cost and risk
  on LaserX.
- LaserX-managed subscriptions or resold AI credits were deferred because they
  require metering, billing, fraud controls, support, and margin management.
- Hard-wiring the application directly to one OpenAI authentication mechanism
  was rejected because provider account authorization may change.
- Allowing the renderer to call the provider directly was rejected because it
  would expose credentials and widen the trusted boundary.
- Making AI mandatory for sign design was rejected because LaserX must remain a
  dependable local editor when offline or disconnected.

## Consequences

M10 must implement a replaceable provider contract, secure operating-system
credential storage, explicit connect/test/replace/disconnect behavior, and
mocked-provider end-to-end coverage. OpenAI is the first supported provider,
but provider-specific authentication and request mapping stay behind the
adapter.

The first release may require users to perform API-account setup and key
creation in the OpenAI Platform. That setup is less convenient than delegated
account authorization, but it is commercially workable now and can be replaced
later without rebuilding the AI sign-generation pipeline.
