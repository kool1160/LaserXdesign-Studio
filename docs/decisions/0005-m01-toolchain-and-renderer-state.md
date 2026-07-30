# ADR 0005: M01 Toolchain and Renderer State

## Status

Accepted.

## Decision

Pin the M01 development baseline to:

- Node 24.18.1 LTS;
- pnpm 11.18.0;
- Electron 43.2.0;
- React and React DOM 19.2.8;
- Vite 8.2.0;
- TypeScript 6.0.3;
- Vitest 4.1.10;
- Playwright 1.62.0.

Use React component state for the M01 renderer projection. The authoritative
project session remains in the application layer in Electron main. Renderer
actions invoke application commands through preload and replace their local
projection with a validated state snapshot. Do not add a renderer state
library until editor history and selection requirements are known in M02/M03.

## Rationale

Node 24 is the active LTS line and satisfies every selected tool's published
engine range. TypeScript 6.0.3 is the newest stable version supported by the
maintained TypeScript ESLint toolchain; TypeScript 7 was rejected because its
parser peer range was not yet compatible. Exact dependency pins and the pnpm
lockfile make Windows development and CI repeatable.

M01 has one small state projection and no production document graph. React
state avoids prematurely choosing an editor-state library while keeping the
authoritative lifecycle independently testable.

## Alternatives

- Node 26 was rejected because it is Current rather than LTS.
- TypeScript 7.0.2 was evaluated and rejected due to the active
  `typescript-eslint` peer range.
- A renderer state library was deferred because M01 does not yet have the
  document/selection/history complexity that would justify it.

## Consequences

Corepack or an installed pnpm 11.18.0 is required. Dependency upgrades are
intentional changes that update this ADR and the lockfile. M02 may introduce a
renderer store only through a new decision grounded in editor requirements.
