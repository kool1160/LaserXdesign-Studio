# ADR 0018: Future Machine and Controller Extensibility

## Status

Accepted.

## Decision

LaserX version 1 remains a design, analysis, and export application. It does not
control machine motion, fire a torch or laser, generate production G-code, or
own real-time safety behavior.

The architecture must nevertheless preserve a clean future path for LaserX to
support owner-built CNC control hardware and broader manufacturing workflows.
Core document, geometry, text, tracing, AI, cutability, and sign-tool packages
must remain independent from any controller board, transport, firmware,
machine brand, or cutting process.

Future machine integration will use explicit internal boundaries for:

- machine capability profiles;
- job preparation derived from normalized project geometry;
- controller discovery and identity;
- transport and protocol adapters;
- firmware/version compatibility;
- command, status, alarm, and diagnostic records;
- simulation or dry-run behavior;
- operator-owned execution and recovery.

A custom LaserX CNC board may be added through a dedicated controller adapter
and documented firmware protocol rather than by placing board-specific logic in
the editor, domain model, renderer, or AI pipeline. Capability records must
express what a machine can do instead of assuming every target is a plasma sign
cutter. This leaves room for plasma, laser, router, waterjet, marking, fixture,
or other future machine modules without redefining core artwork geometry.

The renderer may request high-level actions and display status, but it must not
own unrestricted device access or directly emit real-time motion or process
commands. Privileged communication belongs in a dedicated host boundary or
service with typed requests, bounded queues, cancellation, diagnostics, and
fail-safe disconnect behavior.

No AI-generated result may flow directly to machine execution. AI, imported
files, and user-created designs must pass deterministic normalization,
manufacturing analysis, job preparation, simulation or review, and explicit
operator approval before any future controller can receive an executable job.

Any future machine-control milestone must define safety requirements before
implementation, including at minimum machine identity, homing state, limits,
interlocks, emergency-stop behavior, process-enable state, stale-command
rejection, communication loss, restart recovery, dry run, and an operator
confirmation boundary.

A public plugin marketplace is not required for version 1. Internal replaceable
interfaces are sufficient until real controller hardware and extension cases
exist. Those interfaces must be designed so a public SDK can be introduced
later without changing the native project format or coupling ordinary editing
to machine availability.

## Rationale

The current product must stay focused enough to finish, but the owner may later
build a CNC control board and expand LaserX beyond sign-file creation. Keeping
machine concerns downstream of stable design and manufacturing interfaces
avoids a future rewrite while preventing speculative hardware code from
polluting version 1.

A capability-based model is more durable than hard-coding one board or process.
A strict safety and privilege boundary is necessary because desktop editing
errors are inconvenient, while unintended machine motion or process activation
can damage equipment or injure people.

## Alternatives

- Embedding one custom board protocol directly into the desktop controller was
  rejected because it would couple UI, project files, and hardware lifecycle.
- Treating exported G-code as the only future interface was rejected because a
  custom controller may need richer capabilities, status, diagnostics, and job
  semantics.
- Building a public plugin system before real hardware exists was rejected as
  premature infrastructure and a version-1 distraction.
- Allowing AI or the renderer to command motion directly was rejected because
  it bypasses deterministic review and safety ownership.

## Consequences

Version 1 continues to export neutral, dimensionally correct manufacturing
geometry and does not claim machine-control capability. Future controller work
must be introduced as a separately gated milestone or product module after the
current roadmap, with its own safety ADRs, protocol fixtures, simulator, fault
injection, hardware-in-the-loop validation, and explicit operator acceptance.

The custom-board protocol may evolve independently while LaserX projects remain
portable. Adding machine support later should extend the application rather
than fork or replace the editor.
