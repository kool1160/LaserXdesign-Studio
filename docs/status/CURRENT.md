# Current Project Status

## Active gate

**M15 — Guided Onboarding, Workflow-First UI, and Learn Mode**

- Active issue: **#45**
- Active milestone specification: `docs/milestones/M15-guided-onboarding-learn-mode.md`
- Current slice: **G3 — vector import and raster trace contextual guidance**
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

## Active G3 contract — vector import and raster trace contextual guidance

G3 turns **Import My Own Design** into a truthful source-aware guided workflow using the existing SVG/DXF import and PNG/JPEG raster-trace systems. The source type determines which preparation surface is presented; guidance must observe real preview/commit results rather than invent parallel import state.

Required outcome:

1. Start from **Import My Own Design** in the accepted G1 chooser and preserve G1/G2 run-token, resume, Back, Exit guidance, project-replacement, and contextual-control guarantees.
2. The initial source step is generic. Before a source is selected, do not expose raster trace controls as though the file type were already known.
3. **SVG/DXF branch:** use the existing vector-import preview/commit path with real units, scale/fit, layers, warnings/findings, preview, accept, and cancel. Raster trace controls remain hidden throughout the vector path.
4. **PNG/JPEG branch:** expose preprocessing and trace controls only after a raster source is actually selected. Use the existing raster trace preview/commit path and require a real accepted editable-geometry result before advancing.
5. Treat source-preparation preview state as transient. Resume from an interrupted preview returns to the stable source-selection checkpoint and never claims a vanished preview still exists.
6. Accept/commit advances; cancel/reject returns to source selection without marking the source-preparation checkpoint complete or mutating authoritative geometry beyond existing accepted feature semantics.
7. After editable geometry is committed, reuse existing physical-layer material/thickness assignment, whole-design cutability analysis, ADR 0027 resolution rules, required physical 3D preview/unavailable route, Save/Save As, and SVG/DXF export. Do not bypass a required checkpoint merely because the source was imported.
8. Keep G4 out of scope: do not implement grouped repair categories, a safe-fix classifier, batch repair, or **Fix safe problems**. Existing findings may be surfaced truthfully, but no new repair confidence is invented.
9. Add focused unit/integration regressions plus packaged Windows E2E for at least one SVG/DXF path and one PNG/JPEG path, including branch isolation and a negative/non-trapping source-cancel or stale-preview case.
10. Open one focused draft PR, record exact-head evidence, and stop at `AWAITING_REVIEW`.

## G3 non-goals

No G4 grouped repair/**Fix safe problems**, G5 full Learn Mode/replay content, G6 owner-observed usability validation, new AI capability, material-catalog expansion, process profiles, export profiles, licensing, public beta, CAD/CAM, machine control, or native DWG support.

## One repo, one active gate, one next command

- G3 is the only active implementation target.
- G4 through G6 remain held.
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
4. **G3 — vector import and raster trace contextual guidance** — **active**
5. **G4 — grouped repair decisions and Fix safe problems workflow** — held
6. **G5 — Learn Mode, replay, recovery, and contextual explanations** — held
7. **G6 — packaged accessibility and owner-observed first-session validation** — held

Each gate requires exact-head `Check LaserX`, a `READY` verdict, and explicit owner `Advance LaserX` from the designated primary operations chat before the next gate becomes active. A merge alone never advances the gate.

## M14 completion record

M14 is complete and accepted. Issue #30 contains the exact component merges, Windows build evidence, private installer provenance, owner screenshots, owner pass, and final closure audit. M15 must not reopen or broaden M14.

## Private-testing boundary

LaserX remains private test software until a later milestone explicitly approves outside distribution. Trusted public signing, publication, pricing activation, telemetry, and public support do not belong in G3.
