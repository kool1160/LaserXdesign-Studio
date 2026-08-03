# Current Project Status

## Current state

**OWNER_HANDOFF_REQUIRED — M13 complete; M14 not active**

Issue #13 is closed as completed. The owner passed the repaired private-installer validation on 2026-08-03. No milestone is currently active until the owner explicitly decides whether to activate M14.

`Continue LaserX` does not authorize Codex to begin M14. Codex stops here unless the owner explicitly reauthorizes post-M13 work.

## M13 completion record

M13 — Windows Installer, Packaging, and Beta Hardening — is complete.

### Installer implementation

- PR: #33
- Final reviewed head: `6cdfaf4fbf68e8c078b4b0b0cda095ea1fcad30f`
- READY review: `4839609133`
- Merge commit: `1231a0127a59fe87b38824d3fa11039c3a028422`
- Verification: 290 unit/integration tests and 31/31 applicable packaged Windows Electron E2E scenarios

### Persistence repair

- PR: #35
- Final reviewed head: `e642aa56cb70d6876a9af43024920349f0c8ab7a`
- Merge commit: `5cf799273d55a2bc6df544d47b0fcc75d32c5d56`
- Root cause: an unaccepted import preview could remain visible while Save serialized the blank underlying document
- Repair: saving is blocked while vector, raster, sign-tool, or AI geometry remains an unaccepted preview; packaged regressions prove non-empty save, restart, direct reopen, identity, metadata, and correct-scale DXF export

### Repository maintenance prerequisite

- PR: #38
- Merge commit: `a95a90e702ebc96ea4db46b918324327b118f5ef`
- Issue #36 closed
- Windows case-colliding PR-template paths resolved
- Tracked-path collision guard added

### Fresh repaired installer evidence

- M13 workflow: `30772354097`
- Artifact: `8841019251`
- Digest: `sha256:c5d4b890f532d73ac56adaa79f880ef9930c057aeb89578740d41d8eb2caab19`

## Owner hands-on validation — passed

The owner completed the repaired private-installer workflow on an owner-controlled Windows machine:

1. installed the fresh repaired installer and accepted the expected Windows trust warning;
2. launched LaserX from the Start Menu;
3. imported a representative DXF;
4. explicitly accepted the import preview before saving;
5. ran manufacturing analysis;
6. saved a non-empty native project as `m13 test.laserx`;
7. closed and restarted LaserX;
8. reopened the saved project and confirmed the geometry returned instead of reopening blank;
9. confirmed the project identity `m13 test`, saved state, and file path;
10. exported `m13 test.dxf` after reopening;
11. ran the assisted uninstaller and confirmed successful completion;
12. confirmed the documented application-data choice was presented.

This evidence satisfies the private M13 exit gate. Issue #13 is closed.

## Private-testing and commercialization boundary

LaserX remains private test software for owner-controlled machines.

For this private phase:

- unsigned or disposable CI-self-signed installers are acceptable;
- SmartScreen, `Unknown Publisher`, and certificate-trust warnings are expected;
- no purchased certificate, production signing secrets, public tag, or public prerelease was required to complete M13.

Before public sale or distribution, LaserX must add trusted Windows signing or a separately accepted managed-signing design, exact signer validation, production provenance and checksums, controlled tagged publication, and public distribution/support documentation.

## Mandatory strategic planning context

GitHub Issue #37 is the canonical post-milestone product-direction handoff. Every planning assistant, reviewer, coding agent, and architecture agent must read it before proposing or sequencing post-M13 work.

Issue #37 preserves direction for:

- guided onboarding and Learn Mode;
- AI-first idea-to-manufacturable-design workflows;
- acrylic, wood, MDF, plywood, and broader material expansion;
- process-aware manufacturing guidance;
- downstream software export profiles;
- broader flat-cut market positioning;
- community beta and real-user usability testing.

It does not activate M14 or any later milestone and does not establish an automatic implementation order.

## Completed and isolated research

### Physical 3D preview

Claude's Issue #34 research is complete and accepted at exact head `9a4a90c6fa891ed0d9baf9bc8c99d41b04d54136`.

Accepted direction:

- adopt `@laserx/physical-preview-3d` largely intact;
- promote renderer conversion into a new `@laserx/physical-preview-three` package;
- use Three.js plus React Three Fiber;
- do not add a CAD kernel for M14;
- rewrite the production desktop UI against the open document;
- move PNG capture through typed Electron preload/main IPC;
- lazy-load the preview;
- do not merge the experiment branch wholesale;
- keep the lab shell, benchmark hooks, fixture registry, and bundled research fixtures out of production.

### Material-aware 3D research

Issue #42 research is accepted at exact head `76fa77a8edeb976b46e8e345a4a232b938768b3f`. It remains isolated and is not production-integrated or merge-authorized.

### Material catalog

Issue #39 and draft PR #40 remain separate isolated work. They do not activate a production material-expansion milestone or authorize schema/UI/export integration.

## Next owner decision

The owner must explicitly choose the next active gate.

The expected decision is whether to activate M14 — Beta Validation and Version 1.0 Release — and authorize the staged component-by-component physical 3D promotion plan on fresh reviewed branches.

Until that explicit decision:

- M14 remains inactive;
- Codex remains stopped in `OWNER_HANDOFF_REQUIRED`;
- no experiment branch may be merged wholesale;
- no production 3D, material, onboarding, export-profile, CAD, CAM, or machine-control implementation is authorized.