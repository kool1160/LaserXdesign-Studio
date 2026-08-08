# LaserX Design Studio Workstream Ownership

## Status and authority

This document records the Codex-only governance reset effective **2026-08-06**:

> The primary operations chat decides. GitHub remembers. Codex executes the bounded task. Pull requests hold the evidence.

This assignment supersedes ADR 0026's Claude implementation assignment and the later fixed-model SOL routing. Those records remain historical evidence but carry no current execution authority.

`AGENTS.md`, `docs/OPERATOR_PROTOCOL.md`, `docs/CHAT_AUTHORITY.md`, `docs/CODEX_EXECUTION_PLAN.md`, and `docs/status/CURRENT.md` are the current operating truth.

## Current delivery gate

- Milestone: **M15 — Guided Onboarding, Workflow-First UI, and Learn Mode**
- Active issue: **#45**
- Active slice: **G3 — vector import and raster trace contextual guidance**
- Active task: make **Import My Own Design** source-aware and truthful across the existing SVG/DXF vector-import and PNG/JPEG raster-trace branches, then carry accepted editable geometry through the already-established manufacturing, cutability, 3D, save, and export checkpoints.
- G4 grouped repair, G5 full Learn Mode, and G6 owner usability validation remain held.

PR #72 completed and merged G2 at `c9a834a811db831207da6ca695ee8c46d6a88ca4` after exact-head READY review of `9da334207d29da27948863bb95f21155737f65b8` with Repository Guard and Canonical Verification green. The owner explicitly accepted and advanced G2 in the designated primary operations chat on 2026-08-07.

## Owner authority

The owner controls product direction, milestone and gate order, pricing and trial philosophy, model selection inside Codex, hands-on acceptance, and explicit advancement through `Advance LaserX`.

A `READY` verdict is required before advancement, but it does not replace the owner command. A merge also does not replace the owner command.

## Primary operations chat ownership

The **LaserX Design Studio primary operations chat** is the only conversation authorized for planning/review-side writes. It owns:

- `Plan LaserX: <idea>` and `Lock that into LaserX`;
- exact-head review through `Check LaserX`;
- durable findings and decisions on GitHub;
- `Status LaserX` and `Hold LaserX`;
- merge, issue closure when appropriate, status recording, and next-gate activation after the owner issues `Advance LaserX` there.

Every other chat is read-only for those mutations. When chat identity is uncertain, the conversation must fail closed. `docs/CHAT_AUTHORITY.md` contains the binding prohibition and recovery rule.

There is no automatic routine merge.

## Codex implementation ownership

Codex is the sole active implementation surface. The repository does not choose or auto-route the model; the owner selects it inside Codex for each session.

Only `Continue LaserX` goes to the Codex implementation session. Codex owns reading live truth, repairing review and CI blockers first, implementing the smallest active slice, adding regression coverage, using one focused draft PR, running required verification, pushing exact-head evidence, and stopping at `AWAITING_REVIEW` or `BLOCKED`.

For active G3, Codex must reuse the existing vector-import and raster-trace preview/commit systems. The selected source type controls which preparation surface is presented: SVG/DXF never exposes raster trace controls, and raster preprocessing/trace appears only after PNG/JPEG is selected. Guidance may observe and coordinate those systems; it must not create parallel import state or claim a preview/commit happened when it did not.

After committed editable geometry exists, Codex must reuse the accepted physical-layer, whole-design cutability, ADR 0027 resolution, required physical 3D, Save/Save As, and SVG/DXF export checkpoints. G4 grouped repair and safe-fix behavior remain out of scope.

Codex must preserve ADR 0027 and G1/G2 guarantees for fresh run tokens, exact-project resume, synchronous `project-replaced`, project/document/fingerprint binding, transient recovery, contextual controls, required checkpoints, and non-trapping Exit guidance.

Codex must never merge its PR, close the active issue, change the active gate, approve its own work, rewrite ownership authority, create speculative future infrastructure, run later-milestone work, poll in the background, or continue after `AWAITING_REVIEW` without another owner command.

## Removed external routes

Claude, Anthropic, Fable, and other external paid implementation, repair, review, continuation, and fallback routes are removed from active operation. Earlier authorship remains normal repository history and is judged by exact-head evidence.

## Independent verification

Critical geometry, manufacturing truth, schema/migration, filesystem, IPC, credential, signing, licensing, release, or machine-safety work may require a verifier who did not author the load-bearing change. The primary operations chat records the verifier and exact target in GitHub; this does not create an automatic external-model route.

## Durable operating loop

1. Owner discusses direction with `Plan LaserX: <idea>` in the primary operations chat.
2. The primary operations chat records it with `Lock that into LaserX`.
3. Owner sends `Continue LaserX` to Codex.
4. Codex implements or repairs the bounded active gate and stops.
5. Owner sends `Check LaserX` in the primary operations chat.
6. If `REPAIR`, owner sends `Continue LaserX` to Codex.
7. If `READY`, owner sends `Advance LaserX` in the primary operations chat.
8. The primary operations chat merges when needed, records acceptance, activates the next gate, and stops.

## Explicit exclusions

No later milestone, wholesale experiment merge, general CAD rewrite, CAM expansion, machine control, material expansion, licensing implementation, public beta work, or native DWG support becomes active merely because an agent has capacity, code has merged, or a draft branch exists.
