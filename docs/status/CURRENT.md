# Current Project Status

## Active gate

**M15 — Guided Onboarding, Workflow-First UI, and Learn Mode**

- Active issue: **#45**
- Active milestone specification: `docs/milestones/M15-guided-onboarding-learn-mode.md`
- Current slice: **G4 — grouped repair decisions and Fix safe problems workflow**
- Implementation surface: **Codex**
- Implementation model: **selected by the owner inside Codex for each session; the repository does not choose or auto-route a model**
- Planning, orchestration, exact-head review, status, holds, and advancement: **LaserX Design Studio primary operations chat only**
- Owner authority: product direction, model choice, hands-on acceptance, and advancement
- Claude, Anthropic, Fable, and other external paid implementation routes: **removed from active operation; no automatic or implied use**

Only `Continue LaserX` goes to Codex. `Plan LaserX`, `Lock that into LaserX`, `Check LaserX`, `Status LaserX`, `Hold LaserX`, and `Advance LaserX` remain in the LaserX Design Studio primary operations chat. `docs/CHAT_AUTHORITY.md` is binding; other chats are read-only and fail closed when identity is uncertain.

## M15 completion record so far

### G0 — architecture and first-run contract

- PR **#67**
- Reviewed head: `f1109191676766dfeaa833ec327f842bd6eab71b`
- Squash merge: `90946f7db42ac2cc2be3532bf49bdcdfe0d885ed`
- Result: **accepted and merged**

### G1 prerequisite — governance and CI normalization

- PR **#70**
- Reviewed head: `4fff7f73542ca16b3e9548a9674a88e5883b518e`
- Squash merge: `84a3ffad4973ed8830c1e9fc2e1f026183a1a30c`
- Result: **accepted and merged**

### G1 — first-launch goal chooser and resumable guidance shell

- PR **#71**
- Reviewed head: `ae7c4e79509611a0704649d9c667886a98bcdcbd`
- Squash merge: `41e572a017a82f66f9586ab6e34253d914bc31e2`
- Required exact-head checks: **Repository Guard — success; Canonical Verification — success, including packaged Windows verification**
- Result: **accepted on explicit owner `Advance LaserX`**

### G2 — Create My First Sign guided vertical slice

- PR **#72**
- Reviewed head: `9da334207d29da27948863bb95f21155737f65b8`
- Squash merge: `c9a834a811db831207da6ca695ee8c46d6a88ca4`
- Required exact-head checks: **Repository Guard — success; Canonical Verification — success, including packaged Windows verification**
- Result: **accepted and merged on explicit owner `Advance LaserX`**

### G3 — vector import and raster trace contextual guidance

- PR **#73**
- Reviewed head: `4df406869bf23c175069b9b93dda9d97b5cb8cab`
- Squash merge: `f2a54d732ec9ee661c921d421da08e2b83c01b14`
- Required exact-head checks: **Repository Guard — success; Canonical Verification — success, including packaged Windows verification**
- Result: **accepted and merged on explicit owner `Advance LaserX`**

### G3 post-merge physical-confirmation repair

- PR **#74**
- Reviewed head: `66dab265b3073145e48667639b0a303691733f7b`
- Squash merge: `df0d3463470afb7f69724ca808c25df0b8317d87`
- Required exact-head checks: **Repository Guard — success; Canonical Verification — success, including packaged Windows verification**
- Review result: **READY**, no unresolved review threads
- Result: **accepted and merged on explicit owner `Advance LaserX` on 2026-08-08**
- Delivered: imported **Set physical details** no longer auto-advances when role assignment populates default material/thickness; role/material/thickness remain editable until explicit guided confirmation.

## Active G4 contract — grouped repair decisions and Fix safe problems

G4 turns large manufacturing/repair finding sets into a small number of truthful user decisions without hiding risk or mutating authoritative geometry before acceptance.

Required outcome:

1. Group current findings into **Safe to fix**, **Suggested fix**, and **Needs your decision** with truthful affected scope/counts.
2. Limit deterministic safe eligibility to exact duplicate geometry, zero-length entities, redundant collinear points, and eligible near-closures within an explicit approved tolerance. Any additional class requires evidence before being labeled safe.
3. **Fix safe problems** is preview-first and leaves authoritative geometry unchanged until acceptance.
4. Refuse stale repair proposals if their document/finding basis changes before acceptance.
5. Apply accepted safe repairs as one coherent undoable transaction whenever technically practical and report fixed/skipped/remaining counts truthfully.
6. Re-run current analysis after acceptance; keep unresolved suggested/decision findings visible; never claim automated repair proves cut readiness or physical safety.
7. Never silently apply suggested fixes, bridge/island decisions, ambiguous near-closures, or unproven safe classes.
8. Reuse existing geometry/history/cutability and the accepted guided resolution checkpoint rather than creating parallel geometry or finding truth.
9. Preserve exact-project resume, run tokens, project replacement, contextual controls, security, Save/Export, and global Exit guidance.
10. Add focused unit/integration and packaged Windows evidence for preview non-mutation, safe/ambiguous separation, accept/reject/undo, grouped large-finding presentation, reanalysis, stale-proposal refusal, and a negative/non-trapping route.
11. Open one focused draft PR and stop at `AWAITING_REVIEW`.

## G4 non-goals

No G5 full Learn Mode/replay content, G6 owner-observed usability validation, broad geometry-engine rewrite, speculative safe classifications, new AI capability, material-catalog expansion, process profiles, export profiles, licensing, public beta, analytics platform, general-purpose CAD, CAM, machine control, or native DWG support.

## One repo, one active gate, one next command

- G4 is the only active implementation target.
- G5 and G6 remain held.
- M16 and later milestones remain blocked.
- PR #69 remains draft/held planning input and is not authority for the active gate.
- PR #68 remains held outside active M15 work.
- No implementation agent merges, advances, changes the active gate, or starts another task on its own.
- One `Continue LaserX` command authorizes one bounded Codex pass, then Codex stops.
- Next valid command: **`Continue LaserX`**

## Mandatory product interpretation

Every agent must read GitHub Issues #44 and #37 before planning or implementing post-M13 work.

LaserX remains an affordable, premium-feeling, machine-independent idea-to-manufacturable-product platform. First-time usability is central; deterministic sign creation works without AI; AI is optional and user-supplied; physical 3D is a major derived, non-mutating feature; Inkscape and downstream machine software are companions; the interface is workflow-first with progressive disclosure; and large finding sets become understandable repair decisions instead of raw tool walls.

## M15 gate order

1. **G0 — guided-workflow architecture and first-run contract** — merged and accepted
2. **G1 — first-launch goal chooser and resumable guidance shell** — merged and accepted
3. **G2 — Create My First Sign guided vertical slice** — merged and accepted
4. **G3 — vector import and raster trace contextual guidance** — merged and accepted; post-merge repair PR #74 merged and accepted
5. **G4 — grouped repair decisions and Fix safe problems workflow** — **active**
6. **G5 — Learn Mode, replay, recovery, and contextual explanations** — held
7. **G6 — packaged accessibility and owner-observed first-session validation** — held

Each gate requires exact-head `Check LaserX`, a `READY` verdict, and explicit owner `Advance LaserX` from the designated primary operations chat before the next gate becomes active. A merge alone never advances the gate.

## M14 completion record

M14 is complete and accepted. Issue #30 contains the exact component merges, Windows build evidence, private installer provenance, owner screenshots, owner pass, and final closure audit. M15 must not reopen or broaden M14.

## Private-testing boundary

LaserX remains private test software until a later milestone explicitly approves outside distribution. Trusted public signing, publication, pricing activation, telemetry, and public support do not belong in G4.
