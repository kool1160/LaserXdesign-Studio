# M14 — Beta Validation and Version 1.0 Release

## User-visible outcome

LaserX Design Studio graduates from an installable beta into a verified Version 1.0 release that has completed real sign jobs on representative Windows systems, survived upgrade and recovery testing, and ships with trustworthy support, release, and known-issue documentation.

Before Version 1.0, a finished sign can also be inspected as a rotatable physical preview. LaserX extrudes the authoritative 2D sign geometry using the selected material and exact stock thickness, so a user can inspect the front, back, edges, cutouts, and layered stack before manufacturing.

## Activation gate

M14 remains blocked until M13 is reviewed on its exact final head, required CI is green, the M13 pull request is merged, the M13 issue is closed, and `docs/status/CURRENT.md` explicitly activates M14.

## Included

### Physical 3D sign preview

- a dedicated 3D preview mode derived only from authoritative editable 2D geometry and explicit manufacturing-layer metadata;
- exact physical extrusion from canonical `thicknessMm`, including gauge, fractional-inch, millimeter, or custom stock selections after those selections are normalized to millimeters;
- material-aware visual appearance for mild steel, stainless steel, aluminum, galvanized steel, acrylic, wood, and other explicitly supported materials;
- orbit, pan, zoom, reset, front, back, edge, assembled, and exploded-layer views;
- single-layer signs and ordered multi-layer assemblies using each layer's own material and thickness;
- visible through-holes and cutouts that match the authoritative 2D contours;
- deterministic preview regeneration after accepted 2D edits, layer changes, material changes, or thickness changes;
- clear warnings when open, self-intersecting, ambiguous, unsupported, or otherwise invalid 2D geometry cannot form a trustworthy solid preview;
- high-DPI, keyboard-accessible, non-color-only controls and a bounded performance budget for representative signs.

The 3D view is visualization evidence, not a new design kernel. It must never silently repair, rewrite, scale, close, union, or otherwise mutate the 2D document. SVG, DXF, production packages, cutability analysis, dimensions, layer metadata, and project persistence remain authoritative.

M14 does not add mesh editing, arbitrary 3D modeling, bends, welds, bevels, embossing, machining features, toolpaths, or machine motion. No STL, STEP, IGES, 3MF, or other manufacturing-solid export is implied unless separately approved through a later milestone and ADR.

### Beta validation and release

- a documented beta cohort, supported Windows matrix, and reference-machine set;
- clean install, launch, upgrade, rollback/recovery, and uninstall validation across representative Windows systems;
- real-job validation covering text, SVG/DXF import, raster tracing, AI-assisted concepts, cutability review, layered production, physical 3D preview, save/reopen, and downstream CAM handoff;
- numerical inspection of representative SVG/DXF and layered-package output at intended physical scale;
- structured beta feedback, defect reproduction, severity triage, and release-blocker tracking;
- privacy-respecting crash and diagnostic collection only under the M13 telemetry decision and explicit user controls;
- compatibility and migration testing from every shipped beta project schema and supported beta application version;
- final onboarding, help, recovery, troubleshooting, known-issues, support, and manufacturing-disclaimer documentation;
- release notes, changelog, semantic version, signed artifacts, checksums, provenance, and a public download/release page;
- fixes limited to confirmed release defects, security problems, data-loss risks, manufacturing correctness, accessibility failures, severe usability blockers, and the explicitly approved physical-preview scope above;
- an explicit auto-update decision. Auto-update remains deferred unless separately authorized and accepted.

## Release boundary

M14 validates and stabilizes the product delivered through M13 and adds only the explicitly approved physical 3D sign preview described above. Beta feedback does not authorize any other broad feature expansion. Every additional accepted change must trace to a reproduced defect, release risk, accessibility failure, security issue, data-loss risk, or manufacturing-correctness problem.

Projects, credentials, autosaves, logs, settings, and upgrades must preserve the storage and privacy boundaries established before M14. A beta machine, unavailable AI provider, absent 3D acceleration, or absent future machine controller must never make normal project editing unusable.

The 3D preview may use GPU acceleration when available, but it must have a safe fallback or a clear unavailable state. Rendering failure must not corrupt the document, block saving, or alter manufacturing output.

## Acceptance tests

1. A representative single-layer sign previews at the exact selected physical thickness, including at least one gauge stock, one fractional-inch plate, and one millimeter stock.
2. A representative layered sign displays every physical layer in document order with its own exact material and thickness in assembled and exploded views.
3. Orbit, pan, zoom, reset, front, back, and edge controls remain usable with mouse and keyboard on the supported high-DPI Windows matrix.
4. Through-holes and interior cutouts in the 3D preview match the authoritative 2D contours and do not appear filled or omitted.
5. Accepted 2D geometry, material, thickness, and layer changes regenerate the same deterministic preview for the same project state.
6. Open, self-intersecting, ambiguous, or unsupported contours fail visibly without inventing a closed solid or mutating the document.
7. Entering, rotating, exploding, or leaving the 3D preview does not change project geometry, dirty state, Undo/Redo history, SVG/DXF output, production-package output, or cutability evidence.
8. Representative preview performance stays within the documented budget, and unavailable GPU acceleration degrades safely without blocking normal editing.
9. The signed beta installs, launches, upgrades, and uninstalls on the documented supported Windows matrix without manual repository setup.
10. Representative real sign jobs complete from creation or import through editable geometry, manufacturing review, physical 3D inspection, exact-scale export, and downstream CAM inspection.
11. SVG, DXF, and layered-package dimensions remain within documented tolerances on independently inspected fixtures.
12. Upgrade and migration preserve user projects, settings, credentials, and explicit saves under documented conditions.
13. Crash, cancellation, offline, provider-failure, rendering-failure, and recovery exercises do not overwrite the last explicit save or falsely report success.
14. Every release-blocking beta defect is closed, explicitly accepted as a documented known issue, or deferred with owner approval.
15. Accessibility, high-DPI, performance, security, license, and dependency gates remain green on the final release candidate.
16. Release artifacts are signed, versioned, checksummed, traceable to source, and published with release notes and known issues.
17. The final Version 1.0 candidate completes the primary workflow on a clean supported Windows machine.
18. Version 1.0 is tagged and published only after exact-head review and owner advancement.

## Exit checklist

- [ ] Physical 3D preview architecture and its strict 2D-authority boundary are documented through an accepted ADR.
- [ ] Exact-thickness single-layer and multi-layer preview fixtures pass.
- [ ] Orbit, pan, zoom, view presets, assembled/exploded views, cutouts, invalid-geometry handling, high-DPI, accessibility, and performance evidence pass.
- [ ] Preview interaction is proven non-mutating for geometry, history, save state, analysis, and manufacturing exports.
- [ ] Beta cohort and supported Windows matrix are documented.
- [ ] Clean install, upgrade, recovery, and uninstall evidence is complete.
- [ ] Representative real-job, physical-preview, and downstream-CAM inspections pass.
- [ ] All release blockers are closed or explicitly accepted.
- [ ] Migration, performance, accessibility, security, and manufacturing-accuracy gates pass.
- [ ] Help, support, recovery, privacy, known-issues, changelog, and release notes are published.
- [ ] Signed Version 1.0 artifacts, provenance, and checksums are published.
- [ ] Version 1.0 is tagged.
- [ ] Status advances to M15 only after review, green CI, merge, issue closure, and owner authorization.

## Explicitly excluded

No general-purpose 3D CAD, mesh editing, arbitrary solids, bends, weld symbols, bevels, embossing, STL/STEP/IGES/3MF export, new AI capability, nesting, quoting, cloud collaboration, marketplace, native DWG, broad CAM system, machine control, controller firmware, remote operation, or unrelated feature expansion belongs in M14.
