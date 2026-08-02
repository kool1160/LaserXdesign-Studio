# Current Project Status

## Active gate

**M13 — Windows Installer, Packaging, and Beta Hardening**

Issue #13 remains the active delivery gate. M13 is not complete and M14 is not
active.

## M13 implementation — reviewed and merged

The Windows installer and beta-hardening implementation was independently
reviewed and merged through PR #33.

- Final reviewed head: `6cdfaf4fbf68e8c078b4b0b0cda095ea1fcad30f`
- READY review: `4839609133`
- Merge commit: `1231a0127a59fe87b38824d3fa11039c3a028422`
- Repository Guard run: `30763625121`
- M04–M13 exact-head workflows: all completed successfully
- Verification: 290 unit/integration tests and 31/31 applicable packaged Windows Electron E2E scenarios
- Exact-head M13 workflow: `30763625120`
- Exact-head Windows artifact: `8838329615`
- Artifact digest:
  `sha256:d3457ac6e470285e4efd4a5231b021f4aed34078fc542e2b388a4b7e8de9e601`

The merged implementation delivers:

1. an assisted per-user x64 NSIS installer with stable LaserX identity, Start
   Menu shortcut, optional desktop shortcut, upgrade behavior, and clean
   uninstall;
2. production runtime data under `%APPDATA%\LaserX Design Studio`, with default
   uninstall preserving actual app-created settings, encrypted credentials,
   recovery, logs, session data, and crash dumps, plus explicit deletion when
   selected;
3. clean-installed launch, high-DPI, keyboard, representative
   SVG/analyze/save/DXF, upgrade, recovery, and uninstall validation;
4. fail-closed Authenticode policy using an exact reviewed signer thumbprint,
   least-privilege signing-secret scope, packaged-identity inspection,
   schema-2 provenance, exact-tag validation, and a controlled prerelease
   workflow;
5. local-only diagnostics, documented privacy/recovery behavior, release notes,
   known issues, beta feedback, dependency/security audits, and deferred
   auto-update.

The CI artifacts use a disposable self-signed identity and prove mechanics only.
They are not a trusted production beta.

## Remaining M13 boundary — owner-controlled production release

No additional feature implementation is authorized. The remaining M13 work is
the controlled production release boundary:

1. configure GitHub Actions secrets `WIN_CSC_LINK` and
   `WIN_CSC_KEY_PASSWORD` with the real Windows code-signing identity;
2. configure repository variable `WINDOWS_CODE_SIGNING_THUMBPRINT` with the
   reviewed exact production signer thumbprint;
3. verify the exact release source and create tag `v0.13.0-beta.1` only through
   owner-authorized advancement;
4. manually dispatch **M13 Controlled Beta Release** with confirmation
   `PUBLISH REVIEWED BETA`;
5. verify the production-signed installer and executable, clean lifecycle,
   source commit, signer identity, provenance, hashes, workflow run, and
   published prerelease assets;
6. record the final release evidence, close Issue #13, and update this status.

Until those steps succeed:

- M13 remains open;
- the CI self-signed artifact remains evidence only;
- no Version 1 beta release is considered published;
- M14 remains blocked;
- Codex must not begin M14.

## Workstream ownership

`docs/WORKSTREAM_OWNERSHIP.md` remains authoritative.

After M13 is fully completed, published, closed, and recorded, Codex stops in
`OWNER_HANDOFF_REQUIRED`. It must not begin M14 without new explicit owner
authorization.

Claude remains the designated lead for the physical 3D sign-preview workstream.
Current Claude authority is isolated parallel research only under Issue #34 and
branch `experiment/m14-physical-3d-preview-lab`. Nothing from that experiment is
merge-authorized while M14 is blocked.

## Explicitly excluded

Do not add broad CAD, universal file-format support, DWG, general-purpose
materials databases, new AI providers, physical 3D production implementation,
CAM, nesting, G-code, machine control, marketplace, licensing,
account-platform, or unrelated feature expansion. M14 owns the approved
physical 3D sign viewer, real-world beta validation, and stable Version 1.0
publication decision.

## M13 exit rule

Do not advance to M14 until the production-signed controlled beta is
successfully published from the exact reviewed source, final provenance and
checksums are recorded, Issue #13 is closed, this file records the verified
release evidence, and the owner explicitly decides the post-M13 handoff.
