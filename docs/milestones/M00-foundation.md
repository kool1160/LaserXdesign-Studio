# M00 — Repository Foundation and Contracts

## Outcome

A Codex-ready repository with clear scope, architecture, package boundaries, milestone gates, contribution rules, and automated structure checks.

## Included

- root `AGENTS.md` and compatibility `agent.md`;
- product requirements and non-goals;
- architecture and accepted ADRs;
- logical monorepo directory scaffold;
- package ownership descriptions;
- fixture and tool directories;
- GitHub templates and repository guard workflow;
- current-status tracking;
- large milestone specifications.

## Excluded

- production feature implementation;
- dependency/framework selection beyond accepted direction;
- production canvas or geometry library;
- AI provider credentials;
- distributable application builds.

## Acceptance tests

1. Root instructions link to all source-of-truth documents.
2. Every planned package directory exists and states its responsibility.
3. Every M01–M12 milestone has scope, acceptance criteria, and an exit checklist.
4. Repository guard verifies required files and rejects obvious committed secrets or unlicensed font binaries.
5. `docs/status/CURRENT.md` is updated to make M01 the active milestone.

## Exit checklist

- [ ] All acceptance tests pass.
- [ ] Repository guard is green on `main`.
- [ ] No production implementation was accidentally started.
- [ ] M00 limitations are documented.
- [ ] Status advances to M01.
