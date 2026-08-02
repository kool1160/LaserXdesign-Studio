# Claude Contract — Physical 3D Preview Lab

## Authorized role

The owner explicitly authorizes Claude to implement the isolated physical 3D preview research described by GitHub Issue #34 and:

`docs/experiments/m14-physical-3d-preview/PROJECT_BRIEF.md`

This subtree-specific authorization supplements the root `CLAUDE.md` audit charter. It does not override `AGENTS.md`, `docs/OPERATOR_PROTOCOL.md`, the active M13 gate, or repository safety rules.

Claude may edit and commit only within the experiment branch:

`experiment/m14-physical-3d-preview-lab`

Primary owned paths:

- `apps/physical-3d-preview-lab/**`
- `packages/physical-preview-3d/**`
- `docs/experiments/m14-physical-3d-preview/**`
- `fixtures/physical-preview/**`

Changes outside those paths require a written interface proposal and owner approval before editing.

## First instruction

Before implementation:

1. Read the complete root `CLAUDE.md` and `AGENTS.md`.
2. Read the project brief completely.
3. Fetch current Issue #34, Issue #30, Issue #13, and `docs/status/CURRENT.md`.
4. Inspect the current schema, manufacturing-layer, material/thickness, contour, cutability, and production-export contracts.
5. Write `ENGINE_DECISION.md` before installing major 3D/CAD dependencies.

Do not rely on old M03/schema-v3 context.

## Build authority

Claude is authorized to:

- create the pure `packages/physical-preview-3d` experiment;
- create the standalone `apps/physical-3d-preview-lab` React/Vite application;
- select an established rendering library after the required evaluation;
- install experiment dependencies on this branch;
- add experiment fixtures, tests, screenshots, measurements, and reports;
- commit and push focused changes to the experiment branch;
- open a clearly labeled experimental draft PR only after the evidence package is complete.

Claude is not authorized to:

- modify or merge active M13 work;
- activate M14;
- modify `docs/status/CURRENT.md`;
- change the project schema;
- alter production geometry, exports, cutability evidence, recovery, installer, signing, or release behavior;
- build a custom renderer or CAD kernel;
- implement general-purpose 3D CAD, solid editing, CAM, or machine control;
- merge automatically.

## Required working behavior

- Use existing LaserX source-of-truth types and algorithms rather than copying them.
- Keep authoritative conversion logic out of React.
- Keep Three.js or any renderer dependency out of the pure preview package.
- Treat the source project as immutable.
- Fail visibly for unsupported or ambiguous geometry.
- Add regression tests with every correctness repair.
- Preserve exact millimeter dimensions and exact normalized thickness.
- Report assumptions and unverified behavior honestly.

## Credit-efficient execution

Work in phases. Finish and summarize one phase before expanding the next.

Use Sonnet-class implementation for normal coding and tests. Reserve the highest-capability model for:

- architecture and engine selection;
- contour/hole correctness disputes;
- difficult performance or determinism failures;
- final adversarial review.

Do not spend credits generating broad CAD features outside Issue #34.

## Session start

When the owner starts Claude in this folder, begin with:

1. current branch and worktree verification;
2. live gate verification;
3. required-reading completion;
4. Phase 0 engine and architecture audit;
5. a concise report of the exact first implementation slice.

Do not begin coding until those steps are complete.
