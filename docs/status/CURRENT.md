# Current Project Status

## Active gate

**M13 — Windows Installer, Packaging, and Beta Hardening**

Issue #13 remains the active delivery gate. M13 is not complete and M14 is not active.

## Mandatory strategic planning context

GitHub Issue #37 — **Mandatory post-milestone direction: onboarding, broader materials, AI-first creation, and the flat-cut market** — is the canonical owner product-direction handoff for work beyond the active gate.

Issue #37 predates and explains the isolated physical-3D, material-catalog, and material-aware-rendering research. Every planning assistant, reviewer, coding agent, and architecture agent must read it before evaluating, proposing, researching, or sequencing post-milestone work.

Issue #37 does **not** activate M14 or any later milestone, authorize an experiment merge, override this active M13 gate, or establish an automatic implementation order. It preserves the owner's strategic direction so later milestone planning does not mistake governed R&D for unplanned scope expansion.

## M13 implementation — reviewed and merged

The Windows installer and beta-hardening implementation was independently reviewed and merged through PR #33.

- Final reviewed head: `6cdfaf4fbf68e8c078b4b0b0cda095ea1fcad30f`
- READY review: `4839609133`
- Merge commit: `1231a0127a59fe87b38824d3fa11039c3a028422`
- Repository Guard run: `30763625121`
- M04–M13 exact-head workflows: all completed successfully
- Verification: 290 unit/integration tests and 31/31 applicable packaged Windows Electron E2E scenarios
- Exact-head M13 workflow: `30763625120`
- Exact-head Windows artifact: `8838329615`
- Artifact digest: `sha256:d3457ac6e470285e4efd4a5231b021f4aed34078fc542e2b388a4b7e8de9e601`

The merged implementation delivers:

1. an assisted per-user x64 NSIS installer with stable LaserX identity, Start Menu shortcut, optional desktop shortcut, upgrade behavior, and clean uninstall;
2. production runtime data under `%APPDATA%\LaserX Design Studio`, with default uninstall preserving actual app-created settings, encrypted credentials, recovery, logs, session data, and crash dumps, plus explicit deletion when selected;
3. clean-installed launch, high-DPI, keyboard, representative SVG/analyze/save/DXF, upgrade, recovery, and uninstall validation;
4. fail-closed Authenticode policy using an exact reviewed signer thumbprint, least-privilege signing-secret scope, packaged-identity inspection, schema-2 provenance, exact-tag validation, and a dormant controlled public-release workflow;
5. local-only diagnostics, documented privacy/recovery behavior, release notes, known issues, beta feedback, dependency/security audits, and deferred auto-update.

## Owner decision — private testing only

On 2026-08-02 the owner confirmed that LaserX is currently for personal testing on owner-controlled computers only. The owner has not purchased a Windows code-signing certificate and does not need trusted public signing for the current phase.

For the active M13 private-testing boundary:

- an unsigned installer or CI-generated disposable self-signed installer is acceptable;
- Windows SmartScreen, `Unknown Publisher`, and certificate-trust warnings are expected and accepted;
- the artifact must be treated as private test software, not a trusted public beta;
- no `.pfx`, production signing secret, trusted signer variable, public tag, or public GitHub prerelease is required to close M13;
- LaserX must not be sold or publicly distributed under this private-test exception.

Trusted Windows code signing and controlled public publication are deferred until the owner decides to sell or distribute LaserX outside the controlled private test group. ADR 0023 records the durable distinction between private testing and future public/commercial release.

## Remaining M13 boundary — owner hands-on private validation

No additional feature implementation is authorized. The remaining M13 work is:

1. obtain the current private-test installer artifact from reviewed `main` evidence;
2. install it on at least one owner-controlled Windows machine;
3. accept the expected Windows trust warning;
4. launch LaserX from the Start Menu;
5. complete a representative import/analyze/save/export workflow;
6. verify normal uninstall and the documented app-data choice;
7. record the owner-observed result in Issue #13.

After that private validation is recorded, Issue #13 may close and M13 may complete through explicit owner advancement.

Until those steps succeed:

- M13 remains open;
- M14 remains blocked;
- Codex must not begin M14;
- the private artifact must not be presented as a public trusted release.

## Future commercialization boundary

Before LaserX is sold or publicly distributed, a future commercialization gate must require a trusted Windows signing identity or separately accepted managed-signing design, exact signer validation, production provenance and checksums, controlled tagged publication, and appropriate public support/distribution documentation.

The existing fail-closed production-signing workflow remains dormant and available for that future decision. It is not an active M13 blocker.

## Workstream ownership and completed research

`docs/WORKSTREAM_OWNERSHIP.md` remains authoritative.

After M13 is fully completed, closed, and recorded, Codex stops in `OWNER_HANDOFF_REQUIRED`. It must not begin M14 without new explicit owner authorization.

Claude's original physical-3D research under Issue #34 is complete and accepted at exact head `9a4a90c6fa891ed0d9baf9bc8c99d41b04d54136`. The accepted result is a component-by-component promotion plan, not authorization to merge the experiment branch wholesale.

Claude's material-aware 3D research under Issue #42 is also accepted at exact head `76fa77a8edeb976b46e8e345a4a232b938768b3f`. It remains isolated research and is not production-integrated or merge-authorized.

The wood/acrylic material-catalog foundation remains separate under Issue #39 and draft PR #40. Its package-local TypeScript/Vitest wiring must be repaired and exact-head verified before it can support a later promotion decision.

These research streams implement risk reduction within the pre-existing direction recorded in Issue #37. They do not change the active M13 gate or activate M14.

## Explicitly excluded

Do not add broad CAD, universal file-format support, DWG, general-purpose materials databases, new AI providers, physical 3D production implementation, CAM, nesting, G-code, machine control, marketplace, licensing, account-platform, public distribution infrastructure, or unrelated feature expansion. M14 owns the approved physical 3D sign viewer, real-world beta validation, and stable Version 1.0 publication decision.

## M13 exit rule

Do not advance to M14 until the owner completes private hands-on installer validation, the result is recorded, Issue #13 is closed, this file records completion, and the owner explicitly decides the post-M13 handoff.

Trusted public signing and public/commercial publication are deferred and are not current M13 exit requirements.
