# M13 — Windows Installer, Packaging, and Beta Hardening

## User-visible outcome

A dependable, branded Windows beta can be installed and launched like normal software, used on real sign jobs, recovered after common failures, cleanly uninstalled, and distributed through a controlled versioned release process.

## Activation gate

M13 is active. M12 was reviewed on its exact final head, required CI passed, PR #29 merged in `e950a6397ad31cf225893a7fc5f9a0704fe07e64`, Issue #12 closed, and `docs/status/CURRENT.md` activated M13.

The owner released the M12 hands-on hold on 2026-08-02. The owner-observed repair prerequisite has now completed exact-head review and merge, so the remaining installer/signing stage may proceed from fresh `main`.

## Owner-observed hands-on repair prerequisite

The exact reviewed M12 Windows build exposed release-blocking manufacturing and usability defects. These repairs are required beta hardening, not permission for unrelated feature expansion.

### DXF import repair and stock fitting

- supported DXF spline geometry must convert deterministically into editable paths within documented tolerance and point limits instead of being silently skipped;
- import preview must surface unsupported or failed entities as actionable, geometry-linked findings rather than a passive warning list;
- bounded automatic repair proposals must cover at least zero-length segments, duplicate consecutive nodes, exact duplicates, nearly coincident endpoints, and almost-closed contours;
- every proposed repair must identify what changed, remain previewable, require explicit acceptance, and import as one undoable transaction;
- the user must be able to choose `Resize stock to fit artwork`, `Scale artwork to current stock`, or `Keep current stock and artwork size`;
- `Resize stock to fit artwork` is the default for artwork larger than the current document, uses an explicit configurable margin, preserves source scale, centers the accepted artwork, and fits the viewport;
- LaserX must never silently scale imported manufacturing geometry or discard unsupported entities while claiming a complete import.

### U.S. stock thickness and material workflow

- the UI must support material-specific U.S. sheet-gauge designations and common fractional-inch plate choices in addition to millimeters and custom thickness;
- gauge choices must depend on the selected material rather than using one universal gauge conversion;
- the interface must show the selected shop designation together with its inch and millimeter equivalents;
- canonical calculations and geometry continue to use exact `thicknessMm`;
- the native project and production manifest must preserve the user-facing stock designation and its normalized canonical thickness through a documented schema migration;
- existing projects containing only `thicknessMm` remain valid and migrate without inventing a gauge or fractional designation.

### Packaged AI credential connection

- `Connect existing key` and `Replace key` must use a visible, application-owned secure Windows interaction rather than an indefinitely awaited hidden PowerShell form;
- credential acquisition must provide cancel, timeout, retry, and clear failure states;
- cancellation or failure must restore usable controls and the previous connection state without requiring application restart;
- the API key remains outside renderer state, logs, project files, crash reports, and source control and is stored only through the accepted operating-system encryption boundary;
- packaged Windows E2E must exercise the real production wiring sufficiently to prove the connection flow cannot remain globally busy indefinitely.

## Repair prerequisite completion record

PR #32 completed the prerequisite and merged into `main`.

- Final reviewed head: `5fb466f1d1c784c4d2d2bc14aab6f5167793b150`
- READY review: `4839027689`
- Merge commit: `a58eb7049349c02522c4caea05d59c17f54992fe`
- Repository Guard run: `30754236851`
- M04–M12 exact-head workflows: all completed successfully
- Verification: 288 unit/integration tests and 31/31 packaged Windows Electron E2E scenarios
- Exact-head artifact: `8835466777`
- Artifact digest: `sha256:d590340d837089c6a301788808a9e119659e4df2fe89a7ec6a024363399a78fc`

The repair merge does not complete M13. Issue #13 remains open for the installer, signing, packaging, recovery, performance, accessibility, security, migration, and controlled beta-release stages.

## Included

- completion of the owner-observed hands-on repair prerequisite before installer work;
- signed Windows `.exe` installer and documented code-signing process;
- Start Menu shortcut and optional desktop shortcut;
- clean uninstall behavior that preserves or removes user data only through explicit documented choices;
- application data, credentials, autosaves, logs, caches, and settings stored in appropriate Windows user-data locations outside the source repository;
- product name, publisher, icon, executable metadata, semantic version, changelog, and release notes;
- versioned release artifacts with provenance, checksums, and reproducible-build documentation;
- clean Windows install, launch, primary-workflow, upgrade, and uninstall validation;
- auto-update decision and implementation only if separately accepted; auto-update is not required for the first beta installer;
- crash handling and recoverable session behavior;
- performance budgets for startup, pan/zoom, selection, trace, booleans, analysis, save, and export;
- worker cancellation and progress polish;
- memory safeguards for large files;
- keyboard navigation and accessibility pass;
- high-DPI and common display testing;
- telemetry/crash-reporting decision with explicit opt-in and privacy behavior;
- security review and dependency audit;
- migration tests from every shipped project schema;
- beta feedback template and known-issues list;
- release CI gates.

## Release boundary

M13 produces the signed, installable beta and release-hardening evidence. It does not declare the product stable Version 1.0. Real-world beta validation, representative user and machine coverage, final release-defect triage, the approved physical 3D sign viewer, and the Version 1.0 publication decision belong to M14.

The owner-observed repair prerequisite is narrow beta hardening. It does not authorize broad CAD, general import expansion, a universal materials database, a new AI provider platform, or unrelated workflow redesign.

## Explicitly excluded

No unrelated major design, AI, layered-production, CAM, nesting, G-code, DWG, machine-control, marketplace, licensing, or account-platform scope belongs in release hardening. Optional auto-update remains deferred unless explicitly authorized. The M14 physical 3D sign viewer remains blocked until M14 activation.

## Acceptance tests

1. Supported DXF splines convert to bounded editable geometry and no accepted import falsely claims completeness after silent entity loss.
2. Import repair proposals are explicit, previewable, geometry-linked, deterministic, and accepted as one undoable transaction.
3. Oversized artwork offers the three documented stock-fitting choices; the default fit preserves source scale and produces stock that contains the accepted artwork plus the chosen margin.
4. Material-specific gauge, fractional-inch, millimeter, and custom stock choices normalize to exact canonical millimeters and survive save/reopen and production-manifest export.
5. Legacy projects migrate without inventing a stock designation.
6. Packaged AI credential connection can complete, cancel, time out, fail, and retry without leaving the application indefinitely busy or exposing the key.
7. The hands-on repair PR passes exact-head review and merges before installer implementation begins.
8. A signed installer completes on a clean supported Windows environment and launches LaserX from the Start Menu.
9. Optional desktop-shortcut selection behaves correctly and uninstall removes installed application files cleanly.
10. Runtime app data is stored outside the repository and installation directory.
11. Upgrade preserves user projects and settings under documented conditions.
12. Crash/restart recovery does not overwrite the last explicit save.
13. Performance budgets pass on the documented reference machine and fixture set.
14. Core workflows are keyboard accessible, high-DPI usable, and warnings are not color-only.
15. No critical or high unresolved security issue remains in the release scope.
16. Release artifact provenance, signatures, versions, and checksums are recorded.
17. A representative project completes the primary workflow and exports at correct scale after clean installation.

## Exit checklist

- [x] Owner-observed hands-on repair prerequisite reviewed and merged.
- [x] DXF spline conversion, repair preview, and stock-fitting workflow pass packaged Windows tests.
- [x] U.S. stock designation workflow and migration pass.
- [x] Packaged AI credential connection cannot hang indefinitely and preserves the security boundary.
- [ ] Signed Windows installer validated on a clean Windows environment.
- [ ] Install, upgrade, launch, shortcut, and uninstall checklist complete.
- [ ] User-data and credential-storage locations documented and verified.
- [ ] Release checklist and known issues published.
- [ ] Security and license audits pass.
- [ ] Performance, accessibility, recovery, and migration gates pass.
- [ ] Version 1 beta is tagged and published for controlled validation.
- [ ] Status advances to M14 only after exact-head review, green CI, merge, Issue #13 closure, and owner advancement.
