# Contributing

## Before changing code

1. Read `AGENTS.md`.
2. Read `docs/OPERATOR_PROTOCOL.md`.
3. Read `docs/status/CURRENT.md`.
4. Read the active milestone specification.
5. Read the active GitHub issue and any open PR/review threads for it.
6. Inspect related tests and ADRs.
7. Confirm the task is inside the active milestone.

Milestones are gates, not suggestions. Do not begin later work because it appears convenient.

## Operator-driven workflow

The normal owner/agent loop is:

1. Product decisions are discussed with `Plan LaserX: <idea>`.
2. Accepted decisions are written to GitHub with `Lock that into LaserX`.
3. Codex receives `Continue LaserX` and determines whether to implement, repair review findings, or repair CI from repository state.
4. Codex keeps the PR draft, updates detailed evidence there, and stops for review.
5. The review chat receives `Check LaserX`, reviews the actual PR, and posts detailed findings on GitHub.
6. A `REPAIR` verdict returns to Codex through `Continue LaserX`.
7. A `READY` verdict may be completed with `Advance LaserX`.

The owner should not have to paste Codex completion reports into the review chat or request a new milestone markdown handoff after every gate.

## Branches

Start every milestone or focused repair from the current required base in a clean working directory. Never reuse an old milestone working directory as the permanent repository.

Use short descriptive names such as:

- `feat/m04-text-fonts`
- `fix/dxf-scale-roundtrip`
- `docs/operator-protocol`

Do not begin the next milestone on the current milestone branch.

## Commits

Prefer focused conventional commits:

- `feat: add document resize command`
- `fix: preserve inch scale during DXF export`
- `test: add nested-island cutability fixture`
- `docs: record tracing tolerance decision`

## Pull requests

Keep milestone and repair PRs draft while implementation, CI repair, or review fixes are active.

Describe:

- active milestone;
- user-visible result;
- included and explicitly excluded scope;
- architectural changes and ADRs;
- tests run and exact results;
- required GitHub workflow state on the final pushed head;
- screenshots for meaningful UI changes;
- fixture/golden changes;
- known limitations;
- operator state and exact next command.

Detailed implementation evidence belongs in the PR. The owner-facing handoff should remain compact.

## Review protocol

A reviewer must inspect the active issue, exact PR head, diff, tests, fixtures, migrations, documentation, review threads, and required workflow results.

Detailed findings belong on GitHub. The normal chat verdict is only:

```text
LaserX M## PR #__ - READY | REPAIR | BLOCKED
CI: green | failing | running
Finding: none | <one or two short blocking reasons>
Next command: Advance LaserX | Continue LaserX | Plan LaserX: <decision needed>
```

Do not merge from a stale reviewed head. Do not report success from local tests alone when GitHub workflows are required.

## Milestone advancement

`Advance LaserX` is valid only after a `READY` verdict and a final verification that:

- the reviewed head has not changed;
- required CI is green;
- no blocking review thread remains;
- milestone acceptance and exit criteria are satisfied.

Advancement must merge the established way, confirm issue closure, update `docs/status/CURRENT.md` with the exact merge record, activate the next issue, and stop before implementing it.

## Dependency changes

Explain why a dependency is required, its license, maintenance status, bundle impact, security implications, and why an existing dependency cannot do the job.

## Documentation changes

Update ADRs for architectural decisions. Update `docs/status/CURRENT.md` only when milestone state genuinely changes. Keep requirements separate from implementation notes.

A PDF or chat handoff is a snapshot only. Repository documents, issues, PRs, review threads, and CI remain authoritative.