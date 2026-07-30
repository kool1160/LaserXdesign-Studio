# Contributing

## Before changing code

1. Read `AGENTS.md`.
2. Read `docs/status/CURRENT.md`.
3. Read the active milestone specification.
4. Inspect related tests and ADRs.
5. Confirm the task is inside the active milestone.

## Branches

Use short descriptive names such as:

- `feat/m01-project-lifecycle`
- `fix/dxf-scale-roundtrip`
- `docs/m08-cutability-contract`

## Commits

Prefer focused conventional commits:

- `feat: add document resize command`
- `fix: preserve inch scale during DXF export`
- `test: add nested-island cutability fixture`
- `docs: record tracing tolerance decision`

## Pull requests

Describe:

- active milestone;
- user-visible result;
- architectural changes;
- tests run and results;
- screenshots for UI changes;
- fixture/golden changes;
- known limitations;
- exact next allowed work.

## Dependency changes

Explain why a dependency is required, its license, maintenance status, bundle impact, security implications, and why an existing dependency cannot do the job.

## Documentation changes

Update ADRs for architectural decisions. Update `docs/status/CURRENT.md` only when milestone state genuinely changes. Keep requirements separate from implementation notes.
