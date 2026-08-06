# Current Project Status

## Active gate

**M15 — Guided Onboarding, Workflow-First UI, and Learn Mode**

- Active issue: **#45**
- Active milestone specification: `docs/milestones/M15-guided-onboarding-learn-mode.md`
- Current slice: **G1 — Codex-only governance reset and guided-shell activation**
- Implementation surface: **Codex**
- Implementation model: **selected by the owner inside Codex for each session; the repository does not choose or auto-route a model**
- Planning, orchestration, exact-head review, status, holds, and advancement: **planning/review ChatGPT**
- Owner authority: product direction, model choice, hands-on acceptance, and advancement
- Claude, Anthropic, Fable, and other external paid implementation routes: **removed from active operation; no automatic or implied use**

The owner explicitly reset the operating model on **2026-08-06**:

> Chat decides. GitHub remembers. Codex executes. The owner chooses the Codex model. Pull requests hold the evidence. External paid models do not self-start, continue, review, or repair LaserX.

Only `Continue LaserX` goes to Codex. `Plan LaserX`, `Lock that into LaserX`, `Check LaserX`, `Status LaserX`, `Hold LaserX`, and `Advance LaserX` remain in the planning/review chat.

## M15 G0 completion record

- Pull request: **#67 — M15 G0 guided-workflow architecture and first-run contract**
- Reviewed head: `f1109191676766dfeaa833ec327f842bd6eab71b`
- Squash merge: `90946f7db42ac2cc2be3532bf49bdcdfe0d885ed`
- Result: **accepted and merged**
- Exact-head evidence included the canonical repository guard, `pnpm verify`, 312 desktop tests, packaged Windows build, 36 packaged E2E tests, and artifact upload on the reviewed head.
- Historical milestone workflows that failed or were cancelled before checkout during the GitHub Actions incident were not treated as product-code failures.

## Active G1 first task — governance and CI normalization

Before visible G1 onboarding implementation begins, Codex must perform one bounded governance repair from latest `main`:

1. Make **Codex** the only active implementation surface.
2. Remove fixed model names from active routing; the owner selects the model inside Codex.
3. Remove Claude, Anthropic, and Fable from active implementation, review, continuation, and fallback paths. Historical ADRs may remain clearly superseded for audit history, but they carry no execution authority.
4. Rename or replace model-specific active execution documents so the active contract is Codex-based rather than SOL-, Claude-, Anthropic-, or Fable-based.
5. Update `AGENTS.md`, `docs/OPERATOR_PROTOCOL.md`, `docs/WORKSTREAM_OWNERSHIP.md`, active execution-plan references, and repository-guard regression coverage to agree.
6. Restore the intended CI rule: the active gate names its required checks. Completed historical milestone workflows are not permanent independent merge blockers on every later PR.
7. Consolidate required PR verification around one policy/guard check and one canonical exact-head verification path, with focused packaged Windows checks only when the active gate or changed paths require them. Release/signing workflows remain release-gate checks.
8. Preserve real regression coverage; do not weaken product, geometry, security, units, persistence, packaging, or accessibility tests.
9. Do not begin visible onboarding UI, persistence-store implementation, IPC, grouped repair, or later G1 product work in this governance pass.
10. Open one focused draft PR, record exact verification, and stop at `AWAITING_REVIEW`.

## One repo, one active gate, one next command

- G0 is merged and closed.
- The governance/CI normalization task above is the only active implementation target.
- Visible G1 product implementation is held until that governance PR is reviewed, merged, and explicitly advanced.
- G2 through G6 remain held.
- M16 and later milestones remain blocked.
- No background agent, heartbeat, scheduled polling, self-waking session, or paid external-model continuation is authorized.
- No implementation agent merges, advances, or starts another task on its own.
- One `Continue LaserX` command authorizes one bounded Codex pass, then Codex stops.
- Next valid command: **`Continue LaserX`**

## Mandatory product interpretation

Every agent must read GitHub Issues #44 and #37 before planning or implementing post-M13 work.

LaserX is an affordable, premium-feeling, machine-independent idea-to-manufacturable-product platform.

Locked interpretation:

- first-time usability is central;
- deterministic sign creation works without AI;
- AI is optional and user-supplied;
- physical 3D is a major derived, non-mutating feature;
- Inkscape and downstream machine software are companions;
- the interface is workflow-first and uses contextual controls with progressive disclosure;
- large finding sets are grouped into repair decisions, with **Fix safe problems** primary when deterministic eligible repairs exist;
- premium experience and generous pricing are product requirements;
- research reduces uncertainty but does not authorize wholesale merges or establish priority by itself.

## M15 gate order

1. **G0 — guided-workflow architecture and first-run contract** — merged and accepted
2. **G1 — first-launch goal chooser and resumable guidance shell** — active, beginning with governance/CI normalization
3. **G2 — Create My First Sign guided vertical slice** — held
4. **G3 — vector import and raster trace contextual guidance** — held
5. **G4 — grouped repair decisions and Fix safe problems workflow** — held
6. **G5 — Learn Mode, replay, recovery, and contextual explanations** — held
7. **G6 — packaged accessibility and owner-observed first-session validation** — held

Each gate requires exact-head review and explicit owner advancement before the next gate becomes active. Activation does not authorize implementation beyond the one bounded task recorded here.

## Open planning and maintenance PRs

- **PR #69** — workflow-first M15/M22 planning amendment — remains draft and held. It must be updated to Codex-only terminology before review or merge.
- **PR #68** — grouped dependency update — remains held outside active M15 work.

## M14 completion record

M14 is complete and accepted. Issue #30 contains the exact component merges, Windows build evidence, private installer provenance, owner screenshots, owner pass, and final closure audit. M15 must not reopen or broaden M14.

## Private-testing boundary

LaserX remains private test software until a later milestone explicitly approves outside distribution. Trusted public signing, publication, pricing activation, telemetry, and public support do not belong in the active G1 governance pass.
