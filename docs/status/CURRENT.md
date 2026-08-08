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
- Review result: **READY**, no unresolved review threads
- Result: **accepted and merged on explicit owner `Advance LaserX` on 2026-08-07**
- Delivered: truthful first-sign progression through real size/material, physical-layer content, whole-design analysis, ADR 0027 resolution rules, required physical 3D, Save/Save As, and successful SVG/DXF export.

### G3 — vector import and raster trace contextual guidance

- PR **#73**
- Reviewed head: `4df406869bf23c175069b9b93dda9d97b5cb8cab`
- Squash merge: `f2a54d732ec9ee661c921d421da08e2b83c01b14`
- Required exact-head checks: **Repository Guard — success; Canonical Verification — success, including packaged Windows verification**
- Review result: **READY**, no unresolved review threads
- Result: **accepted and merged on explicit owner `Advance LaserX` on 2026-08-07**
- Delivered: generic source selection; isolated SVG/DXF and PNG/JPEG preparation; transient source recovery; non-destructive cancel/reject; accepted editable geometry carried through physical assignment, whole-design analysis, required 3D, Save/Save As, and successful export; full guided-document invalidation covers manufacturing-layer changes.

## Active G4 contract — grouped repair decisions and Fix safe problems

G4 turns large manufacturing/repair finding sets into a small number of truthful user decisions without hiding risk or mutating authoritative geometry before acceptance.

Required outcome:

1. **Group findings into decisions**, not an entity-level wall. The main repair surface must organize current findings into **Safe to fix**, **Suggested fix**, and **Needs your decision**, with affected scope and counts visible enough for the user to understand what will happen.
2. **Safe eligibility is deterministic and tested.** Initial safe classes are limited to exact duplicate geometry, zero-length entities, redundant collinear points, and eligible near-closures only within an explicit approved tolerance. Any additional class requires evidence before being labeled safe.
3. **Fix safe problems is preview-first.** The prominent action must show the proposed deterministic safe batch while leaving authoritative geometry unchanged until the user accepts it.
4. **Acceptance is one coherent repair transaction whenever technically practical.** Accepted batch repairs must preserve undo/reject behavior and report fixed, skipped, and remaining counts truthfully.
5. **Never overclaim.** Automated safe repair does not prove cut readiness or physical safety; the current document must be re-analyzed and remaining suggested/decision findings must stay visible.
6. **Ambiguous or risky repairs remain user decisions.** G4 must not silently apply suggested fixes, bridge/island decisions, or any class whose safety is not mechanically proven.
7. Reuse the existing geometry/history/cutability systems and accepted G2/G3 guided resolution checkpoint. Do not create a parallel geometry model, hidden destructive edit path, or separate finding truth.
8. Preserve exact-project resume, run-token protection, project replacement, contextual controls, security boundaries, Save/Export semantics, and non-trapping Exit guidance from G1–G3/ADR 0027.
9. Add focused unit/integration regressions and packaged Windows E2E proving preview leaves geometry unchanged, acceptance/undo are truthful, large finding sets are grouped, safe and ambiguous classes stay separated, and the guided user can recover/exit without being trapped.
10. Open one focused draft PR, record exact-head Repository Guard and Canonical Verification evidence, and stop at `AWAITING_REVIEW`.

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
4. **G3 — vector import and raster trace contextual guidance** — merged and accepted
5. **G4 — grouped repair decisions and Fix safe problems workflow** — **active**
6. **G5 — Learn Mode, replay, recovery, and contextual explanations** — held
7. **G6 — packaged accessibility and owner-observed first-session validation** — held

Each gate requires exact-head `Check LaserX`, a `READY` verdict, and explicit owner `Advance LaserX` from the designated primary operations chat before the next gate becomes active. A merge alone never advances the gate.

## M14 completion record

M14 is complete and accepted. Issue #30 contains the exact component merges, Windows build evidence, private installer provenance, owner screenshots, owner pass, and final closure audit. M15 must not reopen or broaden M14.

## Private-testing boundary

LaserX remains private test software until a later milestone explicitly approves outside distribution. Trusted public signing, publication, pricing activation, telemetry, and public support do not belong in G4.
