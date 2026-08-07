# Current Project Status

## Active gate

**M15 — Guided Onboarding, Workflow-First UI, and Learn Mode**

- Active issue: **#45**
- Active milestone specification: `docs/milestones/M15-guided-onboarding-learn-mode.md`
- Current slice: **G2 — Create My First Sign guided vertical slice**
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
- Required exact-head checks: **Repository Guard — success; Canonical Verification — success**
- Result: **accepted and merged**

### G1 — first-launch goal chooser and resumable guidance shell

- PR **#71**
- Reviewed head: `ae7c4e79509611a0704649d9c667886a98bcdcbd`
- Squash merge: `41e572a017a82f66f9586ab6e34253d914bc31e2`
- Required exact-head checks: **Repository Guard — success; Canonical Verification — success, including packaged Windows verification**
- Review result: **READY**, no unresolved review threads
- Result: **accepted on explicit owner `Advance LaserX` in the designated primary operations chat on 2026-08-07**
- Governance note: acceptance occurred after the post-merge owner-acceptance hold; the earlier premature G2 activation was superseded and is not authority.
- Delivered: clean first-launch three-goal chooser, validated atomic onboarding persistence, exact-project resume/recovery, fresh run tokens, contextual shell visibility, native-menu gating, project-replacement invalidation, and packaged regression coverage.

## Active G2 contract — Create My First Sign guided vertical slice

G2 makes the already-shipped `create-first-sign` shell truthful and complete as one deterministic end-to-end user workflow. It must use existing authoritative LaserX commands and state; guidance observes and coordinates real work rather than creating a parallel editor or claiming completion before the product action succeeds.

Required outcome:

1. Start from **Create My First Sign** in the G1 chooser and keep the existing focused guidance shell, resume, Back, and Exit behavior.
2. **Choose size and material:** require real stock/document dimensions and real manufacturing material/thickness state before the step can complete.
3. **Add the sign content:** require at least one real object in the document before advancing; reuse existing Create, Text, and Sign capabilities.
4. **Check the design:** invoke the existing cutability analysis and advance only from current, non-stale analysis for the exact document.
5. **Resolve findings:** obey ADR 0027 exactly. Auto-complete unseen only when nothing is actionable. User Continue is allowed only when no blocking findings remain. G2 must not invent G4 safe-fix classification, grouped repair, or hidden repairs.
6. **Review the 3D result:** require the existing physical preview to render successfully or present a truthful unavailable/failure route. This checkpoint is required and cannot be skipped.
7. **Save or export:** use existing Save and SVG/DXF export behavior, expose real success/failure, and mark the guided goal completed only after a real successful export.
8. Wire progression to actual feature outcomes/state changes instead of a generic manual Continue that can falsely mark a checkpoint complete.
9. Preserve run-token protection, exact-project/document/fingerprint resume rules, synchronous project-replacement invalidation, contextual-control visibility, security boundaries, undo/history behavior, and non-mutation guarantees from G1/ADR 0027.
10. Add focused unit/integration coverage plus packaged Windows E2E proving a deterministic first sign can move from first launch through size/material, content, cutability, resolution, physical 3D, save/export, and completed guidance.
11. Add at least one packaged negative/non-trapping path proving a required checkpoint cannot be falsely advanced.
12. Open one focused draft PR, record exact-head evidence, and stop at `AWAITING_REVIEW`.

## G2 non-goals

No G3 vector/raster guided integration, G4 grouped repair or **Fix safe problems**, G5 full Learn Mode/replay content, G6 owner-observed usability validation, new AI capability, material-catalog expansion, process profiles, export profiles, licensing, public beta, CAD/CAM, or machine control.

## One repo, one active gate, one next command

- G2 is the only active implementation target.
- G3 through G6 remain held.
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
3. **G2 — Create My First Sign guided vertical slice** — **active**
4. **G3 — vector import and raster trace contextual guidance** — held
5. **G4 — grouped repair decisions and Fix safe problems workflow** — held
6. **G5 — Learn Mode, replay, recovery, and contextual explanations** — held
7. **G6 — packaged accessibility and owner-observed first-session validation** — held

Each gate requires exact-head `Check LaserX`, a `READY` verdict, and explicit owner `Advance LaserX` from the designated primary operations chat before the next gate becomes active. A merge alone never advances the gate.

## M14 completion record

M14 is complete and accepted. Issue #30 contains the exact component merges, Windows build evidence, private installer provenance, owner screenshots, owner pass, and final closure audit. M15 must not reopen or broaden M14.

## Private-testing boundary

LaserX remains private test software until a later milestone explicitly approves outside distribution. Trusted public signing, publication, pricing activation, telemetry, and public support do not belong in G2.
