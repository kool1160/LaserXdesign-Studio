# M17 — Process-Aware Manufacturability Profiles

## User-visible outcome

LaserX gives clearer, bounded manufacturing guidance for reviewed plasma, CO2 laser, diode laser, fiber laser, router, waterjet, and generic flat-cut workflows without pretending to know the user's exact machine settings or controlling equipment.

## Activation gate

M17 remains blocked until M16 is complete and the owner explicitly activates process-aware guidance.

Issue #76 is a planning input for nominal-versus-derived fit guidance. It does not authorize M17 work before activation.

## Included

- versioned process-profile contracts separated from machine profiles and machine control;
- reviewed process families with plain-language capability and caution metadata;
- process-aware starting guidance for minimum feature size, bridge width, gap, fragile sections, heat/burn risk, material compatibility, rear-engraving orientation, and fit reminders where evidence supports it;
- explicit distinction between default starting guidance, user overrides, and measured shop capability;
- visible assumptions and confidence language;
- cutability integration that reuses authoritative geometry and does not fork topology logic;
- deterministic analysis fingerprints and migration behavior;
- offline operation and no hidden remote settings service;
- an explicit owner decision, supported by representative evidence, to accept or defer any optional derived process-aware fit/allowance view;
- if accepted, a visibly derived fit/allowance view that keeps nominal design geometry authoritative, states its process/material/thickness assumptions, and never claims certified fit or universal kerf.

## Acceptance tests

1. Profiles remain guidance and cannot be mistaken for certified machine settings.
2. Identical geometry, material, thickness, and profile inputs produce identical findings.
3. User overrides are explicit, persisted where approved, and never silently replaced by profile defaults.
4. Unsupported process/material combinations fail visibly.
5. Switching profiles cannot mutate source geometry, physical layers, or exports.
6. Existing generic and plasma workflows remain valid after migration.
7. Plain-language findings identify measured value, configured limit, assumption, and repair guidance.
8. No profile can issue motion, power, speed, focus, gas, or process-enable commands.
9. Any accepted fit/allowance view is visibly derived, leaves nominal source geometry and ordinary exports unchanged, exposes assumptions and uncertainty, and never claims guaranteed bench fit.
10. No process profile silently applies geometric compensation or creates a universal authoritative kerf value.

## Exit checklist

- [ ] Process-profile ADR and schema boundaries are accepted.
- [ ] Reviewed profile fixtures and deterministic tests pass.
- [ ] UI explains defaults, overrides, and uncertainty clearly.
- [ ] The optional fit/allowance-view decision is explicitly accepted or deferred from representative evidence.
- [ ] Existing workflows and exact exports remain unchanged.
- [ ] Owner validates representative process scenarios.
- [ ] Status advances to M18 only after audit, merge, issue closure, and owner approval.

## Explicitly excluded

No universal speed/power or kerf database, silent geometric compensation, certified-fit promise, machine tuning, toolpaths, lead-ins, cut order, G-code, controller connection, or safety certification belongs in M17.
