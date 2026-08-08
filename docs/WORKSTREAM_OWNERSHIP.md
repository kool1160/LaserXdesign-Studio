# LaserX Design Studio Workstream Ownership

## Status and authority

This assignment supersedes ADR 0026's Claude implementation assignment and the later fixed-model routing. Codex is the sole active implementation surface.

Only `Continue LaserX` goes to the Codex implementation session. The owner selects the model inside Codex. The LaserX Design Studio primary operations chat is the only planning/review write authority. Every other chat is read-only for those mutations.

Claude, Anthropic, Fable, and other external paid implementation, repair, review, continuation, and fallback routes are removed from active operation.

## Current delivery gate

- Milestone: **M15 — Guided Onboarding, Workflow-First UI, and Learn Mode**
- Active issue: **#45**
- Current state: **G3 post-merge repair acceptance hold**
- Repair PR: **#74 — M15 G3 repair: require physical setup confirmation**
- Reviewed repair head: `66dab265b3073145e48667639b0a303691733f7b`
- Required CI: **Repository Guard success; Canonical Verification success, including packaged Windows verification**
- Review result: **READY**
- G4 grouped repair is **held until PR #74 is explicitly accepted and merged**.

The late P1 showed that assigning a physical role to imported geometry could populate default material/thickness and auto-advance guidance before the user reviewed non-default physical settings. PR #74 removes that auto-advance. The explicit guided Continue remains the only route out of **Set physical details** and validates the current physical setup.

## Owner authority

The owner controls product direction, milestone and gate order, pricing/trial philosophy, model selection inside Codex, hands-on acceptance, and explicit advancement through `Advance LaserX`.

A READY verdict does not replace the owner command. A merge also does not replace the owner command.

## Primary operations chat ownership

The primary operations chat owns planning, durable decisions, exact-head `Check LaserX`, READY/REPAIR/BLOCKED verdicts, status/holds, merges after owner authorization, and gate activation.

During the current repair hold, the next valid owner command is `Advance LaserX`. That command accepts/merges PR #74 and restores G4 as active; it does not advance to G5.

## Codex implementation ownership

Codex may implement and repair only the bounded task authorized by current repository truth. It never merges or advances.

While PR #74 is unmerged, Codex must not begin G4. A `Continue LaserX` command during this hold must stop `BLOCKED` after reading the repair hold.

After PR #74 is accepted and merged, G4 becomes the sole implementation task: grouped repair decisions and preview-first **Fix safe problems**, reusing authoritative geometry/history/cutability and preserving all G1–G3 security, persistence, resume, project-replacement, Save/Export, and Exit-guidance guarantees.

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
