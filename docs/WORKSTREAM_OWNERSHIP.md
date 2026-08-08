# LaserX Design Studio Workstream Ownership

## Status and authority

This assignment supersedes ADR 0026's Claude implementation assignment and the later fixed-model routing. Codex is the sole active implementation surface.

Only `Continue LaserX` goes to the Codex implementation session. The owner selects the model inside Codex. The LaserX Design Studio primary operations chat is the only planning/review write authority. Every other chat is read-only for those mutations.

Claude, Anthropic, Fable, and other external paid implementation, repair, review, continuation, and fallback routes are removed from active operation.

## Current delivery gate

- Milestone: **M15 — Guided Onboarding, Workflow-First UI, and Learn Mode**
- Active issue: **#45**
- Active slice: **G4 — grouped repair decisions and Fix safe problems workflow**
- G5 full Learn Mode and G6 owner usability validation remain held.

PR #74 completed the late G3 physical-confirmation repair at reviewed head `66dab265b3073145e48667639b0a303691733f7b` and squash merge `df0d3463470afb7f69724ca808c25df0b8317d87`. Repository Guard and Canonical Verification, including packaged Windows verification, were green. The owner explicitly accepted the repair on 2026-08-08.

## Owner authority

The owner controls product direction, milestone and gate order, pricing/trial philosophy, model selection inside Codex, hands-on acceptance, and explicit advancement through `Advance LaserX`.

A READY verdict does not replace the owner command. A merge also does not replace the owner command.

## Primary operations chat ownership

The primary operations chat owns planning, durable decisions, exact-head `Check LaserX`, READY/REPAIR/BLOCKED verdicts, status/holds, merges after owner authorization, and gate activation.

## Codex implementation ownership

Codex may implement and repair only the bounded task authorized by current repository truth. It never merges or advances.

For active G4, Codex must build grouped repair decisions and preview-first **Fix safe problems** on top of authoritative geometry/history/cutability and the accepted guided resolution checkpoint. Safe eligibility is limited to the approved deterministic classes; ambiguous or risky changes remain user decisions.

Codex must preserve all G1–G3 security, persistence, resume, project-replacement, Save/Export, undo/history, and Exit-guidance guarantees.

## Removed external routes

Claude, Anthropic, Fable, and other external paid implementation, repair, review, continuation, and fallback routes are removed from active operation. Earlier authorship remains repository history only.

## Durable operating loop

1. Owner discusses/locks direction in the primary operations chat.
2. Owner sends `Continue LaserX` to Codex only when current truth authorizes implementation.
3. Codex implements or repairs one bounded task and stops `AWAITING_REVIEW` or `BLOCKED`.
4. Owner sends `Check LaserX` here.
5. If READY, owner sends `Advance LaserX` here.
6. This chat merges/records acceptance and activates only the authorized next state.

There is no automatic routine merge.

## Explicit exclusions

No later milestone, broad geometry rewrite, CAM, machine control, material expansion, licensing, public beta, native DWG, or speculative safe-repair class becomes active merely because an agent has capacity or a branch exists.
