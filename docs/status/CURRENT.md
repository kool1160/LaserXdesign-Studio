# Current Project Status

## Active gate

**M13 — Windows Installer, Packaging, and Beta Hardening**

M12 merged through PR #29 in merge commit
`e950a6397ad31cf225893a7fc5f9a0704fe07e64` after final review of exact feature
head `3770ecbf9f459898a9e848b7a8e338b3c69e567d`. Issue #12 is closed as completed.
M13 is active and Issue #13 is its delivery gate.

## Hold released — hands-on repair gate active

The owner released the M12 hands-on hold on 2026-08-02.

Do **not** begin installer implementation first. The first mandatory M13 slice is
the owner-observed hands-on repair prerequisite documented in
`docs/milestones/M13-windows-installer-beta-hardening.md` and Issue #13.

That repair slice must be implemented from current `main` in a new working
directory and branch, reviewed on its exact final head, pass required Windows
CI, and merge before installer/signing work begins.

### Required repair outcomes

1. **DXF import repair and stock fitting**
   - convert supported DXF spline geometry into bounded editable paths instead
     of silently skipping it;
   - present actionable, geometry-linked import findings and previewable repair
     proposals;
   - cover zero-length segments, duplicate consecutive nodes, exact duplicates,
     nearly coincident endpoints, and almost-closed contours;
   - offer `Resize stock to fit artwork`, `Scale artwork to current stock`, and
     `Keep current stock and artwork size`;
   - default oversized imports to stock resize with explicit margin, preserved
     source scale, centered artwork, and viewport fit;
   - never silently scale or discard manufacturing geometry while claiming a
     complete import.

2. **U.S. stock thickness workflow**
   - material-specific sheet gauges;
   - common fractional-inch plate choices;
   - millimeter and custom values;
   - visible shop designation plus inch and millimeter equivalents;
   - canonical `thicknessMm` for calculations;
   - persisted stock designation in project data and production manifests
     through a documented migration;
   - legacy projects remain valid without an invented designation.

3. **Packaged AI credential connection**
   - replace the indefinitely awaited hidden PowerShell prompt with a visible,
     application-owned secure Windows interaction;
   - provide cancel, timeout, retry, and clear failure behavior;
   - restore controls and prior connection state after cancellation or failure;
   - retain the operating-system encryption and secret-isolation boundary;
   - prove through packaged Windows coverage that connection cannot leave the
     application globally busy indefinitely.

## M12 hands-on evidence

The approved checkpoint build was the artifact
`laserx-m12-windows-layered-production` from M12 workflow run `30721257565`,
artifact ID `8824972711`, produced from exact head
`3770ecbf9f459898a9e848b7a8e338b3c69e567d`. Its recorded digest is
`sha256:af0b80cc316096aefdee64bc37f5eb11d2636fb80ce7ea1ce852e2b2b6345982`.

The owner observed:

- DXF spline entities were skipped with no repair path;
- imported artwork could extend far outside the fixed 12 × 12 inch stock with
  no stock-fitting decision;
- shop-facing thickness selection exposed millimeters rather than U.S. gauge
  and fractional-inch stock;
- `Connect existing key` could remain in a global busy state for more than one
  minute because the external credential prompt did not complete visibly.

These are release-blocking manufacturing or severe usability defects for the
M13 beta gate.

## M12 completion record

- [x] PR #29 reviewed on exact head and merged.
- [x] Issue #12 closed as completed.
- [x] Final reviewed head: `3770ecbf9f459898a9e848b7a8e338b3c69e567d`.
- [x] Merge commit: `e950a6397ad31cf225893a7fc5f9a0704fe07e64`.
- [x] Repository Guard run `30721257591` passed on the final head.
- [x] M04 through M12 exact-head workflows passed.
- [x] The final reviewed suite records 270 unit/integration tests and 29 packaged
  Windows Electron E2E scenarios.
- [x] Schema v8 manufacturing-layer, registration-circle, scoped-analysis, and
  deterministic production-package behavior merged without M13–M16
  implementation.

## Before implementation

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
10. relevant DXF, project-format, manufacturing, and AI credential ADRs/tests

Use a new branch such as:

`fix/m13-hands-on-repair-gate`

Do not reuse the M12 branch or worktree.

## Installer work remains sequenced behind the repair gate

After the hands-on repair PR is independently reviewed and merged, continue the
remaining M13 installer, packaging, recovery, performance, accessibility,
security, migration, and beta-release work from current `main` in a new branch.

## Explicitly excluded

The repair gate does not authorize broad CAD, universal file-format support,
DWG, general-purpose materials databases, new AI providers, 3D implementation,
CAM, nesting, G-code, machine control, marketplace, licensing, or unrelated
cleanup. M14 owns the approved physical 3D sign viewer and stable Version 1.0
release work.

## M13 exit rule

Do not advance to M14 until the hands-on repair prerequisite and every remaining
M13 acceptance item pass, the final M13 pull request is reviewed on its exact
head, required CI is green, all required M13 work is merged, Issue #13 is
closed, and this file records the verified beta release evidence.
