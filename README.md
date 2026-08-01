# LaserX Design Studio

LaserX Design Studio is a Windows-first 2D design application for creating editable, cut-ready metal signs from text, vector artwork, raster images, and natural-language prompts.

The product is intentionally narrower than a general CAD program. It focuses on the workflow needed to design signs for plasma, laser, waterjet, and router cutting:

- create and edit vector artwork;
- use installed and properly licensed bundled fonts;
- trace PNG and JPEG artwork into clean paths;
- detect islands, open contours, duplicate geometry, and details that are too small to cut;
- add bridges and backing plates;
- preview retained metal versus drop-out regions;
- export dimensionally correct SVG and DXF files.

## Project status

The README is not the milestone status authority.

Read [`docs/status/CURRENT.md`](docs/status/CURRENT.md) for the one active gate, then read its milestone specification and GitHub issue. Open pull requests, review threads, and required GitHub workflow results are the authority for work currently under review.

Do not use an old handoff, previous milestone branch, temporary Codex working directory, or stale chat summary as current project state.

## Owner and agent workflow

LaserX uses a GitHub-native operating loop so the owner does not have to carry markdown or completion reports between chats and Codex.

Read [`docs/OPERATOR_PROTOCOL.md`](docs/OPERATOR_PROTOCOL.md) for the complete command/state flow.

Core commands:

- `Plan LaserX: <idea>` - discuss product intent without changing the repository yet.
- `Lock that into LaserX` - record the accepted decision in the correct GitHub source.
- `Continue LaserX` - Codex implements or repairs the active gate and stops for review.
- `Check LaserX` - review the active PR directly and keep detailed findings on GitHub.
- `Advance LaserX` - merge a verified ready gate, update status, and activate the next issue.
- `Status LaserX` - report current state without changing anything.
- `Hold LaserX` - pause new work without discarding the current branch or PR.

Before making changes, read:

1. [`AGENTS.md`](AGENTS.md)
2. [`docs/OPERATOR_PROTOCOL.md`](docs/OPERATOR_PROTOCOL.md)
3. [`docs/status/CURRENT.md`](docs/status/CURRENT.md)
4. the active milestone document
5. the active GitHub issue and pull request
6. [`docs/PRODUCT_REQUIREMENTS.md`](docs/PRODUCT_REQUIREMENTS.md)
7. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
8. [`docs/MILESTONES.md`](docs/MILESTONES.md)

## Pinned stack

- Node 24.18.1 LTS and pnpm 11.18.0
- Electron 43.2.0
- React 19.2.8
- TypeScript 6.0.3
- Vite 8.2.0
- Vitest 4.1.10
- Playwright 1.62.0

Geometry, file conversion, and cutability rules live outside the UI so they can be tested independently and reused later.

## Development

Install the pinned toolchain and dependencies:

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify
```

`pnpm test:e2e` packages and launches the Windows application. `pnpm verify` runs lint, typecheck, unit/integration tests, build, package, and packaged end-to-end tests.

M06 SVG/DXF interoperability keeps native paths and untrusted file contents in
Electron main. Import is preview-first and commits as one undoable edit. Export
writes explicit millimeter metadata and reports path count, warnings, units,
and bounds. The exact supported-entity and unit matrix is documented in
[`docs/FILE_FORMATS.md`](docs/FILE_FORMATS.md).

M07 raster tracing keeps PNG/JPEG paths and pixels out of renderer requests,
runs deterministic preprocessing and tracing in a cancellable bounded worker,
and previews original, black/white, edge, trace, and aligned overlay views.
Accepted candidates become ordinary editable paths through one undoable
command and immediately enter manufacturing review.

M08 persists editable process/material/thickness and kerf/feature/bridge/gap/
spacing settings in schema v6. A cancellable worker reports measured issues,
classifies retained/removed regions under an explicit stock assumption, and
keeps ambiguous topology visibly ambiguous. Manual and automatic bridge
proposals leave the project untouched until acceptance through one undoable
topology command. Presets are transparent starting points, and no result claims
certified manufacturability or cut readiness.

See [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) for the complete development workflow.

## Licensing note

No third-party trademark artwork or unlicensed commercial fonts may be committed to this repository. Bundled fonts must have a redistribution-compatible license. Users may work with fonts installed on their own computers, subject to those font licenses.
