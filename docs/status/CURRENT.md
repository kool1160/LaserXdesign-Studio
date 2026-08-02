# Current Project Status

## Active gate

**M13 — Windows Installer, Packaging, and Beta Hardening**

Issue #13 remains the active delivery gate. M13 is not complete and M14 is not
active.

## Hands-on repair prerequisite — completed

The owner-observed repair prerequisite was independently reviewed and merged
through PR #32.

- Final reviewed head: `5fb466f1d1c784c4d2d2bc14aab6f5167793b150`
- READY review: `4839027689`
- Merge commit: `a58eb7049349c02522c4caea05d59c17f54992fe`
- Repository Guard run: `30754236851`
- M04–M12 exact-head workflows: all completed successfully
- Unit/integration tests: 288
- Packaged Windows Electron E2E scenarios: 31/31
- Exact-head Windows artifact: `8835466777`
- Artifact digest:
  `sha256:d590340d837089c6a301788808a9e119659e4df2fe89a7ec6a024363399a78fc`

The merged prerequisite delivers:

1. bounded, fail-closed DXF spline conversion, explicit partial-import findings,
   previewable deterministic repairs, all three stock-fit choices, initial
   viewport framing, and one undoable import/stock transaction;
2. material-specific U.S. gauges, fractional-inch, metric, and custom stock
   designations with inch/mm context, canonical `thicknessMm`, schema-v9
   persistence, no-inference legacy migration, and production-manifest v2;
3. a focused application-owned credential modal with cancel, timeout, retry,
   prior-state restoration, Windows `safeStorage`, and packaged proof that the
   application cannot remain globally busy indefinitely.

Issue #13 intentionally remains open because installer, signing, packaging,
recovery, performance, accessibility, security, migration, and controlled beta
release work are still outstanding.

## Remaining M13 work — authorized

The remaining M13 implementation may now begin from current `main` in a fresh
working directory and branch. Do not reuse PR #32's branch or worktree.

Suggested branch:

`feat/m13-windows-installer-beta`

Read before implementation:

1. `AGENTS.md`
2. `docs/OPERATOR_PROTOCOL.md`
3. `docs/status/CURRENT.md`
4. `docs/milestones/M13-windows-installer-beta-hardening.md`
5. Issue #13
6. `docs/ARCHITECTURE.md`
7. `docs/FILE_FORMATS.md`
8. `docs/TESTING.md`
9. `docs/DESKTOP_DESIGN_SYSTEM.md`
10. `docs/SECURITY.md`
11. relevant packaging, release, migration, recovery, and credential ADRs/tests

## Allowed M13 work

- signed Windows `.exe` installer and documented signing process;
- Start Menu and optional desktop shortcuts;
- clean uninstall and explicit user-data behavior;
- Windows-owned storage for app data, credentials, autosaves, logs, caches, and
  settings;
- product metadata, semantic versioning, changelog, and release notes;
- versioned artifacts, provenance, checksums, and reproducible-build evidence;
- clean install, launch, upgrade, primary-workflow, and uninstall validation;
- crash handling and recoverable sessions;
- startup, viewport, selection, tracing, geometry, analysis, save, and export
  performance budgets;
- cancellation, progress, memory, accessibility, high-DPI, security,
  dependency, migration, and beta feedback gates;
- telemetry/crash-reporting decision with explicit privacy behavior;
- optional auto-update only if separately accepted.

## Explicitly excluded

Do not add broad CAD, universal file-format support, DWG, general-purpose
materials databases, new AI providers, physical 3D implementation, CAM,
nesting, G-code, machine control, marketplace, licensing, account-platform, or
unrelated feature expansion. M14 owns the approved physical 3D sign viewer,
real-world beta validation, and stable Version 1.0 publication decision.

## M13 exit rule

Do not advance to M14 until every remaining M13 acceptance item passes, the
final M13 pull request is reviewed on its exact head, required CI is green, all
required M13 work is merged, Issue #13 is closed, the controlled beta is tagged
and published, and this file records the verified installer and release
evidence.
