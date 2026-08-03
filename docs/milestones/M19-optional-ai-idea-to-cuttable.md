# M19 — Optional AI Idea-to-Cuttable-Design Onboarding

## User-visible outcome

A user who chooses the optional AI path can describe an idea, compare concepts, accept one, and continue with editable, validated, manufacturable geometry—while every normal LaserX workflow still works without AI.

## Activation gate

M19 remains blocked until M18 is complete and the owner explicitly activates optional-AI onboarding work.

## Included

- a clear `AI Ideas — Optional` entry point inside guided onboarding;
- user-supplied supported provider access and direct provider billing;
- connection, replacement, disconnect, offline, invalid-key, cancellation, and timeout behavior;
- prompt and optional reference-image guidance focused on signs and layered flat-cut products;
- multiple bounded concept choices with wording review and correction;
- conversion into ordinary editable geometry through existing normalization, sign tools, tracing where needed, and cutability analysis;
- material/layer suggestions presented as editable proposals, never silent authority;
- visible provider usage information where available;
- privacy language explaining what is sent and what remains local;
- graceful fallback to deterministic sign tools when AI is unavailable.

## Acceptance tests

1. Users can complete the normal product without connecting AI.
2. AI output cannot bypass normalization, cutability, material truth, or explicit acceptance.
3. Accepted output becomes ordinary editable geometry and survives save/reopen without requiring the provider.
4. Prompt text, references, alternatives, provider metadata, and usage remain transient under the accepted privacy policy.
5. Credentials never enter renderer state, project files, logs, fixtures, or source control.
6. Cancel, timeout, failure, replacement, and offline states leave the editor usable.
7. Midflight project changes cannot accept stale AI output.
8. Generated designs can continue through physical 3D preview and downstream export.
9. The UI never implies AI is required to make signs.

## Exit checklist

- [ ] Optional-AI onboarding copy and privacy boundary are approved.
- [ ] Provider-neutral workflow and secure credential behavior pass.
- [ ] Editable/validated acceptance path passes packaged E2E.
- [ ] Non-AI fallback and offline operation are proven.
- [ ] Owner validates representative AI and non-AI first-session flows.
- [ ] Status advances to M20 only after audit, merge, issue closure, and owner approval.

## Explicitly excluded

No shared embedded key, AI-credit resale, mandatory AI account, cloud project storage, autonomous manufacturing decisions, machine commands, or unreviewed provider expansion belongs in M19.
