# Current Project Status

## Active gate

**M15 — Guided Onboarding, Workflow-First UI, and Learn Mode**

- Active issue: #45
- Active milestone specification: `docs/milestones/M15-guided-onboarding-learn-mode.md`
- Implementation lead: Claude
- Independent planning, orchestration, exact-head audit, and acceptance authority: ChatGPT
- Owner authority: product direction and milestone advancement
- Codex: held unless explicitly assigned independent review, repair, comparison, environment, or specialist work
- Current slice: **G0 — guided-workflow architecture and first-run contract**

The owner explicitly advanced LaserX to M15 on 2026-08-05 after accepting M14. `Continue LaserX` authorizes Claude to implement only the bounded M15 G0 contract below and stop for exact-head review. M16 and later work remain blocked.

## Mandatory product interpretation

Every agent must read GitHub Issues #44 and #37 before planning or implementing post-M13 work.

LaserX is an affordable, premium-feeling, machine-independent idea-to-manufacturable-product platform.

Locked interpretation:

- first-time usability is central;
- deterministic sign creation works without AI;
- AI is optional and user-supplied;
- physical 3D is a major feature but remains derived and non-mutating;
- Inkscape and downstream machine software are companions;
- premium experience and generous pricing are product requirements;
- the interface is workflow-first and uses contextual controls with progressive disclosure;
- large finding sets are grouped into repair decisions, with **Fix safe problems** as the primary repair action when deterministic eligible repairs exist;
- research reduces uncertainty but does not authorize wholesale merges or set priority by itself.

## M14 — Production Physical 3D Preview Integration — complete

M14 completed G0 through G6. Issue #30 records the complete implementation, machine-verifiable evidence, private installer provenance, owner hands-on evidence, and final exact-head closure audit.

Accepted production base:

- **G0 — governance and architecture lock** — PR #54, merge `a3481541a7dd246a7c3d8074f6516de09bd5af75`
- **G1 — text-heavy scaling evidence** — PR #55, merge `0a9dd63e31fdc7e15918c8c4651492d9d1ee44ec`
- **G2 — pure physical scene package** — PR #56, merge `e8b10c67d61decd310ccf1d5a7ad76100047babb`
- **G3 — Three renderer adapter** — PR #57, merge `f0769507abfac2c7a999f509fad8ae348de8b86b`
- **G4A — renderer-safe integration foundation** — PR #61, merge `9ca320fe3cb7d82ad2d9c3a458790b7defbfded3`
- **G4B — lazy open-document preview screen** — PR #63, merge `cba0fbba3385f47cf59f4a026823256f91560639`
- **G4C — interaction, fallback, and cleanup** — PR #64, merge `c79f4b1ccce0b54fce26d0cdf1687cc79818f5bb`
- **G5 — privileged PNG capture** — PR #65, accepted head `d34c9cca2b7552551cfcd1efcd6fccd7baaa6a58`, merge `3f0d8dba70e0c218308d28d1917cd5584c928bd6`
- **G6 — exact-head Windows evidence and owner retest** — accepted on exact `main` `078d4637fe0660792ebe1513aebb31b6a8593c1f`

The exact private installer was built from the short physical clone at `C:\dev\laserx` with Node `v24.18.1`, pnpm `11.18.0`, clean Git status, exit code `0`, byte size `113120438`, and SHA-256 `e98788e589c81255f8cab2dc1aa751e773429579f3958379fe00d2fbf097e689`.

Owner hands-on result: M14 passed. The owner reported that everything worked very well and that the 3D experience was intuitive and simple. The submitted retest archive contained seven screenshots covering import, front, edge, perspective, exploded view, layer hide/show, and orbit/pan/zoom.

## Active G5 scope — completed historical contract

G5 owned the complete privileged PNG capture transaction and is retained here as a historical compatibility marker. It is not active M15 work.

## Active M15 G0 scope

G0 is architecture and contract lock only. It must make the later user-facing slices coherent without beginning a broad visual rewrite.

Required outcome:

- inventory the current first-launch, empty-state, create, vector-import, raster-trace, repair, 3D, save, and export flows against the packaged application;
- record a guided-workflow state-machine boundary separated from feature logic and authoritative project state;
- lock the three first-run goals: **Create My First Sign**, **Import My Own Design**, and **Describe What I Want With AI — Optional**;
- define the contextual-control matrix so each workflow shows one clear primary action and only relevant default controls;
- define skip, back, resume, replay, cancel, failure, and recovery behavior that cannot trap the user or mutate geometry invisibly;
- define local/privacy-respecting first-session evidence and the owner-observed ten-minute fixture set;
- lock accessibility, keyboard, focus, high-DPI, reduced-motion, and non-color-only guidance requirements;
- document the boundary between M15 onboarding work and existing authoritative geometry, cutability, save, export, security, and physical-preview contracts;
- add an ADR and mechanical contract checks where they can prevent drift;
- stop at `AWAITING_REVIEW` before implementing the full first-run shell or later M15 slices.

G0 may make only the smallest code or test harness change required to prove the architecture boundary. It must not become a UI redesign, geometry-engine rewrite, material expansion, process-profile system, export-profile system, licensing implementation, public beta, or M16 work.

## M15 approved execution order

1. **G0 — guided-workflow architecture and first-run contract** — active
2. **G1 — first-launch goal chooser and resumable guidance shell** — held
3. **G2 — Create My First Sign guided vertical slice** — held
4. **G3 — vector import and raster trace contextual guidance** — held
5. **G4 — grouped repair decisions and Fix safe problems workflow** — held
6. **G5 — Learn Mode, replay, recovery, and contextual explanations** — held
7. **G6 — packaged accessibility and owner-observed first-session validation** — held

Each slice requires exact-head review before the next slice is activated. Full execution rules live in `docs/CLAUDE_EXECUTION_PLAN.md` and ADR 0026.

## Research and later-work boundary

Issue #34 and Issue #42 remain accepted historical research inputs. Issue #39 and draft PR #40 remain isolated inputs for M16 and are not production-merge-authorized during M15.

M16 through M23 preserve the workflow-first product direction from Issues #44 and #37. M24 and M25 preserve the post-Version-1 machine-platform path behind explicit safety gates.

## Private-testing boundary

LaserX remains private test software until a later milestone explicitly approves outside distribution. Trusted public signing, publication, pricing activation, telemetry, and public support do not belong in M15 G0.
