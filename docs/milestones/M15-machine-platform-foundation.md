# M15 — Machine Platform Foundation

## User-visible outcome

LaserX gains a simulator-first machine-platform foundation that can describe machine capabilities, prepare deterministic jobs downstream of approved geometry, exercise safety state transitions, and support future controller adapters without allowing the renderer or AI system to command live equipment.

## Activation gate

M15 remains blocked until M14 completes the Version 1.0 release, its pull request is reviewed and merged, its issue is closed, `docs/status/CURRENT.md` activates M15, and the owner explicitly authorizes post-Version-1 machine-platform work.

ADR 0018 remains the governing architecture boundary.

## Included

- capability-based machine profiles rather than assumptions tied to one plasma table or sign workflow;
- explicit process, travel, axis, homing, limit, interlock, and optional tool-capability descriptions;
- controller identity, discovery, firmware-compatibility, health, and diagnostic contracts;
- replaceable transport and protocol adapter interfaces with no production hardware adapter enabled by default;
- a privileged machine host or service boundary with narrow typed IPC; the renderer receives status and submits reviewed intent but never accesses devices directly;
- deterministic job preparation downstream of normalized LaserX geometry and approved production artifacts;
- a versioned internal job-plan contract that remains separate from native project geometry and does not silently become G-code;
- simulator and dry-run execution with machine-state visualization, explicit operator review, cancellation, alarms, and recovery;
- safety state models for machine identity, homing, travel limits, interlocks, emergency stop, process enable, stale-command rejection, communication loss, restart recovery, and operator confirmation;
- heartbeat, sequencing, idempotency, replay protection, and fault-injection behavior;
- structured diagnostics and audit logs that exclude credentials and unnecessary user content;
- automated simulator, state-machine, security-boundary, fault-injection, and recovery coverage;
- documentation for adding a future controller adapter without changing project, geometry, AI, or editor packages.

## Safety and architecture boundary

M15 is simulator-only foundation work. It must not energize motion, torch, spindle, laser, waterjet, marking, or any other process output. No production controller transport may be enabled by default, and no acceptance test requires connected machinery.

Native `.laserx` projects remain portable and independent from machine profiles, controller boards, firmware, transports, and service availability. Machine configuration and execution state live outside the project geometry contract unless a later accepted migration defines a narrow reference.

AI may help explain diagnostics or prepare non-authoritative design intent, but it may never issue motion, process-enable, or safety-control commands. The renderer may never bypass the privileged host.

## Acceptance tests

1. A versioned capability profile can represent the first planned machine class without embedding one controller protocol in the editor or project format.
2. The privileged machine host and renderer boundary prevent direct renderer device access and reject malformed or unauthorized IPC.
3. Deterministic job preparation produces identical reviewed plans for identical approved geometry, settings, and machine capability inputs.
4. The simulator exercises idle, identity, homing-required, ready, dry-run, running-simulation, paused, canceled, alarmed, disconnected, emergency-stop, and recovery states.
5. Stale, duplicated, replayed, out-of-order, or wrong-machine commands are rejected.
6. Communication loss, heartbeat timeout, restart, interlock change, limit activation, cancellation, and emergency-stop fault injections enter explicit safe states.
7. Normal LaserX editing, save, import, analysis, AI, and export workflows remain fully usable when the machine host is absent or stopped.
8. No live motion or process output is possible from the M15 build.
9. Security, architecture, simulator, and recovery evidence passes on the exact final head.
10. Status advances to M16 only after review, green CI, merge, issue closure, owner authorization, and selection of the exact first hardware target.

## Exit checklist

- [ ] Capability and machine-profile contracts are documented and versioned.
- [ ] Privileged host, IPC, identity, diagnostics, and protocol-adapter boundaries are implemented and reviewed.
- [ ] Deterministic job-plan and simulator contracts are implemented.
- [ ] Safety state machine and fault-injection suite pass.
- [ ] Renderer, AI, and native project independence are verified.
- [ ] No live transport or process output is enabled.
- [ ] The exact M16 hardware, process, transport, and safety prerequisites are documented before M16 activation.

## Explicitly excluded

No live controller connection, firmware deployment, physical motion, process enable, G-code sender, broad CAM engine, automatic lead-in or cut-order system, unattended operation, remote cloud control, multiple-controller support, plugin marketplace, or autonomous AI execution belongs in M15.
