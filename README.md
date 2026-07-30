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

Repository foundation and architecture are being established. The first implementation milestone is the desktop shell and editable project lifecycle.

Read these files before making changes:

1. [`AGENTS.md`](AGENTS.md)
2. [`docs/PRODUCT_REQUIREMENTS.md`](docs/PRODUCT_REQUIREMENTS.md)
3. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
4. [`docs/MILESTONES.md`](docs/MILESTONES.md)
5. [`docs/status/CURRENT.md`](docs/status/CURRENT.md)

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

The repository bootstrap intentionally provides architecture and package boundaries before feature implementation. Once Milestone 1 begins, the standard commands will be:

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

See [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) for the complete workflow.

## Licensing note

No third-party trademark artwork or unlicensed commercial fonts may be committed to this repository. Bundled fonts must have a redistribution-compatible license. Users may work with fonts installed on their own computers, subject to those font licenses.
