# AGENTS.md - LaserX Design Studio

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
5. The active GitHub issue.
6. `docs/PRODUCT_REQUIREMENTS.md`.
7. `docs/ARCHITECTURE.md` and accepted ADRs in `docs/decisions/`.
8. Existing tests and established code conventions.

`docs/OPERATOR_PROTOCOL.md` defines how the owner, planning/review assistant, Codex, GitHub issues, pull requests, and CI move work through those sources. It does not override product requirements or milestone scope.

Do not silently resolve a genuine conflict. Record it in `docs/status/DECISIONS_NEEDED.md` and choose the smallest reversible implementation that preserves existing behavior.

A PDF, chat handoff, old Codex completion report, stale README status, previous milestone branch, or temporary working directory is never authoritative over current GitHub state.

## 4. Mandatory reading before work

Before implementing or repairing any feature:

- read this file;
- read `docs/OPERATOR_PROTOCOL.md`;
- read `docs/status/CURRENT.md`;
- read the active milestone specification;
- read the active GitHub issue;
- inspect any open PR, review threads, and final-head workflow state for that issue;
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

Post-Version-1 machine-platform work is allowed only through explicitly activated M15 and M16 gates. Those milestones must preserve the privileged-host, simulator, operator-review, and safety boundaries defined by ADR 0018 and their milestone contracts.

### 5.4 Safe defaults, visible warnings

Never silently delete or alter user geometry during import, simplification, bridging, registration coordination, alignment, or export. Show proposed changes and preserve undoability.

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

Version selection must use compatible, actively maintained releases. Keep the lockfile committed and deterministic.

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
packages/production-export/ deterministic in-memory layered production packages
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
- `packages/production-export` consumes normalized project snapshots and explicit manufacturing-layer metadata, builds deterministic in-memory artifacts and manifests, and must not perform filesystem writes or treat ordinary layers as physical pieces.
- Filesystem staging, overwrite policy, rollback, and privileged production-package writes belong in the Electron main boundary behind a typed service.

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

Operations that can change topology - union, subtraction, intersection, offset, simplification, bridging, tracing, and contour repair - must return:

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

Whole-design analysis and explicitly scoped manufacturing-layer analysis are distinct. Ordinary editing layers must not silently become independent manufacturing scopes.

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
- Persist only the accepted ordinary geometry and schema-defined project data. Prompt text, reference media, concept alternatives, provider/model/request identifiers, token usage, and AI provenance remain transient under the accepted M10 privacy policy unless a future opt-in persistence design is separately approved through an ADR and project-format migration.
- Generated images must pass through preprocessing, tracing, normalization, and cutability analysis before export.
- Never send unrelated local project contents to an AI provider.
- A project must remain openable when the provider is unavailable.
- AI may never issue machine motion, process-enable, interlock, emergency-stop, or other safety-control commands.

## 14. File format rules

### Native project

Use a versioned, documented native format. It must preserve editable text, layers, object IDs, transforms, machine presets, explicitly defined manufacturing-layer metadata, and migration history. It must preserve only fields accepted by the current schema; transient AI prompts, references, alternatives, provider metadata, usage, and provenance are not implied project fields.

Native projects must remain independent from future controller boards, firmware, transports, machine-host availability, and execution state.

### SVG

SVG is the preferred editable interchange format. Preserve dimensions, viewBox, transforms, path closure, and units. Test import-export round trips.

### DXF

DXF is the primary manufacturing interchange format for version 1. Export documented 2D entities, preserve physical scale, and avoid unsupported styling masquerading as geometry. Native DWG editing is explicitly out of scope.

### Raster

Raster images are references or tracing inputs, never manufacturing export geometry.

### Production packages

Production packages are deterministic derived artifacts, not project files. Export only explicitly declared physical manufacturing layers, preserve a shared millimeter origin and scale, exclude non-cut preview layers, and ensure the manifest matches the actual files, bounds, units, hashes, material notes, registration evidence, and warnings. Partial failure must be explicit and may not claim full success.

## 15. Security rules

- Electron renderer must not have unrestricted Node access.
- Use context isolation and a narrow, typed preload API.
- Validate file paths and IPC payloads.
- Treat imported SVG, DXF, raster, project files, production folders, controller messages, and future machine profiles as untrusted.
- Do not execute scripts embedded in imported content.
- Do not load remote content into privileged renderer contexts.
- Never log API keys, tokens, full private prompts, user file contents, or unnecessary machine-job geometry in production telemetry.
- Future machine and controller access must remain in a privileged host or service, never the renderer.

## 16. Work protocol for Codex

For every task:

1. Restate the active milestone and exact deliverable in the work log or PR description.
2. Inspect before editing.
3. Implement the smallest complete vertical slice allowed by the milestone.
4. Add or update tests in the same change.
5. Run the required checks.
6. Update documentation when behavior, architecture, commands, schema, or status changes.
7. Put detailed changed-file, test, assumption, risk, and limitation evidence in the PR.
8. Return a compact owner-facing handoff with state and next command.

Do not leave placeholder implementations that falsely report success. A visible `Not implemented` state is better than fake geometry or fake export.

### 16.1 Operator command behavior

The complete role and state protocol lives in `docs/OPERATOR_PROTOCOL.md`.

When the owner tells Codex `Continue LaserX`, Codex must:

1. read the mandatory sources;
2. identify the one active milestone, issue, and any open PR;
3. address unresolved blocking review findings first;
4. otherwise repair required CI failures;
5. otherwise, if a green implementation PR exists with no unresolved blockers, refresh PR evidence and stop in `AWAITING_REVIEW`;
6. otherwise implement the smallest complete active-gate vertical slice, test it, open or update a draft PR, and stop;
7. stop as `BLOCKED` rather than inventing work when repository truth conflicts or no gate is active.

`Continue LaserX` does not authorize merging, closing the active issue, updating the active gate, beginning the next milestone, or performing unrelated cleanup.

Commands intended for the planning/review assistant are:

- `Plan LaserX: <idea>`;
- `Lock that into LaserX`;
- `Check LaserX`;
- `Advance LaserX`;
- `Status LaserX`;
- `Hold LaserX`.

A coding agent must not impersonate the owner-level review or advancement role merely because those command names appear in repository documentation.

## 17. Milestone gate policy

The active milestone is named in `docs/status/CURRENT.md`.

An agent may not begin the next milestone until all of the following are true:

- every required acceptance test passes;
- required automated tests exist;
- no severity-1 defects remain;
- known limitations are documented;
- the current PR has been reviewed on the exact final head;
- required GitHub workflows are green;
- the PR is merged using the established method;
- the active issue is closed;
- current status is updated with the verified merge record;
- the milestone exit checklist is explicitly marked complete.

Work from a later milestone may be considered only when it is required to complete the active vertical slice. Keep such work behind a narrow interface and do not expand it.

M15 and M16 additionally require the owner authorization and hardware/safety prerequisites stated in their milestone contracts. Their presence in the roadmap does not authorize live machine work early.

## 18. Large milestone sequence

Detailed specifications live in `docs/milestones/`.

- M00 - Repository foundation and contracts.
- M01 - Desktop shell and project lifecycle.
- M02 - Canonical document model and viewport.
- M03 - Selection, transforms, layers, and undo/redo.
- M04 - Text, fonts, and outline conversion.
- M05 - Node editing and boolean geometry operations.
- M06 - Dimensionally correct SVG and DXF interoperability.
- M07 - PNG/JPEG preprocessing and vector tracing.
- M08 - Cutability analysis, bridges, and manufacturing preview.
- M09 - Sign-building tools, borders, holes, templates, and backing plates.
- M10 - Prompt/image-to-sign AI pipeline.
- M11 - UI, branding, and product polish.
- M12 - Layered-sign workflow and production export packages.
- M13 - Windows installer, packaging, and beta hardening.
- M14 - Beta validation and Version 1.0 release.
- M15 - Simulator-first machine platform foundation.
- M16 - First explicitly approved LaserX controller vertical slice.

Other future ideas such as nesting, quoting, cloud collaboration, mobile editing, broad 3D visualization, native DWG, additional controllers, and a marketplace remain deferred unless promoted through a new milestone and ADR.

## 19. Testing expectations

Use the testing pyramid appropriate to geometry software:

- unit tests for domain rules, conversions, geometry, and file parsing;
- property-based tests where invariants matter;
- golden fixtures for SVG/DXF/tracing and production-package results;
- integration tests for command history and import/export;
- end-to-end tests for critical desktop workflows;
- manual cut-file review fixtures for representative sign designs;
- simulator and fault-injection tests for M15;
- hardware-in-the-loop tests before any process-enabled M16 test.

Every bug fix requires a regression test when technically feasible.

Never update a golden file only to make a failing test green. Explain and review the geometric change.

## 20. Verification commands

The expected root commands are:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm verify
pnpm audit --prod
py -3 scripts/repository_guard.py
git diff --check
git status --short
```

Use the commands required by the active milestone and CI. Do not report completion from local tests alone when GitHub workflow evidence is required.

## 21. Git and change discipline

- Keep commits focused and reviewable.
- Use conventional commit prefixes where practical: `feat`, `fix`, `test`, `docs`, `refactor`, `chore`, `build`, `ci`.
- Do not commit generated installers, local settings, credentials, font binaries without licenses, or proprietary sample artwork.
- Do not rewrite public history without explicit instruction.
- Do not mix architecture migrations with unrelated UI styling.
- Include before/after screenshots for meaningful UI changes when the workflow supports them.
- Keep implementation and review-repair PRs draft until the active gate is ready for owner review.
- Never reuse an old milestone working directory to begin the next gate.

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
- required GitHub workflows pass on the final pushed head or reviewed merge ref;
- no fake success path remains.

A milestone is not advanced merely because implementation code exists.

## 23. Agent reporting

Detailed implementation evidence belongs in the pull request, not in a repeated chat handoff.

Use this compact owner-facing response after a substantial Codex task:

```text
LaserX M## - IMPLEMENTING | REPAIRING | AWAITING_REVIEW | BLOCKED
PR: #__
Head: <short SHA>
CI: green | failing | running
Work: <one-sentence result>
Blocker: none | <one-sentence blocker>
Next command: Check LaserX | Continue LaserX | Plan LaserX: <decision needed>
```

The PR description must still include delivered behavior, changed areas, tests, commands, exact results, assumptions, known limitations, and next allowed work.

## 24. Review and handoff discipline

- Detailed review findings belong on GitHub.
- The owner should not need to paste a Codex completion report into another chat.
- The owner should not need a fresh milestone markdown handoff when repository truth is current.
- Do not repeat a giant product or milestone recap after every review.
- A reviewer returns `READY`, `REPAIR`, or `BLOCKED` plus the next exact command.
- `Advance LaserX` is valid only after the reviewed head is unchanged, required CI is green, no blocking thread remains, and exit criteria are satisfied.

## 25. Final restraint

The fastest path is not the largest code dump. Build one complete, testable workflow at a time. Keep the geometry core trustworthy, the UI replaceable, the exported physical dimensions correct, future machine control safety-isolated, and the owner out of the courier role.
