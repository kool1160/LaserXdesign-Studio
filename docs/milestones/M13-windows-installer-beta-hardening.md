# M13 — Windows Installer, Packaging, and Beta Hardening

## User-visible outcome

A dependable, branded Windows beta can be installed and launched like normal software, used on real sign jobs, recovered after common failures, cleanly uninstalled, and validated privately on owner-controlled Windows machines.

Trusted public code signing and public/commercial distribution are deferred until the owner decides to sell or distribute LaserX outside the private test boundary.

## Activation gate

M13 is active. M12 was reviewed on its exact final head, required CI passed, PR #29 merged in `e950a6397ad31cf225893a7fc5f9a0704fe07e64`, Issue #12 closed, and `docs/status/CURRENT.md` activated M13.

The owner released the M12 hands-on hold on 2026-08-02. The owner-observed repair prerequisite completed exact-head review and merge through PR #32. The Windows installer and beta-hardening implementation then completed exact-head review and merged through PR #33.

## Owner-observed hands-on repair prerequisite

The exact reviewed M12 Windows build exposed release-blocking manufacturing and usability defects. These repairs were required beta hardening, not permission for unrelated feature expansion.

### DXF import repair and stock fitting

- supported DXF spline geometry converts deterministically into editable paths within documented tolerance and point limits instead of being silently skipped;
- import preview surfaces unsupported or failed entities as actionable, geometry-linked findings;
- bounded automatic repair proposals cover zero-length segments, duplicate consecutive nodes, exact duplicates, nearly coincident endpoints, and almost-closed contours;
- every proposed repair identifies what changed, remains previewable, requires explicit acceptance, and imports as one undoable transaction;
- the user can choose `Resize stock to fit artwork`, `Scale artwork to current stock`, or `Keep current stock and artwork size`;
- `Resize stock to fit artwork` is the default for oversized artwork, uses an explicit margin, preserves source scale, centers accepted artwork, and fits the viewport;
- LaserX never silently scales imported manufacturing geometry or discards unsupported entities while claiming a complete import.

### U.S. stock thickness and material workflow

- the UI supports material-specific U.S. sheet-gauge designations and common fractional-inch plate choices in addition to millimeters and custom thickness;
- gauge choices depend on the selected material rather than one universal conversion;
- the interface shows the selected shop designation with inch and millimeter equivalents;
- canonical calculations and geometry use exact `thicknessMm`;
- the native project and production manifest preserve the user-facing stock designation and normalized canonical thickness;
- existing projects containing only `thicknessMm` remain valid and migrate without inventing a gauge or fractional designation.

### Packaged AI credential connection

- `Connect existing key` and `Replace key` use a visible, application-owned secure Windows interaction;
- credential acquisition provides cancel, timeout, retry, and clear failure states;
- cancellation or failure restores usable controls and the previous connection state;
- the API key remains outside renderer state, logs, project files, crash reports, and source control and is stored through the accepted operating-system encryption boundary;
- packaged Windows E2E proves the connection flow cannot remain globally busy indefinitely.

## Completion records

### Repair prerequisite — PR #32

- Final reviewed head: `5fb466f1d1c784c4d2d2bc14aab6f5167793b150`
- READY review: `4839027689`
- Merge commit: `a58eb7049349c02522c4caea05d59c17f54992fe`
- Verification: 288 unit/integration tests and 31/31 packaged Windows Electron E2E scenarios
- Exact-head artifact: `8835466777`
- Artifact digest: `sha256:d590340d837089c6a301788808a9e119659e4df2fe89a7ec6a024363399a78fc`

### Installer and beta hardening — PR #33

- Final reviewed head: `6cdfaf4fbf68e8c078b4b0b0cda095ea1fcad30f`
- READY review: `4839609133`
- Merge commit: `1231a0127a59fe87b38824d3fa11039c3a028422`
- Repository Guard run: `30763625121`
- M04–M13 exact-head workflows: all completed successfully
- Verification: 290 unit/integration tests and 31/31 applicable packaged Windows Electron E2E scenarios
- M13 workflow: `30763625120`
- Exact-head evidence artifact: `8838329615`
- Artifact digest: `sha256:d3457ac6e470285e4efd4a5231b021f4aed34078fc542e2b388a4b7e8de9e601`

The evidence artifact uses a disposable CI-only certificate. It proves installer, signing-policy, and lifecycle mechanics but is not a trusted public release.

## Included

- completion of the owner-observed hands-on repair prerequisite;
- assisted Windows x64 `.exe` installer;
- Start Menu shortcut and optional desktop shortcut;
- clean uninstall behavior that preserves or removes user data only through explicit documented choices;
- application data, credentials, autosaves, logs, caches, session data, crash dumps, and settings stored in Windows user-data locations outside the repository and installation directory;
- product name, icon, executable metadata, semantic version, changelog, and release notes;
- versioned evidence artifacts with provenance and checksums;
- clean Windows install, launch, primary-workflow, upgrade, and uninstall validation;
- crash handling and recoverable session behavior;
- performance safeguards;
- worker cancellation and progress behavior;
- memory safeguards for large files;
- keyboard navigation and accessibility coverage;
- high-DPI and common display testing;
- local-only diagnostics and explicit privacy behavior;
- security and dependency audits;
- migration tests from supported project schemas;
- beta feedback template and known-issues list;
- a dormant, fail-closed trusted public-signing workflow for future commercialization.

## Private-testing release boundary

The owner is currently testing LaserX only on personally controlled computers. M13 does not require the owner to purchase a Windows code-signing certificate or configure production signing secrets.

For this private boundary:

- an unsigned installer or CI-generated disposable self-signed installer is acceptable;
- Windows SmartScreen, `Unknown Publisher`, and certificate-trust warnings are expected and accepted;
- the artifact must be labeled private test software and must not be sold, publicly distributed, or represented as a trusted public beta;
- exact source, version, artifact hashes, installer identity, install/upgrade/uninstall behavior, data preservation, and primary workflow must remain verified;
- at least one owner-controlled Windows machine must complete install, launch, representative project work, and uninstall before M13 closes.

## Future public/commercial boundary

Before LaserX is sold or distributed outside the owner's controlled private test group, a future commercialization gate must require:

- a trusted Windows code-signing identity or separately accepted managed-signing design;
- exact signer-identity validation;
- production-signed installer and executable;
- public release provenance and checksums;
- controlled tagged publication;
- appropriate support, privacy, and distribution documentation.

The existing fail-closed production workflow remains available but dormant until the owner authorizes public or commercial distribution.

## Release boundary

M13 produces the private installable beta and release-hardening evidence. It does not declare the product stable Version 1.0. Real-world beta validation, representative user and machine coverage, final release-defect triage, the approved physical 3D sign viewer, and the Version 1.0 publication decision belong to M14.

## Explicitly excluded

No unrelated major design, AI, layered-production, CAM, nesting, G-code, DWG, machine-control, marketplace, licensing, account-platform, or physical 3D production scope belongs in M13. Optional auto-update remains deferred unless explicitly authorized. The M14 physical 3D sign viewer remains blocked until M14 activation.

## Acceptance tests

1. Supported DXF splines convert to bounded editable geometry and no accepted import falsely claims completeness after silent entity loss.
2. Import repair proposals are explicit, previewable, geometry-linked, deterministic, and accepted as one undoable transaction.
3. Oversized artwork offers the three documented stock-fitting choices; the default fit preserves source scale and produces containing stock with margin.
4. Material-specific gauge, fractional-inch, millimeter, and custom stock choices normalize to exact millimeters and survive save/reopen and production-manifest export.
5. Legacy projects migrate without inventing a stock designation.
6. Packaged AI credential connection can complete, cancel, time out, fail, and retry without indefinite busy state or secret exposure.
7. The hands-on repair PR passes exact-head review and merges before installer implementation.
8. The installer completes on a clean supported Windows environment and launches LaserX from the Start Menu.
9. Optional desktop-shortcut selection behaves correctly and uninstall removes installed application files cleanly.
10. Runtime app data is stored outside the repository and installation directory.
11. Upgrade preserves user projects and settings under documented conditions.
12. Crash/restart recovery does not overwrite the last explicit save.
13. Performance safeguards pass on the documented reference runner and fixtures.
14. Core workflows are keyboard accessible, high-DPI usable, and warnings are not color-only.
15. No critical or high unresolved security issue remains in the private-test scope.
16. Private-test artifact source, version, hashes, signature state, and limitations are recorded.
17. A representative project completes the primary workflow and exports at correct scale after clean installation.
18. The owner completes a private install, launch, representative workflow, and uninstall on at least one personally controlled Windows machine and accepts the expected trust warnings.

## Exit checklist

- [x] Owner-observed hands-on repair prerequisite reviewed and merged.
- [x] DXF spline conversion, repair preview, and stock-fitting workflow pass packaged Windows tests.
- [x] U.S. stock designation workflow and migration pass.
- [x] Packaged AI credential connection cannot hang indefinitely and preserves the security boundary.
- [x] Windows installer implementation reviewed and merged.
- [x] Install, upgrade, launch, shortcut, and uninstall automation passes.
- [x] User-data and credential-storage locations documented and verified.
- [x] Release checklist, privacy behavior, beta feedback, and known issues documented.
- [x] Security and dependency audits pass.
- [x] Performance, accessibility, recovery, and migration automation passes.
- [x] Private-test evidence artifact and checksum recorded.
- [ ] Owner completes and accepts private hands-on installer validation on an owner-controlled Windows machine.
- [ ] Issue #13 closes and status advances only after the private validation evidence is recorded and the owner explicitly advances.

Trusted public signing, public tagging, and commercial distribution are deferred and are not M13 exit requirements under the current owner-only private-testing decision.
