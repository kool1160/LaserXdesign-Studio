# M14 — Beta Validation and Version 1.0 Release

## User-visible outcome

LaserX Design Studio graduates from an installable beta into a verified Version 1.0 release that has completed real sign jobs on representative Windows systems, survived upgrade and recovery testing, and ships with trustworthy support, release, and known-issue documentation.

## Activation gate

M14 remains blocked until M13 is reviewed on its exact final head, required CI is green, the M13 pull request is merged, the M13 issue is closed, and `docs/status/CURRENT.md` explicitly activates M14.

## Included

- a documented beta cohort, supported Windows matrix, and reference-machine set;
- clean install, launch, upgrade, rollback/recovery, and uninstall validation across representative Windows systems;
- real-job validation covering text, SVG/DXF import, raster tracing, AI-assisted concepts, cutability review, layered production, save/reopen, and downstream CAM handoff;
- numerical inspection of representative SVG/DXF and layered-package output at intended physical scale;
- structured beta feedback, defect reproduction, severity triage, and release-blocker tracking;
- privacy-respecting crash and diagnostic collection only under the M13 telemetry decision and explicit user controls;
- compatibility and migration testing from every shipped beta project schema and supported beta application version;
- final onboarding, help, recovery, troubleshooting, known-issues, support, and manufacturing-disclaimer documentation;
- release notes, changelog, semantic version, signed artifacts, checksums, provenance, and a public download/release page;
- fixes limited to confirmed release defects, security problems, data-loss risks, manufacturing correctness, accessibility failures, and severe usability blockers;
- an explicit auto-update decision. Auto-update remains deferred unless separately authorized and accepted.

## Release boundary

M14 validates and stabilizes the product already delivered through M13. It does not use beta feedback as permission for broad feature expansion. Every accepted change must trace to a reproduced defect, release risk, accessibility failure, security issue, data-loss risk, or manufacturing-correctness problem.

Projects, credentials, autosaves, logs, settings, and upgrades must preserve the storage and privacy boundaries established before M14. A beta machine, unavailable AI provider, or absent future machine controller must never make normal project editing unusable.

## Acceptance tests

1. The signed beta installs, launches, upgrades, and uninstalls on the documented supported Windows matrix without manual repository setup.
2. Representative real sign jobs complete from creation or import through editable geometry, manufacturing review, exact-scale export, and downstream CAM inspection.
3. SVG, DXF, and layered-package dimensions remain within documented tolerances on independently inspected fixtures.
4. Upgrade and migration preserve user projects, settings, credentials, and explicit saves under documented conditions.
5. Crash, cancellation, offline, provider-failure, and recovery exercises do not overwrite the last explicit save or falsely report success.
6. Every release-blocking beta defect is closed, explicitly accepted as a documented known issue, or deferred with owner approval.
7. Accessibility, high-DPI, performance, security, license, and dependency gates remain green on the final release candidate.
8. Release artifacts are signed, versioned, checksummed, traceable to source, and published with release notes and known issues.
9. The final Version 1.0 candidate completes the primary workflow on a clean supported Windows machine.
10. Version 1.0 is tagged and published only after exact-head review and owner advancement.

## Exit checklist

- [ ] Beta cohort and supported Windows matrix are documented.
- [ ] Clean install, upgrade, recovery, and uninstall evidence is complete.
- [ ] Representative real-job and downstream-CAM inspections pass.
- [ ] All release blockers are closed or explicitly accepted.
- [ ] Migration, performance, accessibility, security, and manufacturing-accuracy gates pass.
- [ ] Help, support, recovery, privacy, known-issues, changelog, and release notes are published.
- [ ] Signed Version 1.0 artifacts, provenance, and checksums are published.
- [ ] Version 1.0 is tagged.
- [ ] Status advances to M15 only after review, green CI, merge, issue closure, and owner authorization.

## Explicitly excluded

No new major design workflow, AI capability, layered-production expansion, nesting, quoting, cloud collaboration, marketplace, native DWG, broad CAM system, machine control, controller firmware, remote operation, or unrelated feature expansion belongs in M14.
