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

M00 and M01 are complete. **M02 — Canonical document model and viewport** is
the active milestone. Its implementation is under Issue #3 review; M03 remains
blocked until the M02 pull request passes Windows CI and is merged.

Start with [Issue #3](../../issues/3) and read these files before making changes:

1. [`AGENTS.md`](AGENTS.md)
2. [`docs/status/CURRENT.md`](docs/status/CURRENT.md)
3. [`docs/milestones/M02-document-viewport.md`](docs/milestones/M02-document-viewport.md)
4. [`docs/PRODUCT_REQUIREMENTS.md`](docs/PRODUCT_REQUIREMENTS.md)
5. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
6. [`docs/MILESTONES.md`](docs/MILESTONES.md)

## Pinned stack

- Node 24.18.1 LTS and pnpm 11.18.0
- Electron 43.2.0
- React 19.2.8
- TypeScript 6.0.3
- Vite 8.2.0
- Vitest 4.1.10
- Playwright 1.62.0

Geometry, file conversion, and cutability rules live outside the UI so they can be tested independently and reused later.

## M02 capability

The packaged Windows application can create exact-size millimeter or inch
documents, switch display units without changing stored geometry, navigate a
Cartesian workspace with rulers/grid/pan/zoom/fit/reset, and save/reopen
schema-v2 projects. Schema-v1 projects migrate on read. Selection and M03+
editing features are intentionally absent.

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

`pnpm test:e2e` packages and launches the Windows application. `pnpm verify`
runs lint, typecheck, unit/integration tests, build, package, and packaged
end-to-end tests.

See [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) for the complete workflow.

## Licensing note

No third-party trademark artwork or unlicensed commercial fonts may be committed to this repository. Bundled fonts must have a redistribution-compatible license. Users may work with fonts installed on their own computers, subject to those font licenses.
