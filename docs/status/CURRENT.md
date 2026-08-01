# Current Project Status

## Active gate

**M12 — Layered Sign Workflow and Production Export**

M11 merged through PR #28 in merge commit
`0aca18b616ce7db359c4ad4aa5e4267aef05103e` after final review of exact feature
head `cef44b91abadf04b3a5dd17afd41557085c4edea`. Issue #26 is closed as completed.
M12 is now the only active implementation milestone; Issue #12 is the active
delivery gate.

Start M12 from current `main` in a new working directory and branch
`feat/m12-layered-production`. Do not reuse the M11 feature branch or worktree.

Before implementation, read:

1. `AGENTS.md`
2. `docs/OPERATOR_PROTOCOL.md`
3. `docs/status/CURRENT.md`
4. `docs/milestones/M12-layered-production.md`
5. `docs/ARCHITECTURE.md`
6. `docs/FILE_FORMATS.md`
7. `docs/CUTABILITY_RULES.md`
8. `docs/TESTING.md`
9. `docs/DESKTOP_DESIGN_SYSTEM.md`

## M11 completion record

- [x] PR #28 reviewed and merged.
- [x] Issue #26 closed as completed.
- [x] Final reviewed head: `cef44b91abadf04b3a5dd17afd41557085c4edea`.
- [x] Merge commit: `0aca18b616ce7db359c4ad4aa5e4267aef05103e`.
- [x] Repository Guard run `30708105410` passed on the final head.
- [x] M04, M05, M06, M07, M08, M09, M10, and M11 exact-head runs
  `30708105422`, `30708105411`, `30708105430`, `30708105429`,
  `30708105443`, `30708105413`, `30708105409`, and `30708105474` passed.
- [x] The final reviewed suite records 252 unit/integration tests and 28 packaged
  Windows Electron E2E scenarios.
- [x] The desktop identity now matches the approved LaserX Design website through
  documented tokens, engineered-X assets, typography, navigation hierarchy,
  square industrial controls, responsive layouts, high-DPI behavior, visible
  focus, reduced-motion support, and non-color-only state communication.
- [x] New Design, Open Project, Import Artwork, Trace Image, Save, and Export are
  visually and semantically distinct.
- [x] Geometry, project schema, import/export, cutability, AI, credentials,
  security, undo/redo, and persistence semantics remain unchanged.
- [x] No M12 layered production, M13 installer/release, CAM, nesting, G-code,
  DWG, or machine-control work was included in M11.

## M12 user-visible outcome

Users can organize explicitly declared face, backing, spacer, drill/reference,
and non-cut manufacturing layers, preview how those pieces align, and export a
clean exact-scale production package with one validated file per selected layer.

## Allowed M12 work

- semantic manufacturing-layer metadata for face, backing, spacer/tab,
  drill/reference, and non-cut preview roles;
- material, thickness, and process metadata on explicitly declared manufacturing
  layers;
- separate cutability analysis for explicitly scoped manufacturing layers while
  preserving the existing whole-design M08 analysis path;
- face/backing alignment and registration-hole coordination;
- simple 2D exploded or stacked assembly preview, not full 3D CAD;
- deterministic production-package naming and folder rules;
- one DXF and/or SVG per selected manufacturing layer at exact scale and shared
  origin;
- manifest containing dimensions, units, material notes, warnings, source
  project version, files, and bounds;
- optional assembly preview image/PDF only through a documented safe exporter;
- overwrite/conflict handling, partial-failure reporting, and export validation;
- persistence, migration, golden fixtures, integration tests, and packaged
  Windows E2E evidence required by the milestone.

## Architecture boundary

Ordinary editing layers do not automatically become physical manufacturing
pieces. Independent layer analysis and export apply only to layers explicitly
marked with manufacturing metadata. Standard whole-design M08 semantics remain
available and unchanged. All generated production files must retain canonical
millimeter geometry, explicit units, exact shared origin, and deterministic
manifest/file relationships.

## Explicitly excluded

Do not implement full 3D rendering, bend design, weld symbols, BOM/ERP,
quoting, nesting, CAM sequencing, G-code, DWG, machine control, marketplace,
installer/release work, or unrelated major feature expansion.

## M12 exit rule

Do not advance to M13 until every acceptance test and exit item in
`docs/milestones/M12-layered-production.md` passes, the M12 pull request is
reviewed, required Windows CI is green, the pull request is merged, Issue #12 is
closed, and this file records the verified merge commit.
