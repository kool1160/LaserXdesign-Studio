# Current Project Status

## Active gate

**M13 — Windows Installer, Packaging, and Beta Hardening**

M12 merged through PR #29 in merge commit
`e950a6397ad31cf225893a7fc5f9a0704fe07e64` after final review of exact feature
head `3770ecbf9f459898a9e848b7a8e338b3c69e567d`. Issue #12 is closed as completed.
M13 is now the next milestone and Issue #13 is its delivery gate.

## Owner hold — M12 hands-on checkpoint

Do not begin M13 implementation yet. The owner explicitly requested time to run
and evaluate the exact reviewed M12 Windows build before installer and release
hardening begins.

The approved hands-on build is the artifact
`laserx-m12-windows-layered-production` from M12 workflow run `30721257565`,
artifact ID `8824972711`, produced from exact head
`3770ecbf9f459898a9e848b7a8e338b3c69e567d`. Its recorded digest is
`sha256:af0b80cc316096aefdee64bc37f5eb11d2636fb80ce7ea1ce852e2b2b6345982`.

Until the owner explicitly releases this hold, `Continue LaserX` must stop as
`BLOCKED` and report that M13 is waiting on the M12 hands-on checkpoint. Do not
open an M13 implementation branch or PR, change installer configuration, or
begin unrelated cleanup during the hold.

## M12 completion record

- [x] PR #29 reviewed on exact head and merged.
- [x] Issue #12 closed as completed.
- [x] Final reviewed head: `3770ecbf9f459898a9e848b7a8e338b3c69e567d`.
- [x] Merge commit: `e950a6397ad31cf225893a7fc5f9a0704fe07e64`.
- [x] Repository Guard run `30721257591` passed on the final head.
- [x] M04, M05, M06, M07, M08, M09, M10, M11, and M12 exact-head runs
  `30721257582`, `30721257566`, `30721257613`, `30721257599`,
  `30721257596`, `30721257570`, `30721257597`, `30721257571`, and
  `30721257565` passed.
- [x] The final reviewed suite records 270 unit/integration tests and 29 packaged
  Windows Electron E2E scenarios.
- [x] Schema v8 persists explicit manufacturing-layer metadata and true
  world-space registration-circle identities without reclassifying legacy
  editing layers.
- [x] Registration coordination preserves unrelated geometry, uses fresh target
  IDs, remains exactly undoable, survives save/reopen, and fails closed for
  stale, ambiguous, oval, skewed, or non-uniformly distorted references.
- [x] Whole-design, selection, and physical-layer cutability results retain
  truthful atomic scope through cache reuse, cancellation, failure, and bridge
  repair.
- [x] Production packages emit deterministic exact-scale SVG/DXF artifacts with
  shared origin, manifests, hashes, material notes, registration evidence,
  preview-layer exclusion, atomic staging, explicit replacement, rollback, and
  partial-failure reporting.
- [x] M14–M16 governance remains present and no M13–M16 implementation was
  included in M12.

## M13 user-visible outcome

A dependable, branded Windows beta can be installed and launched like normal
software, upgraded and uninstalled safely, recovered after common failures,
and distributed through a controlled versioned release process.

## Before M13 implementation

After the owner releases the hold, start M13 from current `main` in a new
working directory and branch. Do not reuse the M12 feature branch or worktree.

Read:

1. `AGENTS.md`
2. `docs/OPERATOR_PROTOCOL.md`
3. `docs/status/CURRENT.md`
4. `docs/milestones/M13-windows-installer-beta-hardening.md`
5. Issue #13
6. `docs/ARCHITECTURE.md`
7. `docs/FILE_FORMATS.md`
8. `docs/TESTING.md`
9. `docs/DESKTOP_DESIGN_SYSTEM.md`

## Allowed M13 work

- signed Windows installer and documented signing process;
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

Do not add major design, AI, layered-production, CAM, nesting, G-code, DWG,
machine-control, marketplace, licensing, account-platform, or stable Version
1.0 scope in M13. M14 owns real-world beta validation and the stable Version
1.0 publication decision.

## M13 exit rule

Do not advance to M14 until every M13 acceptance test and exit item passes, the
M13 pull request is reviewed on its exact final head, required CI is green, the
pull request is merged, Issue #13 is closed, and this file records the verified
merge and beta release evidence.
