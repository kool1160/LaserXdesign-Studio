# Current Project Status

## Active gate

**M08 — Cutability Analysis, Bridges, and Manufacturing Preview**

M07 merged through PR #23 in merge commit
`ae955364dcbd5443ab4c9baff39941f423d536f6` after final review of exact feature
head `144a44532f36f2d8453fde60d61836301b3ec133`. Issue #8 is closed as completed.
M08 is now the only active implementation milestone; Issue #9 is the active
delivery gate.

Start M08 from current `main` in a new working directory and branch
`feat/m08-cutability`. Do not reuse the M07 feature branch or worktree.

Before implementation, read:

1. `AGENTS.md`
2. `docs/OPERATOR_PROTOCOL.md`
3. `docs/status/CURRENT.md`
4. `docs/milestones/M08-cutability.md`
5. `docs/CUTABILITY_RULES.md`
6. `docs/ARCHITECTURE.md`
7. `docs/UNITS_AND_COORDINATES.md`
8. `docs/TESTING.md`
9. ADR 0019 and prior geometry/interchange ADRs

## M07 completion record

- [x] PR #23 reviewed and merged.
- [x] Issue #8 closed as completed.
- [x] Final reviewed head: `144a44532f36f2d8453fde60d61836301b3ec133`.
- [x] Merge commit: `ae955364dcbd5443ab4c9baff39941f423d536f6`.
- [x] Repository Guard run `30661012512` passed on the final head.
- [x] M04, M05, M06, and M07 exact-head runs `30661012433`, `30661013654`,
  `30661014745`, and `30661012426` passed.
- [x] The final suite records 194 unit/integration tests and 20 packaged Electron
  E2E scenarios.
- [x] Bounded PNG/JPEG inspection and main-process decoding, deterministic
  preprocessing, replaceable tracing, whole-operation cancellation and timeout,
  atomic preview publication, stale-result rejection, and one-command editable
  path acceptance are complete and reviewed.
- [x] Real PNG/JPEG fixtures, noisy grayscale, antialiased text, and a
  high-resolution downsample fixture are pinned with exact evidence.
- [x] Accepted traces enter the standard analysis boundary without a cut-ready
  claim.
- [x] No M08 bridge, retained/drop-out classification, or manufacturing-preview
  implementation was included in M07.

## Prior milestones

M06 merged through PR #21 in merge commit
`d38832446ce43df4c5fb2c620ee70fa556de056e`.

M05 merged through PR #20 in merge commit
`27cfe2b0c2ae8fcfe365ee2338ad65e764c2de08`.

M04 merged through PR #18 in merge commit
`ae693b6ff9f37a7cfdd42095d2b891b64b69fe4b`.

M03 merged through PR #16 in merge commit
`e35881d57a7067c075e0f256663e1608c6e4631e`.

M02 merged through PR #15 in commit
`735c3ce658313a5c8ca35be3c95f0d70021d8c11`.

M01 merged through PR #14 in commit
`7a534e9a5424a8dfd17107f398dcd15332720f3f`. M00 remains complete in commit
`683a0aff72671a76b1e5ac7b366069d4cd0a29d2`.

## M08 user-visible outcome

The program explains what will fall out or fail to cut, highlights the exact
problem, proposes bridges or repairs, and shows retained metal versus removed
regions.

## Allowed M08 work

- process/material/thickness preset model with editable values;
- kerf, minimum feature, minimum bridge, minimum gap, and contour-spacing
  settings;
- issue classes defined in `docs/CUTABILITY_RULES.md`;
- issue list, severity, canvas highlighting, filtering, and navigation;
- region containment and retained/drop-out classification;
- open, duplicate, overlapping, and self-intersecting geometry detection;
- island and enclosed-dropout detection;
- narrow-feature, gap, and bridge detection;
- basic kerf-collapse risk approximation with explicit limits;
- manual bridge tool;
- automatic bridge proposals with preview and undo;
- manufacturing preview mode;
- analysis cache invalidation tied to document commands;
- disclaimer and machine-setting transparency;
- rule, fixture, integration, persistence, and packaged Windows E2E coverage
  required by the milestone.

## Explicitly excluded

Do not implement G-code, lead-ins, cut order, heat simulation, guaranteed
manufacturability, authoritative machine process tables, M09 sign tools, AI,
CAM, DWG, or machine control.

## M08 exit rule

Do not advance to M09 until every acceptance test and exit item in
`docs/milestones/M08-cutability.md` passes, the M08 pull request is reviewed,
required Windows CI is green, the pull request is merged, Issue #9 is closed,
and this file records the verified merge commit.
