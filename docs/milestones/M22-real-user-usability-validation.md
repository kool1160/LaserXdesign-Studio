# M22 — Real-User Usability Validation

## User-visible outcome

Observed first-time users can create or import a sign, understand the major warnings, inspect the physical result in 3D, and export a usable file within ten minutes without the owner sitting beside them.

## Activation gate

M22 remains blocked until M21 is complete, a controlled beta cohort exists, and the owner explicitly activates real-user validation.

## Included

- documented participant mix across plasma, laser, router, woodworking, acrylic, sign-making, hobby, and small-shop workflows;
- observed or recorded sessions with consent;
- time to first successful project, stuck points, incorrect clicks, undiscovered features, misunderstood language, and export success;
- understanding of LaserX versus machine-control software;
- understanding that AI is optional;
- feedback from real SVG, DXF, raster, text, layered, material, 3D, and downstream-software workflows;
- severity-based usability triage;
- fixes limited to confirmed blockers, misleading behavior, accessibility failures, data-loss risks, manufacturing correctness, and severe friction;
- evidence that tutorials teach a real task rather than merely moving users through screens.

## Acceptance tests

1. The documented target percentage of first-time participants completes the primary workflow within ten minutes without direct coaching.
2. Participants can explain what LaserX does and what their downstream software still owns.
3. Participants can make a sign without AI and understand how to optionally connect AI.
4. Major warning language is understood and acted on correctly.
5. Users can find 3D preview, manipulate it, return to editing, and export.
6. Users can recover from at least one realistic mistake without restarting or losing work.
7. SVG/DXF output opens at intended scale in the participant's downstream workflow.
8. Every severity-1 and release-blocking usability defect is closed or explicitly accepted by the owner.
9. Accessibility and high-DPI blockers found in the cohort are resolved.

## Exit checklist

- [ ] Participant plan and consent process are approved.
- [ ] Session evidence and metrics are recorded.
- [ ] Ten-minute success target is measured, not assumed.
- [ ] Confirmed release blockers are repaired and revalidated.
- [ ] Known limitations are documented honestly.
- [ ] Status advances to M23 only after audit, issue closure, and owner approval.

## Explicitly excluded

No uncontrolled feature expansion, broad new CAD tools, new machine-control capability, or roadmap changes justified only by isolated preference feedback belongs in M22.
