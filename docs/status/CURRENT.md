# Current Project Status

## Active gate

**M03 — Selection, transforms, layers, and history**

M03 is the only active implementation milestone. Its complete local
implementation is on `feat/m03-editing-core`; it is not yet merged. M04 remains
blocked until the M03 draft pull request is reviewed, all required Windows CI
checks pass, and the pull request is merged.

## Prior milestones

M02 was merged through PR #15 in commit
`735c3ce658313a5c8ca35be3c95f0d70021d8c11`. Repository Guard and the Windows
M02 workflow passed. The final reviewed feature head was
`1b9bd6623a0e2fdcd38523b4d9e91418d5beb39e`.

M01 was merged through PR #14 in commit
`7a534e9a5424a8dfd17107f398dcd15332720f3f`. M00 remains complete in commit
`683a0aff72671a76b1e5ac7b366069d4cd0a29d2`.

## M03 local completion record

- [x] Single, modifier-key multi, and marquee selection use domain hit testing.
- [x] Pointer, keyboard, toolbar, menu, and inspector actions share one
  validated application command boundary.
- [x] Move, exact position/size, scale, rotate, mirror, duplicate, delete,
  transform handles, and aspect locking are implemented.
- [x] Align/distribute, group/ungroup, object z-order, guides, and basic grid,
  guide, document, bounds, and center snapping are implemented.
- [x] Ordered layers persist visibility, locking, names, active state, and
  reorder behavior; hidden/locked objects cannot be selected or edited.
- [x] In-application copy/paste and duplicate allocate fresh UUIDs according to
  ADR 0010.
- [x] Undo/redo is deterministic, transaction-aware, and bounded to 100 entries
  by default; representative 100-step replay is directly tested.
- [x] Schema v3 deterministically preserves layers, guides, recursive groups,
  affine transforms, object/layer order, locks, visibility, IDs, and viewport
  preferences.
- [x] Schema-v1 and schema-v2 projects migrate through explicit reviewed
  fixtures; corrupt and unsupported data are rejected safely.
- [x] Full editing state saves and reopens in integration and packaged Windows
  tests.
- [x] React arbitrary-mutation regression and pointer/keyboard command
  equivalence are directly tested.
- [x] 63 unit/integration tests and 7 packaged Electron E2E tests pass locally.
- [x] ADRs 0010–0011 and architecture, units, format, testing, risk, fixture,
  screenshot, changelog, and work-log documentation are updated.
- [ ] Draft pull request reviewed.
- [ ] Repository Guard and Windows M03 Editing Core CI green on the published
  feature head.
- [ ] Pull request merged and Issue #4 closed.

## M03 scope restraint

No production text/fonts, node editing, booleans, offsets, SVG/DXF,
raster tracing, cutability, bridges, sign generators, AI, layered production
export, CAM, G-code, or DWG support was added.

## Next allowed work

The exact next milestone is M04 — Text, fonts, and outline conversion, but it
must not start yet. M04 becomes allowed only after the M03 pull request is
reviewed, required CI is green, the pull request is merged, and this status file
is updated with the verified merge commit.
