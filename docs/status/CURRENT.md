# Current Project Status

## Active gate

**M04 — Text, Fonts, and Outline Conversion**

M03 merged through PR #16 in merge commit
`e35881d57a7067c075e0f256663e1608c6e4631e` after final review of exact feature
head `1e40fc3ad1e865ab79df89c76a50fe6848352115`. Issue #4 is closed. M04 is now
the only active implementation milestone; Issue #5 is the active delivery gate.

Start M04 from current `main` in a new working directory and branch
`feat/m04-text-fonts`. Do not reuse the M03 feature branch or worktree.

Before implementation, read:

1. `AGENTS.md`
2. `docs/OPERATOR_PROTOCOL.md`
3. `docs/status/CURRENT.md`
4. `docs/milestones/M04-text-fonts.md`
5. `docs/ARCHITECTURE.md`
6. `docs/UNITS_AND_COORDINATES.md`
7. `docs/FILE_FORMATS.md`
8. `docs/TESTING.md`
9. ADRs 0010–0011

## M03 completion record

- [x] PR #16 reviewed and merged.
- [x] Issue #4 closed as completed.
- [x] Final reviewed head: `1e40fc3ad1e865ab79df89c76a50fe6848352115`.
- [x] Merge commit: `e35881d57a7067c075e0f256663e1608c6e4631e`.
- [x] Repository Guard run `30595804659` passed on the final head.
- [x] Windows pull-request M03 Editing Core run `30595804581` passed on the
  final head.
- [x] The final suite records 74 unit/integration tests and 10 packaged Electron
  E2E tests.
- [x] Selection, transforms, grouping, layers, guides, snapping, clipboard,
  bounded transactional undo/redo, schema-v3 persistence, deterministic v1/v2
  migration, signed/zero exact bounds, aspect locking, pan precedence, and snap
  candidate precedence are complete and reviewed.
- [x] No M04+ production text/font functionality was included in M03.

## Prior milestones

M02 was merged through PR #15 in commit
`735c3ce658313a5c8ca35be3c95f0d70021d8c11`. The final reviewed feature head
was `1b9bd6623a0e2fdcd38523b4d9e91418d5beb39e`.

M01 was merged through PR #14 in commit
`7a534e9a5424a8dfd17107f398dcd15332720f3f`. M00 remains complete in commit
`683a0aff72671a76b1e5ac7b366069d4cd0a29d2`.

## M04 user-visible outcome

Users can create professional sign lettering, browse fonts, adjust layout, and
convert text into editable cut geometry without losing exact scale.

## Allowed M04 work

- text objects with content, font family/style, size, alignment, line spacing,
  and tracking;
- installed-system-font discovery through a secure boundary;
- bundled-font catalog with license metadata and attribution;
- favorites, recent fonts, search, and sign-style categories based on metadata
  rather than unlicensed copying;
- live text editing;
- letter, word, and line spacing;
- text on a simple arc or path;
- text-to-outline conversion;
- optional preservation of original editable text as hidden/source data;
- missing-font handling and substitution preview;
- font-license audit tooling and CI enforcement;
- representative redistributable stencil, script, serif, slab, western,
  industrial, and display fixtures;
- persistence, migration, undo/redo, invariant, integration, and packaged
  Windows E2E coverage required by the milestone.

## Explicitly excluded

Do not implement automatic bridge placement, advanced typography-engine parity,
commercial font bundling, logo libraries, AI generation, node editing,
booleans, offsets, SVG/DXF import/export, raster tracing, cutability decisions,
layered production export, CAM, G-code, or DWG.

## M04 exit rule

Do not advance to M05 until every acceptance test and exit item in
`docs/milestones/M04-text-fonts.md` passes, the M04 pull request is reviewed,
required Windows CI is green, the pull request is merged, Issue #5 is closed,
and this file records the verified merge commit.

## M04 implementation review state

The `feat/m04-text-fonts` implementation is complete locally and awaiting pull
request review. It includes secure installed-font discovery, six audited
redistributable bundled families, editable/live text layout, arc text, path conversion
with optional source preservation, missing-font geometry preservation, and
schema-v4 persistence/migration.

Local `pnpm verify`, the font audit, repository guard, and `git diff --check`
pass with 85 unit/integration tests and 12 packaged Windows E2E scenarios.
M04 remains the active gate. Do not advance to M05, merge the pull request, or
close Issue #5 until review and final-head Windows CI are complete.
