# Current Project Status

## Active gate

**M15 — Guided Onboarding, Workflow-First UI, and Learn Mode**

- Active issue: **#45**
- Active milestone specification: `docs/milestones/M15-guided-onboarding-learn-mode.md`
- Current slice: **G0 — guided-workflow architecture and first-run contract**
- Implementation model: **SOL High** — owner-selected OpenAI coding model at High reasoning in the Codex coding workspace
- Planning, orchestration, exact-head review, status, holds, and advancement: **planning/review ChatGPT**
- Owner authority: product direction, model choice, hands-on acceptance, and advancement
- Claude / Anthropic: **held; no paid Anthropic work without a new explicit owner authorization**

The owner restored the original operator-command workflow on **2026-08-06**:

> Chat decides. GitHub remembers. SOL High executes. Pull requests hold the evidence. The owner receives the verdict and next command.

Only `Continue LaserX` goes to the SOL High implementation thread. `Plan LaserX`, `Lock that into LaserX`, `Check LaserX`, `Status LaserX`, `Hold LaserX`, and `Advance LaserX` remain in the planning/review chat.

## Current PR state

- Pull request: **#67 — M15 G0 guided-workflow architecture and first-run contract**
- Exact head: `9cf4458bef5d8cc39814e6b9e94de221fa8228e0`
- PR state: open, draft, mergeable, unmerged
- Implementation state: **AWAITING_REVIEW**
- Exact-head CI: **12 pull-request workflows completed successfully**
- G1 work: not begun
- Next valid command: **`Check LaserX`**

No implementation agent should touch PR #67 merely because it is green. The planning/review chat must first issue an exact-head `READY`, `REPAIR`, or `BLOCKED` verdict.

If the verdict is `REPAIR`, the owner sends `Continue LaserX` to SOL High. If the verdict is `READY`, the owner sends `Advance LaserX` to the planning/review chat.

## One repo, one active gate, one next command

- M15 G0 is the only active implementation gate.
- G1 through G6 remain held.
- M16 and later milestones remain blocked.
- No background agent, heartbeat, scheduled polling, or self-waking implementation session is authorized.
- No automatic routine merge is authorized. `Advance LaserX` is required after `READY`.

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

## Active M15 G0 contract

G0 is architecture and contract lock only. It must make later user-facing slices coherent without beginning a broad visual rewrite.

Required outcome:

- inventory the current first-launch, empty-state, create, vector-import, raster-trace, repair, 3D, save, and export flows;
- record a guided-workflow state-machine boundary separated from feature logic and authoritative project state;
- lock **Create My First Sign**, **Import My Own Design**, and **Describe What I Want With AI — Optional**;
- define a contextual-control matrix and one clear primary action per guided step whenever practical;
- define skip, back, resume, replay, cancel, failure, and recovery behavior that cannot trap the user;
- define local/privacy-respecting first-session evidence and the owner-observed ten-minute fixture set;
- lock keyboard, focus, high-DPI, reduced-motion, screen-reader, and non-color-only guidance requirements;
- document boundaries against authoritative geometry, cutability, save, export, security, and physical-preview systems;
- add an ADR and mechanical checks where they genuinely prevent drift;
- make only the smallest implementation or harness change needed to prove the architecture;
- stop at `AWAITING_REVIEW` before visible G1 implementation.

G0 does not authorize onboarding UI, the persistence store, grouped repair implementation, material expansion, process profiles, export profiles, new AI capability, licensing, public beta, CAD/CAM, or machine control.

## M15 gate order

1. **G0 — guided-workflow architecture and first-run contract** — active, awaiting review
2. **G1 — first-launch goal chooser and resumable guidance shell** — held
3. **G2 — Create My First Sign guided vertical slice** — held
4. **G3 — vector import and raster trace contextual guidance** — held
5. **G4 — grouped repair decisions and Fix safe problems workflow** — held
6. **G5 — Learn Mode, replay, recovery, and contextual explanations** — held
7. **G6 — packaged accessibility and owner-observed first-session validation** — held

Each gate requires `Check LaserX`, a `READY` verdict, and explicit owner `Advance LaserX` before the next gate is activated. Activation does not start implementation; a later `Continue LaserX` does.

## Open planning and maintenance PRs

- **PR #69** — workflow-first M15/M22 planning amendment — remains draft and held. It does not activate G1. Before merge, its execution-plan references must be migrated from the superseded Claude plan to `docs/SOL_EXECUTION_PLAN.md` and reviewed under the restored command workflow.
- **PR #68** — grouped dependency update — remains held outside active M15 G0. Do not mix it into PR #67.

## M14 completion record

M14 is complete and accepted. Issue #30 contains the exact component merges, Windows build evidence, private installer provenance, owner screenshots, owner pass, and final closure audit. M15 must not reopen or broaden M14.

## Private-testing boundary

LaserX remains private test software until a later milestone explicitly approves outside distribution. Trusted public signing, publication, pricing activation, telemetry, and public support do not belong in M15 G0.
