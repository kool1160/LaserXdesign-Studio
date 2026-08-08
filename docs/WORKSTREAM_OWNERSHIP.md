# LaserX Design Studio Workstream Ownership

## Status and authority

This assignment supersedes ADR 0026's Claude implementation assignment and the later fixed-model routing. Codex is the sole active implementation surface.

Only `Continue LaserX` goes to the Codex implementation session. The owner selects the model inside Codex. The LaserX Design Studio primary operations chat is the only planning/review write authority. Every other chat is read-only for those mutations.

Claude, Anthropic, Fable, and other external paid implementation, repair, review, continuation, and fallback routes are removed from active operation.

## Current delivery gate

- Milestone: **M15 — Guided Onboarding, Workflow-First UI, and Learn Mode**
- Active issue: **#45**
- Active slice: **G5 — Learn Mode, replay, recovery, and contextual explanations**
- G6 packaged accessibility and owner-observed first-session validation remains held.

G4 was accepted and merged through PR #75 at reviewed head `fb6caaeddb4117f308685314082102e65e231989` and squash merge `daf48515fa54e1dfd3276173d84d597b7dd14492`. Repository Guard and Canonical Verification, including packaged Windows verification, were green; all review threads were resolved. The owner explicitly advanced on 2026-08-08.

## Owner authority

The owner controls product direction, milestone and gate order, pricing/trial philosophy, model selection inside Codex, hands-on acceptance, and explicit advancement through `Advance LaserX`.

A READY verdict does not replace the owner command. A merge also does not replace the owner command.

## Primary operations chat ownership

The primary operations chat owns planning, durable decisions, exact-head `Check LaserX`, READY/REPAIR/BLOCKED verdicts, status/holds, merges after owner authorization, and gate activation.

## Codex implementation ownership

Codex may implement and repair only the bounded task authorized by current repository truth. It never merges or advances.

For active G5, Codex must add the permanent optional Learn Mode and replay/recovery behavior on top of the existing guided-workflow system. Teaching must attach to real controls, explain **what** and **why** in normal shop language, and remain separate from authoritative manufacturing/document truth.

Codex must preserve all G1–G4 security, persistence, resume, project-replacement, Save/Export, undo/history, repair-preview, and Exit-guidance guarantees. Replay must use fresh run identity and may not revive stale transient UI state or silently mutate the current project.

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

G6, later milestones, owner-observed usability acceptance, broad material/process expansion, new AI capability, CAD/CAM, machine control, licensing, public beta, native DWG, or unrelated scope does not become active merely because an agent has capacity or a branch exists.
