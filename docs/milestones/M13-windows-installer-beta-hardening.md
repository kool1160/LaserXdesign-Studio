# M13 — Windows Installer, Packaging, and Beta Hardening

## User-visible outcome

A dependable, branded Windows beta can be installed and launched like normal software, used on real sign jobs, recovered after common failures, cleanly uninstalled, and distributed through a controlled versioned release process.

## Included

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

## Explicitly excluded

No new major design, AI, layered-production, CAM, nesting, G-code, DWG, machine-control, marketplace, licensing, or account-platform scope belongs in release hardening. Optional auto-update remains deferred unless explicitly authorized.

## Acceptance tests

1. A signed installer completes on a clean supported Windows environment and launches LaserX from the Start Menu.
2. Optional desktop-shortcut selection behaves correctly and uninstall removes installed application files cleanly.
3. Runtime app data is stored outside the repository and installation directory.
4. Upgrade preserves user projects and settings under documented conditions.
5. Crash/restart recovery does not overwrite the last explicit save.
6. Performance budgets pass on the documented reference machine and fixture set.
7. Core workflows are keyboard accessible, high-DPI usable, and warnings are not color-only.
8. No critical or high unresolved security issue remains in the release scope.
9. Release artifact provenance, signatures, versions, and checksums are recorded.
10. A representative project completes the primary workflow and exports at correct scale after clean installation.

## Exit checklist

- [ ] Signed Windows installer validated on a clean Windows environment.
- [ ] Install, upgrade, launch, shortcut, and uninstall checklist complete.
- [ ] User-data and credential-storage locations documented and verified.
- [ ] Release checklist and known issues published.
- [ ] Security and license audits pass.
- [ ] Performance, accessibility, recovery, and migration gates pass.
- [ ] Version 1 beta tagged and status moved to maintenance/planning.
