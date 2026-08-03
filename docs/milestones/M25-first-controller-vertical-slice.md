# M25 — First LaserX Controller Vertical Slice

## User-visible outcome

One explicitly selected LaserX controller, one documented machine, and one manufacturing process can execute one bounded representative job under direct operator control with verified identity, homing, limits, interlocks, emergency stop, dry run, alarms, communication-loss handling, and hardware-in-the-loop evidence.

## Activation prerequisites

M25 remains blocked until:

- M24 is reviewed, merged, closed, and recorded complete;
- the owner explicitly authorizes live hardware work;
- the exact controller, firmware, machine, process, transport, electrical interface, motion hardware, process-enable interface, emergency-stop chain, interlocks, limits, and test location are documented;
- a hardware-specific ADR or activation amendment is accepted;
- the M24 simulator and privileged-host boundaries remain intact;
- `docs/status/CURRENT.md` explicitly activates M25.

No agent may guess the hardware target or activate live outputs from roadmap text alone.

## Included

- one controller identity and firmware-compatibility handshake;
- one replaceable transport/protocol adapter behind M24 interfaces;
- one machine and process profile;
- hardware-in-the-loop fixtures for identity, heartbeat, homing, limits, interlocks, emergency stop, communication loss, restart, alarms, and stale-command rejection;
- deterministic conversion from an operator-approved M24 job plan into bounded controller commands;
- simulation and dry run before process-enabled execution;
- explicit operator review of identity, bounds, origin, units, travel, process state, and safety readiness;
- controlled pause, cancel, alarm, recovery, and safe restart;
- one supervised representative real-machine job;
- evidence comparing planned bounds, commands, acknowledgements, alarms, and result;
- clear product labeling limited to the exact validated hardware and process.

## Safety boundary

M25 is not a general machine-control release. Unsupported boards, firmware, machines, processes, transports, and safety wiring fail closed.

Emergency-stop and hardwired safety behavior may not depend solely on application software. Software status is not a substitute for physical safety circuits, guarding, electrical compliance, ventilation, fire prevention, training, or PPE.

AI and renderer code may never command motion or process output directly.

## Acceptance tests

1. The application identifies the exact approved controller and rejects incompatible firmware.
2. Ready-to-run requires identity, homing, limits, interlocks, emergency-stop state, and process readiness.
3. Dry run stays within planned travel bounds with process output disabled.
4. Stale, duplicate, replayed, out-of-order, wrong-machine, wrong-profile, or post-cancel commands are rejected.
5. Communication loss, reset, restart, limit, interlock, alarm, cancel, and emergency stop produce documented safe behavior.
6. Process output cannot enable before exact operator confirmation and safety prerequisites.
7. Hardware-in-the-loop tests pass before process-enabled testing.
8. One supervised representative job matches approved geometry and documented tolerance.
9. Normal editor and project workflows remain usable without hardware connected.
10. Product claims remain limited to the exact validated controller, firmware, machine, and process.

## Explicitly excluded

No second controller, broad hardware compatibility, unattended operation, remote cloud control, autonomous AI execution, public plugin marketplace, general-purpose CAM suite, arbitrary G-code sender, automatic machine tuning, certification claim, or production-scale rollout belongs in M25.
