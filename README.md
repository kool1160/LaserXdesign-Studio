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

M00 repository foundation is complete. **M01 — Desktop shell and project lifecycle** is the active milestone and the only production implementation scope currently allowed.

Start with [Issue #2](../../issues/2) and read these files before making changes:

1. [`AGENTS.md`](AGENTS.md)
2. [`docs/status/CURRENT.md`](docs/status/CURRENT.md)
3. [`docs/milestones/M01-desktop-shell.md`](docs/milestones/M01-desktop-shell.md)
4. [`docs/PRODUCT_REQUIREMENTS.md`](docs/PRODUCT_REQUIREMENTS.md)
5. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
6. [`docs/MILESTONES.md`](docs/MILESTONES.md)

## Planned stack

- Electron
- React
- TypeScript
- Vite
- pnpm workspaces
- Vitest
- Playwright

Geometry, file conversion, and cutability rules live outside the UI so they can be tested independently and reused later.

## Development

The M01 agent must select compatible maintained versions, commit the lockfile, and make these root commands operational:

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify
```

Until that M01 bootstrap is committed, the available foundation check is:

```bash
python scripts/repository_guard.py
```

See [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) for the complete workflow.

## Licensing note

No third-party trademark artwork or unlicensed commercial fonts may be committed to this repository. Bundled fonts must have a redistribution-compatible license. Users may work with fonts installed on their own computers, subject to those font licenses.
