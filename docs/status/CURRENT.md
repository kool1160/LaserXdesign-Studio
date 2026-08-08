# Current Project Status

## Active gate

**M15 — Guided Onboarding, Workflow-First UI, and Learn Mode**

- Active issue: **#45**
- Active milestone specification: `docs/milestones/M15-guided-onboarding-learn-mode.md`
- Current slice: **G5 — Learn Mode, replay, recovery, and contextual explanations**
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
- Result: **accepted and merged on explicit owner `Advance LaserX`**

### G3 post-merge physical-confirmation repair

- PR **#74**
- Reviewed head: `66dab265b3073145e48667639b0a303691733f7b`
- Squash merge: `df0d3463470afb7f69724ca808c25df0b8317d87`
- Result: **accepted and merged on explicit owner `Advance LaserX` on 2026-08-08**

### G4 — grouped repair decisions and Fix safe problems

- PR **#75**
- Reviewed head: `fb6caaeddb4117f308685314082102e65e231989`
- Squash merge: `daf48515fa54e1dfd3276173d84d597b7dd14492`
- Required exact-head checks: **Repository Guard — success; Canonical Verification — success, including packaged Windows verification**
- Review result: **READY**, no unresolved review threads
- Result: **accepted and merged on explicit owner `Advance LaserX` on 2026-08-08**
- Delivered: grouped **Safe to fix / Suggested fix / Needs your decision** findings; mechanically bounded safe classes; non-mutating visual before/after repair preview; stale-proposal refusal; one-transaction accept/undo; reanalysis and truthful counts; full finding navigation; exact empty-scope preservation.

## Active G5 contract — Learn Mode, replay, recovery, and contextual explanations

G5 turns the accepted guided workflow shell into a permanent optional teaching system that explains **what** a control does and **why** a fabricator would use it, in normal shop language, while the user continues doing real LaserX work.

Required outcome:

1. **Learn Mode is optional and persistent.** Add a clear Learn/Help entry point that can enable or disable contextual teaching without changing authoritative project geometry or requiring a new project.
2. **Teach in context, not in a disconnected slideshow.** Explanations attach to the real controls and current workflow state and must cover the core M15 concepts needed for a first successful project: physical layers, material/thickness, cutability findings, safe/suggested/decision repair groups, bridge/island intent, physical 3D, and export.
3. **Explain both what and why in normal shop language.** Do not assume CAD/topology vocabulary; advanced terminology may be secondary, not required to understand the task.
4. **Guided workflows can be skipped, replayed, or reopened later.** Existing completed tutorials/goals remain available from Learn/Help; replay creates a fresh workflow run and does not silently overwrite current project state.
5. **Replay/resume is truthful.** Replayed workflows use fresh run tokens and current project/document identity. Stale or transient state must recover to a stable checkpoint rather than restoring vanished previews or claiming completed work.
6. **Recovery remains non-trapping.** App restart, guidance Exit, wrong-project resume, project replacement, and transient source/preview loss preserve the accepted G1–G4 fail-closed behavior. Learn Mode must never block normal editing, Save/Export, or global Exit.
7. **Explanations never perform hidden work.** Opening, dismissing, or replaying educational content cannot mutate geometry, accept repairs, complete required checkpoints, run export, or manufacture evidence on the user's behalf.
8. **Track learning completion separately from manufacturing truth.** Tutorial/replay completion may be persisted, but it must not become a second source of truth for document state, analysis state, repair state, 3D state, or export success.
9. Reuse the accepted guided-workflow reducer, onboarding preferences, contextual-control architecture, authoritative geometry/history/cutability systems, and G4 grouped repair surface. Do not create a parallel tutorial application or duplicate workflow engine.
10. Add focused unit/integration regressions and packaged Windows E2E proving Learn Mode toggle, contextual explanations, skip/replay/reopen, fresh-token replay, restart/resume recovery, wrong-project/project-replacement behavior, and non-trapping Exit while preserving G1–G4 product behavior.
11. Open one focused draft PR, record exact-head Repository Guard and Canonical Verification evidence, and stop at `AWAITING_REVIEW`.

## G5 non-goals

No G6 owner-observed first-session validation or accessibility closure, new AI capability, new tutorial content for unimplemented future material/process features, broad material expansion, process profiles, export profiles, licensing, public beta, analytics platform, general-purpose CAD, CAM, machine control, or native DWG support.

## One repo, one active gate, one next command

- G5 is the only active implementation target.
- G6 remains held.
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
4. **G3 — vector import and raster trace contextual guidance** — merged and accepted; post-merge repair merged and accepted
5. **G4 — grouped repair decisions and Fix safe problems workflow** — merged and accepted
6. **G5 — Learn Mode, replay, recovery, and contextual explanations** — **active**
7. **G6 — packaged accessibility and owner-observed first-session validation** — held

Each gate requires exact-head `Check LaserX`, a `READY` verdict, and explicit owner `Advance LaserX` from the designated primary operations chat before the next gate becomes active. A merge alone never advances the gate.

## M14 completion record

M14 is complete and accepted. Issue #30 contains the exact component merges, Windows build evidence, private installer provenance, owner screenshots, owner pass, and final closure audit. M15 must not reopen or broaden M14.

## Private-testing boundary

LaserX remains private test software until a later milestone explicitly approves outside distribution. Trusted public signing, publication, pricing activation, telemetry, and public support do not belong in G5.
