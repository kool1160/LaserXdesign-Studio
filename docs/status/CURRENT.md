# Current Project Status

## Active gate

**M09 — Sign-Building Tools and Templates**

M08 merged through PR #24 in merge commit
`3edea67fa6170aa37624352d7eae141590fc35ed` after final review of exact feature
head `c3068c2591cae93ef00434bd05e7b16850e32121`. Issue #9 is closed as completed.
M09 is now the only active implementation milestone; Issue #10 is the active
delivery gate.

The M09 implementation candidate is isolated on `feat/m09-sign-tools`, based
on current `main`. The repaired complete local gate passes with 232 unit/integration
tests and 25 packaged Windows E2E scenarios. Keep the candidate on that branch;
do not merge, close Issue #10, or advance status to M10 before independent
review and required exact-head Windows CI pass.

Before implementation, read:

1. `AGENTS.md`
2. `docs/OPERATOR_PROTOCOL.md`
3. `docs/status/CURRENT.md`
4. `docs/milestones/M09-sign-tools.md`
5. `docs/CUTABILITY_RULES.md`
6. `docs/ARCHITECTURE.md`
7. `docs/UNITS_AND_COORDINATES.md`
8. `docs/FILE_FORMATS.md`
9. `docs/TESTING.md`
10. ADR 0020 and prior geometry/interchange/font ADRs

## M08 completion record

- [x] PR #24 reviewed and merged.
- [x] Issue #9 closed as completed.
- [x] Final reviewed head: `c3068c2591cae93ef00434bd05e7b16850e32121`.
- [x] Merge commit: `3edea67fa6170aa37624352d7eae141590fc35ed`.
- [x] Repository Guard run `30675370164` passed on the final head.
- [x] M04, M05, M06, M07, and M08 exact-head runs `30675370171`,
  `30675370177`, `30675370183`, `30675370188`, and `30675370189` passed.
- [x] The final suite records 219 unit/integration tests and 22 packaged Windows
  Electron E2E scenarios.
- [x] Deterministic cutability analysis, region classification, ambiguity
  handling, measured/configured issue evidence, manual and automatic bridge
  previews, one-command repair acceptance, cache invalidation, cancellation,
  and stale-result rejection are complete and reviewed.
- [x] Cubic and ellipse flattening preserve the 0.01 mm world-space tolerance
  under large uniform scale, nonuniform scale, shear, and nested transforms.
- [x] No M09 sign generators, templates, M10 AI generation, CAM, G-code, DWG,
  or machine-control work was included in M08.

## M09 user-visible outcome

Common signs can be built quickly without drawing every helper feature manually.

## M09 implementation candidate

- [x] Pure bounded border, backing-plate, seven-shape, mounting-hole, and
  sign-assembly generators emit ordinary editable document objects.
- [x] Baseline/arc text helpers and four parameterized template models use
  audited bundled style/font provenance.
- [x] Preview/reject is non-mutating; acceptance is one undoable import; saved
  version-1 template parameters persist through strict schema v7 and v6-to-v7
  migration.
- [x] Main-owned font layout and generation accept only strict renderer
  parameters. Acceptance and Analyze all run one standard whole-design M08
  scope; only explicit selected object IDs narrow analysis.
- [x] Representative packaged 24-inch badge, address, and family-name flows
  validate, export, persist/reopen a user template, and undo exactly.
- [ ] PR #25 requires exact-head re-review and Windows CI on the repair.

## Allowed M09 work

- outline and border generation around selected geometry;
- backing-plate generation;
- rectangle, rounded rectangle, circle, oval, shield, badge, and banner outer
  shapes;
- exact mounting-hole patterns;
- tabs and slots limited to sign assembly;
- baseline and arc text-layout helpers;
- monogram, address, family-name, and badge template parameter models;
- licensed style presets with provenance records;
- save-user-template workflow;
- ordinary editable output through one undoable command;
- validation through the standard M08 cutability engine;
- documented template schema/versioning;
- persistence, migration, export, licensing, integration, and packaged Windows
  E2E coverage required by the milestone.

## Explicitly excluded

Do not implement a marketplace, copyrighted-logo library, full mechanical-joint
design, advanced nesting, locked template output, M10 AI generation, CAM,
G-code, DWG, or machine control.

## M09 exit rule

Do not advance to M10 until every acceptance test and exit item in
`docs/milestones/M09-sign-tools.md` passes, the M09 pull request is reviewed,
required Windows CI is green, the pull request is merged, Issue #10 is closed,
and this file records the verified merge commit.
