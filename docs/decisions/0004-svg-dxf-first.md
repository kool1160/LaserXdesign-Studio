# ADR 0004: SVG and DXF Before DWG

## Status

Accepted.

## Decision

Use SVG as the main editable interchange format and DXF as the main manufacturing interchange format for version 1. Native DWG is deferred.

## Rationale

SVG and DXF provide broad interoperability without committing the project to proprietary DWG authoring complexity.

## Consequences

Scale and round-trip fixtures are mandatory. The application must never label DXF output as DWG.
