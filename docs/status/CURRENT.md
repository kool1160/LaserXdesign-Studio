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
- Codex-only execution, primary-chat write authority, and consolidated CI are now active repository policy.

## Active G1 contract — goal chooser and resumable guidance shell

G1 now implements the real first-run/guidance shell against ADR 0027 without beginning the later guided product paths.

Required outcome:

1. Wire `apps/desktop/src/features/onboarding/guidedWorkflowState.ts` into the desktop application through a bounded app-layer integration; do not move authoritative project or geometry behavior into React.
2. Implement the locked `OnboardingPreferences` persistence shape in Electron `userData` using the established versioned, validated, atomic-write persistence pattern. Load it through the existing desktop-state boundary rather than exposing arbitrary filesystem access to the renderer.
3. On clean first launch or the appropriate empty-workspace entry state, present exactly the three locked goals: **Create My First Sign**, **Import My Own Design**, and **Describe What I Want With AI — Optional**. The AI goal must reuse the existing provider-connected state and remain clearly optional when unavailable.
4. Implement a focused resumable guidance shell with a visible current step, progress/orientation, Back where allowed, Skip only where the definition permits it, and a globally reachable **Exit guidance** action.
5. Preserve ADR 0027's contextual-control contract: project-replacement controls are hidden while guidance is active, Save remains available when a document exists, and unrelated tool walls are hidden or visually subordinate for the active guided stage.
6. Mint a fresh unique run token for every start, resume, and replay; bind persisted snapshots to the current project/document/fingerprint exactly as ADR 0027 requires.
7. Dispatch `project-replaced` synchronously for true open-session replacements before replacement state can be observed by queued guidance events or persistence. Do not dispatch it for `project.create-document`, Save, Save As, or ordinary edits.
8. Resume stable stages exactly; recover transient stages to the nearest earlier stable step and tell the user where guidance resumed. Refuse stale or incompatible snapshots without changing the document.
9. Integrate the resolution checkpoint caller obligations without implementing G4's grouped-repair engine: unseen advance only when `shouldAutoCompleteResolution` is true, and user Continue only when `canCompleteResolution` permits it.
10. Add unit/integration coverage for the app-layer obligations above plus packaged Windows E2E for clean first launch, start/exit, persistence/resume, project replacement, and a non-trapping recovery path.
11. Open one focused draft PR, record exact-head evidence, and stop at `AWAITING_REVIEW`.

G1 does **not** implement the complete Create My First Sign journey (G2), vector/raster guided workflow integration (G3), grouped repair/Fix safe problems (G4), full Learn Mode content and replay UX (G5), or owner-observed first-session validation (G6). It does not add new AI capability, material expansion, process profiles, export profiles, licensing, public beta, CAD/CAM, or machine control.

## One repo, one active gate, one next command

- G1 guided-shell implementation is the only active implementation target.
- G2 through G6 remain held.
- M16 and later milestones remain blocked.
- PR #69 remains draft and held planning input; it is not authority for active G1 and must be reconciled with current Codex governance before any later review.
- PR #68 remains held outside active M15 work.
- No implementation agent merges, advances, changes the active gate, or starts another task on its own.
- One `Continue LaserX` command authorizes one bounded Codex pass, then Codex stops.
- Next valid command: **`Continue LaserX`**

## Mandatory product interpretation

Every agent must read GitHub Issues #44 and #37 before planning or implementing post-M13 work.

LaserX remains an affordable, premium-feeling, machine-independent idea-to-manufacturable-product platform. First-time usability is central; deterministic sign creation works without AI; AI is optional and user-supplied; physical 3D is a major derived, non-mutating feature; the interface is workflow-first with progressive disclosure; and large finding sets become understandable repair decisions instead of raw tool walls.

## M15 gate order

1. **G0 — guided-workflow architecture and first-run contract** — merged and accepted
2. **G1 — first-launch goal chooser and resumable guidance shell** — **active**
3. **G2 — Create My First Sign guided vertical slice** — held
4. **G3 — vector import and raster trace contextual guidance** — held
5. **G4 — grouped repair decisions and Fix safe problems workflow** — held
6. **G5 — Learn Mode, replay, recovery, and contextual explanations** — held
7. **G6 — packaged accessibility and owner-observed first-session validation** — held

Each gate requires exact-head `Check LaserX`, a `READY` verdict, and explicit owner `Advance LaserX` from the designated primary operations chat before the next gate becomes active.

## M14 completion record

M14 is complete and accepted. Issue #30 contains the exact component merges, Windows build evidence, private installer provenance, owner screenshots, owner pass, and final closure audit. M15 must not reopen or broaden M14.

## Private-testing boundary

LaserX remains private test software until a later milestone explicitly approves outside distribution. Trusted public signing, publication, pricing activation, telemetry, and public support do not belong in G1.
