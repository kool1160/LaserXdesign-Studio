# LaserX Design Studio

LaserX Design Studio is an affordable, premium-feeling, Windows-first, machine-independent idea-to-manufacturable-product platform for flat-cut signs and layered products.

It helps makers move from an idea to editable, validated, physically previewed, correctly scaled geometry without wasting half the evening preparing the design.

> Spend your time making the sign, not preparing to make the sign.

LaserX is not plasma-control software, a general CAD replacement, a generic vector editor, or an AI-dependent product.

LaserX creates the product. The user's existing downstream software—such as Inkscape, LightBurn, plasma CAM/controller software, fiber-laser software, router CAM, or waterjet software—continues artistic editing or operates the machine.

## What LaserX does

- creates signs with deterministic text, shapes, borders, backing plates, holes, and templates without AI;
- imports editable SVG and DXF artwork;
- traces PNG and JPEG artwork into editable vector paths;
- detects islands, open contours, overlaps, fragile details, and other manufacturing concerns;
- proposes explicit previewable repairs and bridges;
- manages physical layers, truthful material identity, and exact thickness;
- presents the finished sign as an interactive, non-mutating physical 3D object;
- exports dimensionally correct SVG, DXF, and approved production packages;
- optionally uses user-supplied AI access for concepts, variations, wording help, and reference-image interpretation.

Normal sign creation, editing, validation, project storage, 3D preview, and export do not require an AI account or API key.

## Product direction

GitHub Issues #44 and #37 are mandatory planning context for post-M13 work.

The primary product requirement is first-time usability:

> Open LaserX. Pick what you are trying to do. Follow the prompts. Make the sign. Preview it. Export it.

The measurable goal is that a first-time user can create or import a design, understand the major manufacturing warnings, view the product in 3D, and export a usable file within ten minutes.

LaserX is intended to feel premium while remaining generously priced. Licensing, trial, and purchase mechanics are owner-controlled future milestone work and must not be replaced with conventional SaaS assumptions.

## Project status

The README is not the milestone-status authority.

Read [`docs/status/CURRENT.md`](docs/status/CURRENT.md) for the one active gate, assigned implementation lead, approved slice, and next valid work. Then read the active milestone specification and GitHub issue.

Do not use an old chat handoff, previous milestone branch, temporary worktree, or experiment branch as current project truth.

## Owner and agent workflow

LaserX uses a GitHub-native operating loop:

- **Owner** decides product direction and advancement.
- **Claude** implements or repairs one bounded active-milestone slice and stops for review.
- **ChatGPT** writes accepted planning decisions, performs independent exact-head audits, posts findings to GitHub, and merges/advances after owner command.
- **Codex** remains held unless the owner explicitly assigns a task.

Read [`AGENTS.md`](AGENTS.md), [`docs/OPERATOR_PROTOCOL.md`](docs/OPERATOR_PROTOCOL.md), and [`docs/CLAUDE_EXECUTION_PLAN.md`](docs/CLAUDE_EXECUTION_PLAN.md) for the complete contracts.

Core commands:

- `Plan LaserX: <idea>` — discuss product intent without changing the repository.
- `Lock that into LaserX` — record an accepted decision in GitHub.
- `Continue LaserX` — Claude implements or repairs only the approved active slice and stops.
- `Check LaserX` — ChatGPT independently audits the exact PR head.
- `Advance LaserX` — ChatGPT merges and records a verified owner-approved advancement.
- `Status LaserX` — report current state without changing it.
- `Hold LaserX` — pause new work without discarding current progress.

Before changing code, read:

1. [`AGENTS.md`](AGENTS.md)
2. GitHub Issues #44 and #37
3. [`docs/OPERATOR_PROTOCOL.md`](docs/OPERATOR_PROTOCOL.md)
4. [`docs/WORKSTREAM_OWNERSHIP.md`](docs/WORKSTREAM_OWNERSHIP.md)
5. [`docs/status/CURRENT.md`](docs/status/CURRENT.md)
6. the active milestone document
7. the active GitHub issue and pull request
8. [`docs/PRODUCT_REQUIREMENTS.md`](docs/PRODUCT_REQUIREMENTS.md)
9. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
10. [`docs/MILESTONES.md`](docs/MILESTONES.md)

## Current roadmap

Completed foundations run through M13. The approved post-M13 sequence is:

- M14 — production physical 3D preview integration;
- M15 — guided onboarding and Learn Mode;
- M16 — material catalog and wood/acrylic expansion;
- M17 — process-aware manufacturability profiles;
- M18 — downstream software export profiles;
- M19 — optional AI idea-to-cuttable onboarding;
- M20 — licensing, trial, and purchase experience;
- M21 — community beta distribution readiness;
- M22 — real-user usability validation;
- M23 — Version 1.0 release and broader-market launch;
- M24 — simulator-first machine platform foundation;
- M25 — first explicitly approved controller vertical slice.

Detailed acceptance criteria live in [`docs/MILESTONES.md`](docs/MILESTONES.md) and `docs/milestones/`.

Temporary Claude capacity may accelerate the active approved milestone. It never changes roadmap priority, authorizes parallel production work, or replaces independent audit.

## Pinned stack

- Node 24.18.1 LTS and pnpm 11.18.0
- Electron 43.2.0
- React 19.2.8
- TypeScript 6.0.3
- Vite 8.2.0
- Vitest 4.1.10
- Playwright 1.62.0

Geometry, file conversion, manufacturing analysis, physical scene conversion, and material rules live outside React where practical so they remain deterministic, testable, and reusable.

## Development

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify
```

`pnpm test:e2e` packages and launches the Windows application. `pnpm verify` runs the repository's required audits, lint, typechecks, tests, build/package, and packaged end-to-end coverage.

M13 established the private Windows installer and release mechanics. Public sale or distribution remains blocked until a later milestone approves trusted signing, publication, licensing, support, and distribution behavior.

## Licensing and intellectual property

No third-party trademark artwork, proprietary sample artwork, or unlicensed commercial fonts may be committed. Bundled fonts require redistribution-compatible licensing and provenance. Users may work with fonts installed on their own computers subject to those licenses.

Optional AI output must become ordinary editable geometry and pass the same normalization and manufacturing checks as deterministic or imported work.
