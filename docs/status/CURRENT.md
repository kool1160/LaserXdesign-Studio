# Current Project Status

## Active gate

**M15 — Guided Onboarding, Workflow-First UI, and Learn Mode**

- Active issue: **#45**
- Active milestone specification: `docs/milestones/M15-guided-onboarding-learn-mode.md`
- Current slice: **G1 — first-launch goal chooser and resumable guidance shell**
- Implementation surface: **Codex**
- Implementation model: **selected by the owner inside Codex for each session; the repository does not choose or auto-route a model**
- Planning, orchestration, exact-head review, status, holds, and advancement: **LaserX Design Studio primary operations chat only**
- Owner authority: product direction, model choice, hands-on acceptance, and advancement
- Claude, Anthropic, Fable, and other external paid implementation routes: **removed from active operation; no automatic or implied use**

Only `Continue LaserX` goes to Codex. `Plan LaserX`, `Lock that into LaserX`, `Check LaserX`, `Status LaserX`, `Hold LaserX`, and `Advance LaserX` remain in the LaserX Design Studio primary operations chat. `docs/CHAT_AUTHORITY.md` is binding; other chats are read-only and fail closed when identity is uncertain.

## G1 post-merge audit and governance hold

PR **#71 — M15 G1 first-launch guidance shell** was squash-merged while the designated primary operations chat was performing `Check LaserX`.

- Final implementation head: `ae7c4e79509611a0704649d9c667886a98bcdcbd`
- Squash merge now on `main`: `41e572a017a82f66f9586ab6e34253d914bc31e2`
- Required exact-head checks: **Repository Guard — success; Canonical Verification — success**, including packaged Windows verification
- Post-merge exact-head audit: **READY**
- Technical blockers: **none found within the bounded G1 contract**
- Governance state: **not yet owner-accepted and not advanced**

The merge occurred before the READY verdict and without an explicit owner `Advance LaserX` in the designated primary operations chat. The subsequent G2 activation records were also unauthorized and are superseded by this hold. A merge alone never advances a gate.

**Hold:** no Codex implementation is authorized while owner acceptance is pending. Do not reopen G1 implementation, begin G2, alter the merged code, or treat the merge as implicit advancement.

**Next valid command: `Advance LaserX`** in the LaserX Design Studio primary operations chat.

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
- Result: **accepted and merged on explicit owner `Advance LaserX`**
- Codex-only execution, primary-chat write authority, and consolidated CI are active repository policy.

### G1 — first-launch goal chooser and resumable guidance shell

- PR **#71**
- Reviewed implementation head: `ae7c4e79509611a0704649d9c667886a98bcdcbd`
- Squash merge: `41e572a017a82f66f9586ab6e34253d914bc31e2`
- Exact-head audit result: **READY**
- Acceptance state: **awaiting explicit owner `Advance LaserX`**

## Accepted candidate result

The merged G1 candidate implements the bounded shell against ADR 0027:

- a clean first launch presents exactly **Create My First Sign**, **Import My Own Design**, and **Describe What I Want With AI — Optional**;
- AI remains optional and follows the existing provider connection state;
- guidance has current-step orientation, progress, Back, definition-controlled Skip, and a global **Exit guidance** action;
- `OnboardingPreferences` is versioned, validated, and atomically persisted in Electron `userData`;
- snapshots bind to current project, document, and fingerprint and resume with a fresh run token;
- wrong-project resume is not offered and does not destroy a valid saved snapshot;
- stable stages resume exactly and transient stages recover to the nearest stable checkpoint with a notice;
- true project replacement invalidates the live run, while `project.create-document`, Save, Save As, and ordinary edits do not;
- representative hidden surfaces are suppressed across the renderer and native File menu during guidance, while Save and Exit guidance remain reachable;
- the resolution checkpoint follows the G0 caller rules without inventing G4 safe-repair classification;
- packaged Windows regression coverage proves clean launch, start/exit, persistence/resume, project replacement, contextual visibility, and non-trapping recovery.

G1 does **not** implement the complete Create My First Sign journey, vector/raster guided automation, grouped repair, full Learn Mode, owner-observed usability validation, new AI capability, material expansion, process profiles, export profiles, licensing, public beta, CAD/CAM, or machine control.

## One repo, one active gate, one next command

- G1 is merged and technically READY but remains on an owner-acceptance hold.
- G2 through G6 remain held.
- M16 and later milestones remain blocked.
- PR #69 remains draft and held planning input; it is not authority for active work and must be reconciled with current Codex governance before any later review.
- PR #68 remains held outside active M15 work.
- No implementation agent merges, advances, changes the active gate, or starts another task on its own.
- No `Continue LaserX` implementation pass is authorized until the owner resolves the G1 acceptance hold.
- Next valid command: **`Advance LaserX`**

## Mandatory product interpretation

Every agent must read GitHub Issues #44 and #37 before planning or implementing post-M13 work.

LaserX remains an affordable, premium-feeling, machine-independent idea-to-manufacturable-product platform. First-time usability is central; deterministic sign creation works without AI; AI is optional and user-supplied; physical 3D is a major derived, non-mutating feature; Inkscape and downstream machine software are companions; the interface is workflow-first with progressive disclosure; and large finding sets become understandable repair decisions instead of raw tool walls.

## M15 gate order

1. **G0 — guided-workflow architecture and first-run contract** — merged and accepted
2. **G1 — first-launch goal chooser and resumable guidance shell** — merged, technically READY, awaiting owner acceptance
3. **G2 — Create My First Sign guided vertical slice** — held
4. **G3 — vector import and raster trace contextual guidance** — held
5. **G4 — grouped repair decisions and Fix safe problems workflow** — held
6. **G5 — Learn Mode, replay, recovery, and contextual explanations** — held
7. **G6 — packaged accessibility and owner-observed first-session validation** — held

Each gate requires exact-head `Check LaserX`, a `READY` verdict, and explicit owner `Advance LaserX` from the designated primary operations chat before the next gate becomes active. A merge alone never advances the gate.

## M14 completion record

M14 is complete and accepted. Issue #30 contains the exact component merges, Windows build evidence, private installer provenance, owner screenshots, owner pass, and final closure audit. M15 must not reopen or broaden M14.

## Private-testing boundary

LaserX remains private test software until a later milestone explicitly approves outside distribution. Trusted public signing, publication, pricing activation, telemetry, and public support do not belong in G1.
