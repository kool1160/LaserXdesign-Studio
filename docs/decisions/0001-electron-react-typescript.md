# ADR 0001: Electron, React, and TypeScript

## Status

Accepted. Exact M01 versions are recorded in ADR 0005.

## Decision

Use Electron for the Windows desktop shell, React for renderer composition, and TypeScript across application and pure-core packages.

## Rationale

This stack supports fast desktop iteration, mature UI tooling, filesystem integration through a controlled main process, and a large ecosystem that coding agents can test and maintain.

## Consequences

Electron security configuration is mandatory. Geometry logic remains outside React and Electron so the core can later move to another runtime if needed.
