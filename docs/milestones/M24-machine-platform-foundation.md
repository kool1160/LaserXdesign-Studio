# M24 — Machine Platform Foundation

## User-visible outcome

After Version 1.0, LaserX gains a simulator-first machine-platform foundation that can describe machine capabilities, prepare deterministic reviewed jobs, exercise safety states, and support future controller adapters without allowing the renderer or AI system to command live equipment.

## Activation gate

M24 remains blocked until M23 completes Version 1.0, the owner explicitly authorizes post-Version-1 machine-platform work, `docs/status/CURRENT.md` activates M24, and ADR 0018 remains satisfied.

## Included

- capability-based machine and process profiles;
- controller identity, discovery, firmware compatibility, health, and diagnostics contracts;
- replaceable transport/protocol interfaces with no live production adapter enabled by default;
- privileged machine host/service with narrow typed IPC;
- deterministic job preparation downstream of approved LaserX geometry and production artifacts;
- versioned internal job-plan contract separate from native project geometry and G-code;
- simulator and dry-run state visualization;
- identity, homing, limits, interlocks, emergency stop, process-enable, stale-command, communication-loss, restart, cancellation, alarm, heartbeat, replay-protection, and fault-injection models;
- automated simulator, security-boundary, state-machine, fault, and recovery evidence;
- documentation for future controller adapters without rewriting editor, geometry, project, AI, or sign packages.

## Safety boundary

M24 is simulator-only. It cannot energize motion, torch, spindle, laser, waterjet, marking, or another process output. Normal LaserX editing remains usable without the machine host.

AI and renderer code may never issue motion, process-enable, interlock, emergency-stop, or other safety-control commands.

## Acceptance tests

1. Capability profiles and controller boundaries are versioned and documented.
2. Renderer and AI cannot access devices or issue motion/process commands.
3. Identical approved inputs produce identical reviewed job plans.
4. Simulator covers required ready, dry-run, cancel, alarm, disconnect, emergency-stop, and recovery states.
5. Stale, duplicated, replayed, out-of-order, or wrong-machine commands are rejected.
6. Communication-loss and safety fault injections enter explicit safe states.
7. Normal editing remains usable without the machine host.
8. No live motion or process output is possible from M24.
9. Status advances to M25 only after exact-head audit, merge, issue closure, owner authorization, and exact hardware selection.

## Explicitly excluded

No live controller connection, firmware deployment, physical motion, process enable, arbitrary G-code sender, broad CAM engine, unattended operation, remote cloud control, multiple-controller support, or autonomous AI execution belongs in M24.
