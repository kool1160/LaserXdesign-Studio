# M16 — First LaserX Controller Vertical Slice

## User-visible outcome

One explicitly selected LaserX controller, one documented machine, and one cutting or manufacturing process can execute one bounded representative job under direct operator control with verified identity, homing, limits, interlocks, emergency stop, dry run, alarms, communication-loss handling, and hardware-in-the-loop evidence.

## Activation prerequisites

M16 remains blocked until all of the following are true:

- M15 is reviewed on its exact final head, required CI is green, its pull request is merged, and its issue is closed;
- the owner explicitly authorizes live hardware work;
- the exact controller board, firmware baseline, machine, process, transport, electrical interface, motion hardware, process-enable interface, emergency-stop chain, interlocks, limits, and test location are documented;
- a dedicated ADR or activation amendment defines the hardware-specific safety model and acceptance fixture;
- the M15 simulator and privileged-host boundaries remain intact;
- `docs/status/CURRENT.md` explicitly activates M16.

No coding agent may guess the hardware target or activate live outputs from the generic roadmap text alone.

## Included

- one controller identity and firmware-compatibility handshake;
- one replaceable transport and protocol adapter implemented behind the M15 interfaces;
- one machine profile and one process profile with explicit travel, axis, homing, limit, interlock, and process-enable capabilities;
- hardware-in-the-loop fixtures for controller identity, heartbeat, homing, limits, interlocks, emergency stop, communication loss, restart, alarms, and stale-command rejection;
- deterministic conversion from an operator-approved M15 job plan into the bounded commands required by the selected controller;
- simulation and dry run before process-enabled execution;
- explicit operator review of machine identity, job bounds, origin, units, estimated travel, process state, and safety readiness before start;
- controlled pause, cancel, alarm, recovery, and safe restart behavior;
- process enable only after the documented safety chain and operator confirmation are satisfied;
- one supervised representative real-machine job performed in the documented test environment;
- logs and evidence sufficient to compare planned bounds, commanded execution, controller acknowledgements, alarms, and final outcome;
- clear product labeling that support is limited to the selected hardware and process validated by this milestone.

## Safety boundary

M16 is not a general machine-control release. It validates one narrow hardware vertical slice. Unsupported boards, firmware, machines, processes, transports, and safety wiring must fail closed.

Emergency-stop and hardwired safety behavior may not depend solely on application software. Software status must never be presented as a substitute for physical safety circuits, machine guarding, electrical compliance, ventilation, fire prevention, operator training, or process-specific protective equipment.

AI and renderer code may never command motion or process output directly. The privileged host must enforce identity, sequencing, stale-command rejection, capability checks, state checks, and operator authorization for every execution path.

## Acceptance tests

1. The application identifies the exact approved controller and rejects unsupported or incompatible firmware before accepting a job.
2. The selected machine cannot enter a ready-to-run state before required homing, limits, interlocks, emergency-stop state, machine identity, and process readiness are verified.
3. Dry run completes within planned travel bounds without process enable and matches the reviewed job plan.
4. Stale, duplicated, replayed, out-of-order, wrong-machine, wrong-profile, or post-cancel commands are rejected.
5. Communication loss, heartbeat timeout, controller reset, application restart, limit activation, interlock opening, alarm, cancellation, and emergency stop produce the documented safe behavior.
6. Process output cannot enable until the exact operator-confirmation and safety prerequisites are satisfied.
7. Hardware-in-the-loop tests pass before any process-enabled real-machine test.
8. One supervised representative job completes on the selected machine, and measured or inspected output matches the approved geometry and documented tolerance.
9. Normal editor and project workflows remain usable without the controller connected.
10. No claim of support extends beyond the exact validated controller, firmware, machine, and process.

## Exit checklist

- [ ] Hardware-specific ADR or activation amendment is accepted.
- [ ] Controller, firmware, transport, machine, process, electrical, and safety prerequisites are documented.
- [ ] Simulator parity and hardware-in-the-loop fault tests pass.
- [ ] Identity, homing, limits, interlocks, emergency stop, heartbeat, cancel, alarm, and restart behavior pass.
- [ ] Dry run and operator-review gates pass.
- [ ] One supervised process-enabled representative job passes independent review.
- [ ] Supported-hardware limits, warnings, installation requirements, and known issues are published.
- [ ] Any broader machine-platform roadmap is planned from M16 evidence rather than assumed.

## Explicitly excluded

No second controller, broad hardware compatibility, unattended operation, remote cloud control, autonomous AI execution, public plugin marketplace, general-purpose CAM suite, arbitrary G-code sender, automatic machine tuning, certification claim, or production-scale rollout belongs in M16.
