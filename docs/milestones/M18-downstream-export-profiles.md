# M18 — Downstream Software Export Profiles

## User-visible outcome

A user selects the downstream software they already use and LaserX prepares a deterministic, correctly scaled, clearly documented handoff without mutating the source design or pretending to generate proprietary machine files it does not support.

## Activation gate

M18 remains blocked until M17 is complete and the owner explicitly activates export-profile work.

Issue #41 is the planning source. Issue #76 adds the compensation-ownership and double-compensation boundary; neither issue authorizes implementation before M18 activation.

## Included

- reviewed profiles for LightBurn/general laser, plasma CAM, router CAM, waterjet, fiber workflows where open formats are supported, and generic flat-cut consumers;
- profile-controlled interchange behavior for SVG versus DXF versus layered package, units, scale declarations, origin/orientation, layer names/order, operation-intent grouping, closure/flattening policy, registration geometry, filenames, folders, and post-export instructions;
- explicit cut, mark, engrave, drill-reference, and non-cut-preview separation only where the target format can represent it truthfully;
- explicit compensation ownership for every reviewed target profile: nominal geometry only, LaserX-derived allowance where separately approved, or downstream kerf/tool-offset responsibility;
- visible warnings and instructions that prevent silent double compensation when downstream software or CAM owns kerf/tool offset;
- exact-scale independent inspection fixtures;
- deterministic target-profile output from one authoritative geometry model;
- visible warnings for unsupported target behavior;
- documentation for continuing artistic SVG editing in Inkscape and reopening/importing the result into LaserX.

## Acceptance tests

1. Every profile exports at exact documented scale and orientation.
2. Profiles never mutate the source project or silently discard unsupported manufacturing information.
3. No proprietary-format claim is made without a real documented implementation.
4. Native DWG is never faked by renaming DXF.
5. Layer and operation grouping remains deterministic.
6. Decorative preview data is excluded from manufacturing profiles where required.
7. Repeated export of the same accepted project and profile produces identical output except documented nondeterministic metadata.
8. Independent target-software inspection confirms representative files open at intended size.
9. Material metadata may accompany files but never becomes machine settings.
10. Every profile states where compensation is expected to occur and cannot silently double-compensate geometry already intended for downstream kerf/tool offset.
11. Changing a target profile or its compensation-ownership setting cannot mutate the authoritative source design.

## Exit checklist

- [ ] Profile contract and target matrix are documented.
- [ ] Compensation ownership and double-compensation prevention are documented for every accepted profile.
- [ ] LightBurn/general laser and plasma CAM profiles pass first.
- [ ] Additional profiles are added only with reviewed evidence.
- [ ] Exact-scale target inspections and packaged E2E pass.
- [ ] Inkscape companion workflow is documented and tested.
- [ ] Status advances to M19 only after audit, merge, issue closure, and owner approval.

## Explicitly excluded

No proprietary reverse engineering, native DWG, silent kerf compensation, machine settings, toolpaths, G-code, controller communication, or replacement of downstream machine software belongs in M18.
