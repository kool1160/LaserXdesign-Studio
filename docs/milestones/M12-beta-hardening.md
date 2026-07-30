# M12 — Packaging, Performance, Accessibility, and Beta Hardening

## User-visible outcome

A dependable Windows beta can be installed, used on real sign jobs, recovered after common failures, and updated through a controlled release process.

## Included

- Windows installer and uninstall behavior;
- code-signing plan and release secrets separation;
- versioning, changelog, and release notes;
- auto-update decision and implementation only if accepted;
- crash handling and recoverable session behavior;
- performance budgets for startup, pan/zoom, selection, trace, booleans, analysis, save, and export;
- worker cancellation and progress polish;
- memory safeguards for large files;
- keyboard navigation and accessibility pass;
- high-DPI and common display testing;
- telemetry/crash-reporting decision with explicit opt-in/privacy behavior;
- security review and dependency audit;
- migration tests from every shipped project schema;
- beta feedback template and known-issues list;
- release CI gates and reproducible build documentation.

## Acceptance tests

1. Clean Windows install launches and completes the primary sign workflow.
2. Upgrade preserves user projects and settings under documented conditions.
3. Crash/restart recovery does not overwrite the last explicit save.
4. Performance budgets pass on the documented reference machine/fixture set.
5. Core workflows are keyboard accessible and warnings are not color-only.
6. No critical/high unresolved security issue remains in the release scope.
7. Release artifact provenance and checksums are recorded.
8. A real representative project exports at correct scale and opens downstream.

## Exit checklist

- [ ] Release checklist complete.
- [ ] Known issues published.
- [ ] Security and license audits pass.
- [ ] Beta installer validated on clean Windows environment.
- [ ] Version 1 beta tagged and status moved to maintenance/planning.
