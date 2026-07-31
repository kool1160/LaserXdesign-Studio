# Current Project Status

## Active gate

**M05 — Node Editing and Boolean Geometry**

M04 merged through PR #18 in merge commit
`ae693b6ff9f37a7cfdd42095d2b891b64b69fe4b` after final review of exact feature
head `a08a7afb062954782266ec572b895b21fd556b66`. Issue #5 is closed. M05 is now
the only active implementation milestone; Issue #6 is the active delivery gate.

Draft PR #20 is the active M05 implementation review gate on
`feat/m05-geometry-editing`. Initial implementation commit
`2fbf088b5d00433de258a04901ffee09a9b82674` passes the complete local gate with
108 unit/integration tests and 15 packaged Windows E2E scenarios. Required
final-head GitHub workflows and independent golden-fixture review are still
pending. Keep the PR draft and do not merge, close Issue #6, or advance to M06.

Before implementation, read:

1. `AGENTS.md`
2. `docs/OPERATOR_PROTOCOL.md`
3. `docs/status/CURRENT.md`
4. `docs/milestones/M05-geometry-editing.md`
5. `docs/ARCHITECTURE.md`
6. `docs/UNITS_AND_COORDINATES.md`
7. `docs/FILE_FORMATS.md`
8. `docs/TESTING.md`
9. ADRs 0012–0013

## M04 completion record

- [x] PR #18 reviewed and merged.
- [x] Issue #5 closed as completed.
- [x] Final reviewed head: `a08a7afb062954782266ec572b895b21fd556b66`.
- [x] Merge commit: `ae693b6ff9f37a7cfdd42095d2b891b64b69fe4b`.
- [x] Repository Guard run `30621907380` passed on the final head.
- [x] Windows M04 push run `30621903965` and pull-request run
  `30621907281` passed on the final head.
- [x] The final suite records 86 unit/integration tests and 13 packaged Electron
  E2E tests.
- [x] Secure installed-font discovery, six audited bundled font families,
  editable text, spacing and arc layout, missing-font geometry preservation,
  deterministic per-glyph compound fill semantics, schema-v4 persistence, and
  undoable outline conversion are complete and reviewed.
- [x] Same-ID font changes cannot silently rematerialize saved geometry, glyph
  overlaps remain filled while counters remain empty, and undo/redo keeps the
  text panel synchronized with authoritative document intent.
- [x] No M05+ node editing, boolean, offset, or topology-changing production
  functionality was included in M04.

## Prior milestones

M03 was merged through PR #16 in merge commit
`e35881d57a7067c075e0f256663e1608c6e4631e`. The final reviewed feature head
was `1e40fc3ad1e865ab79df89c76a50fe6848352115`.

M02 was merged through PR #15 in commit
`735c3ce658313a5c8ca35be3c95f0d70021d8c11`. The final reviewed feature head
was `1b9bd6623a0e2fdcd38523b4d9e91418d5beb39e`.

M01 was merged through PR #14 in commit
`7a534e9a5424a8dfd17107f398dcd15332720f3f`. M00 remains complete in commit
`683a0aff72671a76b1e5ac7b366069d4cd0a29d2`.

## M05 user-visible outcome

Users can directly repair and reshape vector artwork inside LaserX without
returning to a separate CAD/vector program for routine cleanup.

## Allowed M05 work

- node and segment selection;
- add, delete, and move nodes;
- line and supported curve handles;
- open and close paths;
- join endpoints with tolerance preview;
- split paths and segments;
- reverse path direction;
- simplify with adjustable tolerance and before/after node counts;
- union, subtract, intersect, and exclude/XOR where the selected engine supports
  them reliably;
- inward and outward offsets;
- contour cleanup and self-intersection reporting;
- a replaceable geometry-engine adapter with license and performance review;
- cancellable worker execution for expensive operations;
- topology-change summaries and undo transactions;
- persistence, invariant, golden-fixture, integration, and packaged Windows E2E
  coverage required by the milestone.

## Explicitly excluded

Do not implement full CAD trim/extend parity, parametric constraints,
fillet/chamfer unless separately accepted, CAM kerf compensation, nesting,
SVG/DXF import/export, raster tracing, cutability decisions, layered production
export, AI generation, CAM, G-code, or DWG.

## M05 exit rule

Do not advance to M06 until every acceptance test and exit item in
`docs/milestones/M05-geometry-editing.md` passes, the M05 pull request is
reviewed, required Windows CI is green, the pull request is merged, Issue #6 is
closed, and this file records the verified merge commit.
