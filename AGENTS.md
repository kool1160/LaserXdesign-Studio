# AGENTS.md — LaserX Design Studio

This file is the primary operating contract for every coding agent working in this repository. Read it completely before changing code, tests, configuration, architecture, or documentation.

## 1. Mission

Build a Windows-first 2D sign-design application that turns text, SVG artwork, PNG/JPEG images, and natural-language prompts into editable, dimensionally correct, cut-ready vector designs for plasma, laser, waterjet, and router workflows.

The application is not a general replacement for AutoCAD, SolidWorks, LightBurn, SheetCam, or CAM software. It is a focused sign-design tool that removes the repetitive work between an idea and clean DXF/SVG geometry.

## 2. Product promise

A user must be able to:

1. Start from text, basic shapes, imported artwork, a raster image, or a prompt.
2. Edit the result as real vector geometry.
3. Set exact physical dimensions in inches or millimeters.
4. Detect geometry that is unsafe or impractical to cut.
5. Add bridges, borders, backing plates, holes, and layered-sign features.
6. Preview retained metal and drop-out regions.
7. Export correctly scaled SVG and DXF files for downstream CAM.

AI-generated artwork is only a starting point. It must never be a locked bitmap or bypass the same geometry validation applied to manually created designs.

## 3. Source-of-truth order

When instructions conflict, use this order:

1. Explicit user instruction for the current task.
2. This `AGENTS.md` file.
3. `docs/status/CURRENT.md` for the active milestone and allowed scope.
4. The active milestone document in `docs/milestones/`.
5. `docs/PRODUCT_REQUIREMENTS.md`.
6. `docs/ARCHITECTURE.md` and accepted ADRs in `docs/decisions/`.
7. Existing tests and established code conventions.

Do not silently resolve a genuine conflict. Record it in `docs/status/DECISIONS_NEEDED.md` and choose the smallest reversible implementation that preserves existing behavior.

## 4. Mandatory reading before work

Before implementing any feature:

- read this file;
- read `docs/status/CURRENT.md`;
- read the active milestone specification;
- inspect neighboring packages and tests;
- read relevant ADRs;
- run the current verification commands when implementation exists.

Do not start a later milestone because it appears convenient. Milestones are gates, not suggestions.

## 5. Locked product principles

### 5.1 Editable first

Generated, traced, imported, or typed content must become editable objects or paths. Flattened previews are acceptable only as temporary artifacts.

### 5.2 Exact dimensions

A design shown as 24 inches wide must export as 24 inches wide within the documented tolerance. Screen pixels are never authoritative manufacturing units.

### 5.3 Manufacturing-aware, not CAM

The application may analyze cutability and export geometry. It does not generate machine motion, lead-ins, pierce delays, consumable settings, THC parameters, or G-code in version 1.

### 5.4 Safe defaults, visible warnings

Never silently delete or alter user geometry during import, simplification, bridging, or export. Show proposed changes and preserve undoability.

### 5.5 Local-first projects

Normal editing and project storage must work without an internet connection. AI generation may require a network connection, but the editor, import, validation, save, and export workflows may not.

### 5.6 Narrow before broad

Prefer one excellent sign workflow over ten partially implemented CAD features. Reject scope that recreates a general-purpose CAD system unless it is explicitly approved in a future milestone.

## 6. Technology direction

The planned stack is:

- Electron desktop shell;
- React and TypeScript for the renderer UI;
- Vite for development and bundling;
- pnpm workspaces;
- Vitest for unit and integration tests;
- Playwright for end-to-end desktop workflows;
- pure TypeScript packages for domain logic where practical;
- Web Workers for expensive tracing or geometry work when needed;
- optional native/WASM acceleration only after profiling proves a need.

Do not add a second UI framework, state library, geometry engine, or desktop runtime without an ADR.

Version selection happens during Milestone 1 and must use compatible, actively maintained releases. Commit the lockfile once dependencies are chosen.

## 7. Repository boundaries

Expected top-level layout:

```text
apps/desktop/              Electron + React desktop application
packages/application/      commands, use cases, orchestration
packages/domain/           document model and invariants
packages/geometry/         pure geometry operations and tolerances
packages/cutability/       manufacturing analysis and repair proposals
packages/fonts/            font discovery, metadata, licensing, text outlines
packages/import-raster/    raster preprocessing and vector tracing adapters
packages/io-svg/           SVG import/export
packages/io-dxf/           DXF import/export
packages/project-format/   native project serialization and migrations
packages/ai/               prompt/image generation provider boundary
packages/ui/               reusable presentation components
packages/test-fixtures/    fixture builders and golden comparison helpers
apps/desktop/tests/        desktop integration and end-to-end tests
fixtures/                  reviewed raster/vector/DXF/project fixtures
docs/                      requirements, architecture, milestones, ADRs
tools/                     developer-only inspection and fixture utilities
native/                    reserved for measured performance bottlenecks
```

### Boundary rules

- React components must not contain geometry algorithms.
- Electron main/preload code must not contain document-model behavior.
- `packages/domain` must not import React, Electron, canvas libraries, or Node-only APIs.
- `packages/geometry` must be deterministic and UI-independent.
- `packages/cutability` may depend on domain and geometry, never on React or Electron.
- Importers produce normalized domain objects plus warnings; they do not mutate an open document directly.
- Exporters consume normalized snapshots and explicit export settings.
- `packages/ai` returns concepts or candidate geometry; it cannot write project files or bypass validation.

## 8. Canonical units and coordinate rules

Unless an accepted ADR changes this:

- canonical stored length unit: millimeters;
- UI display units: millimeters or inches;
- canonical angles: degrees in user-facing models, radians only inside mathematical functions;
- domain coordinate system: Cartesian, positive X right, positive Y up;
- renderer adapters may convert to screen coordinates where positive Y is down;
- conversion occurs at the boundary and must be tested;
- no geometry API may accept ambiguous unitless external values.

Use explicit names such as `widthMm`, `kerfMm`, or typed unit wrappers. Avoid names such as `size`, `distance`, or `tolerance` when the unit is not obvious.

## 9. Geometry rules

All geometry work must be deterministic for the same input and settings.

Every path must declare whether it is open or closed. Closed contours must not rely on a repeated final point unless the selected representation requires it.

Centralize tolerances. Do not scatter magic epsilon values across packages.

Operations that can change topology—union, subtraction, intersection, offset, simplification, bridging, tracing, and contour repair—must return:

- resulting geometry;
- warnings;
- discarded or replaced entity identifiers;
- a summary suitable for the UI;
- enough information to support undo or command reversal.

Never treat visual overlap as geometric union.

## 10. Document and command model

The editor must use a serializable document model and command-based mutations.

Required properties:

- stable object identifiers;
- explicit z-order/layer membership;
- transform and style data separated from raw geometry where practical;
- deterministic serialization;
- undo/redo through commands or reversible transactions;
- project-format migrations;
- dirty-state tracking;
- no direct mutation from arbitrary UI components.

A React state snapshot is not the project file format.

## 11. Cutability semantics

The cutability engine analyzes geometry using explicit machine/material settings. It must distinguish:

- open contour;
- duplicate or overlapping segment;
- self-intersection;
- disconnected island;
- enclosed drop-out region;
- bridge below minimum width;
- feature below minimum width;
- gap below minimum process capability;
- contour too close to another contour;
- geometry likely to disappear after kerf compensation;
- unsupported or ambiguous geometry.

Warnings must include severity, object/segment references, measured value, configured limit, and a human-readable repair suggestion.

Automatic repair is always a proposed, previewable, undoable operation. Do not promise that a design is physically safe merely because automated checks pass.

## 12. Fonts and intellectual property

- Bundle only fonts with documented redistribution rights, such as compatible open-source licenses.
- Store license files and attribution for every bundled font.
- Do not commit commercial font binaries.
- Installed system fonts may be enumerated and used locally subject to the user's license.
- Convert text to outlines before manufacturing export when required for portability.
- Preserve editable text in the native project whenever possible.
- Do not bundle third-party trademark logos or copied branded badge templates.
- Prompt examples may describe a general style, but should not instruct the system to reproduce a protected logo exactly.

## 13. AI pipeline rules

AI features are provider-isolated and optional.

- Keep provider credentials out of source control and renderer code.
- Route secret-bearing requests through a secure main-process or service boundary.
- Validate all generated geometry like imported geometry.
- Preserve prompt, provider, model identifier, generation settings, and transformation history in project metadata only when the user saves them.
- Generated images must pass through preprocessing, tracing, normalization, and cutability analysis before export.
- Never send unrelated local project contents to an AI provider.
- A project must remain openable when the provider is unavailable.

## 14. File format rules

### Native project

Use a versioned, documented native format. It must preserve editable text, layers, object IDs, transforms, machine presets, generation metadata, and migration history.

### SVG

SVG is the preferred editable interchange format. Preserve dimensions, viewBox, transforms, path closure, and units. Test import-export round trips.

### DXF

DXF is the primary manufacturing interchange format for version 1. Export documented 2D entities, preserve physical scale, and avoid unsupported styling masquerading as geometry. Native DWG editing is explicitly out of scope.

### Raster

Raster images are references or tracing inputs, never manufacturing export geometry.

## 15. Security rules

- Electron renderer must not have unrestricted Node access.
- Use context isolation and a narrow, typed preload API.
- Validate file paths and IPC payloads.
- Treat imported SVG and project files as untrusted.
- Do not execute scripts embedded in imported content.
- Do not load remote content into privileged renderer contexts.
- Never log API keys, tokens, full private prompts, or user file contents in production telemetry.

## 16. Work protocol for Codex

For every task:

1. Restate the active milestone and exact deliverable in the work log or PR description.
2. Inspect before editing.
3. Implement the smallest complete vertical slice allowed by the milestone.
4. Add or update tests in the same change.
5. Run the required checks.
6. Update documentation when behavior, architecture, commands, or status changes.
7. Report changed files, tests run, results, assumptions, and remaining risks.

Do not leave placeholder implementations that falsely report success. A visible `Not implemented` state is better than fake geometry or fake export.

## 17. Milestone gate policy

The active milestone is named in `docs/status/CURRENT.md`.

An agent may not begin the next milestone until all of the following are true:

- every required acceptance test passes;
- required automated tests exist;
- no severity-1 defects remain;
- known limitations are documented;
- current status is updated;
- the milestone exit checklist is explicitly marked complete.

Work from a later milestone may be considered only when it is required to complete the active vertical slice. Keep such work behind a narrow interface and do not expand it.

## 18. Large milestone sequence

Detailed specifications live in `docs/milestones/`.

- M00 — Repository foundation and contracts.
- M01 — Desktop shell and project lifecycle.
- M02 — Canonical document model and viewport.
- M03 — Selection, transforms, layers, and undo/redo.
- M04 — Text, fonts, and outline conversion.
- M05 — Node editing and boolean geometry operations.
- M06 — Dimensionally correct SVG and DXF interoperability.
- M07 — PNG/JPEG preprocessing and vector tracing.
- M08 — Cutability analysis, bridges, and manufacturing preview.
- M09 — Sign-building tools, borders, holes, templates, and backing plates.
- M10 — Prompt/image-to-sign AI pipeline.
- M11 — Layered-sign workflow and production export packages.
- M12 — Packaging, performance, accessibility, and beta hardening.

Post-v1 ideas such as nesting, CAM, cloud collaboration, mobile editing, 3D visualization, and native DWG are deferred unless promoted through a new milestone and ADR.

## 19. Testing expectations

Use the testing pyramid appropriate to geometry software:

- unit tests for domain rules, conversions, geometry, and file parsing;
- property-based tests where invariants matter;
- golden fixtures for SVG/DXF/tracing results;
- integration tests for command history and import/export;
- end-to-end tests for critical desktop workflows;
- manual cut-file review fixtures for representative sign designs.

Every bug fix requires a regression test when technically feasible.

Never update a golden file only to make a failing test green. Explain and review the geometric change.

## 20. Verification commands

Once Milestone 1 establishes the toolchain, the expected root commands are:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm verify
```

Until then, use the repository-structure workflow and document any command that is intentionally unavailable.

## 21. Git and change discipline

- Keep commits focused and reviewable.
- Use conventional commit prefixes where practical: `feat`, `fix`, `test`, `docs`, `refactor`, `chore`, `build`, `ci`.
- Do not commit generated installers, local settings, credentials, font binaries without licenses, or proprietary sample artwork.
- Do not rewrite public history without explicit instruction.
- Do not mix architecture migrations with unrelated UI styling.
- Include before/after screenshots for meaningful UI changes when the workflow supports them.

## 22. Definition of done

A feature is done only when:

- it satisfies the active milestone acceptance criteria;
- behavior is tested at the correct layer;
- errors and empty states are handled;
- units and scale are unambiguous;
- undo/redo behavior is defined for edits;
- imported/generated data is validated;
- documentation is current;
- the repository builds and verifies cleanly;
- no fake success path remains.

## 23. Agent reporting template

Use this at the end of a substantial task:

```text
Milestone:
Delivered:
Changed files:
Tests added/updated:
Commands run:
Results:
Assumptions:
Known limitations:
Next allowed work:
```

## 24. Final restraint

The fastest path is not the largest code dump. Build one complete, testable workflow at a time. Keep the geometry core trustworthy, the UI replaceable, and the exported physical dimensions correct.
