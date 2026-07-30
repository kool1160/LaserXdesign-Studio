# ADR 0003: Domain and Renderer Separation

## Status

Accepted.

## Decision

The renderer projects domain state but does not own manufacturing geometry or project serialization.

## Rationale

Geometry correctness, undo/redo, file migration, and export must remain testable without launching Electron or rendering a canvas.

## Consequences

UI components dispatch application commands. Direct geometry mutation in React components is prohibited.
