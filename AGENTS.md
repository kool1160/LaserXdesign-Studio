# AGENTS.md — LaserX Design Studio

This file is the primary operating contract for every coding, planning, review, and architecture agent working in this repository. Read it completely before changing code, tests, configuration, architecture, milestone state, or documentation.

## 1. Mission

LaserX Design Studio is an affordable, premium-feeling, Windows-first, machine-independent idea-to-manufacturable-product platform for flat-cut signs and layered products.

LaserX should take a user from:

> I want to make something, but I do not want to waste half the night preparing the design.

To:

> Here is the editable design, the physical layer stack, the manufacturing problems, the truthful 3D preview, and the correctly scaled file to open in the software that runs my machine.

LaserX is not plasma-control software, not a general CAD replacement, not a generic vector editor, and not an AI-dependent product. Plasma was the proving ground, not the ceiling.

The product complements tools such as Inkscape, LightBurn, plasma CAM/controller software, fiber-laser software, router CAM, and waterjet software.

Simple distinction:

> LaserX creates the product. The downstream software cuts, engraves, marks, routes, or otherwise manufactures it.

## 2. Product promise

A user must be able to:

1. Open LaserX and understand what to do next without prior instruction.
2. Create a sign with deterministic non-AI tools, import existing artwork, trace an image, or optionally request AI assistance.
3. Edit the result as real vector geometry.
4. Set exact dimensions in inches or millimeters.
5. Detect and repair manufacturing problems through visible, previewable, undoable operations.
6. Build physical layers with truthful material and exact thickness.
7. Inspect the finished product as an interactive, non-mutating physical 3D preview.
8. Export correctly scaled SVG, DXF, and approved production packages for downstream software.

The measurable first-session target is:

> A first-time user can create or import a design, understand major manufacturing warnings, view it in 3D, and export a usable file within ten minutes.

The core sign-building experience must work without an API key, AI account, internet access, or provider credits. AI is an optional assistant inside LaserX, not the product itself.

## 3. Mandatory product direction

Before evaluating, criticizing, planning, or implementing post-M13 work, every agent must read:

1. GitHub Issue #44 — planning-chat reset and product interpretation;
2. GitHub Issue #37 — canonical post-milestone product direction;
3. `docs/status/CURRENT.md`;
4. the active milestone specification and issue.

Issue #44 establishes the required product lens:

- first-time usability is central, not optional polish;
- normal sign creation works without AI;
- AI remains optional and user-supplied;
- interactive physical 3D is a major product feature;
- LaserX must feel premium while remaining generously priced;
- Inkscape and downstream machine software are companions;
- R&D reduces uncertainty but does not establish priority or authorize wholesale merges;
- licensing, trial, community beta, and real-user usability are product work, not afterthoughts.

Do not reinterpret LaserX as plasma-only, AI-dependent, a machine controller, a random collection of experiments, a low-end utility, or a conventional subscription product.

## 4. Source-of-truth order

When instructions conflict, use this order:

1. Explicit owner instruction for the current task.
2. This `AGENTS.md` file.
3. `docs/status/CURRENT.md` for the active milestone, implementation owner, and allowed scope.
4. The active milestone document in `docs/milestones/`.
5. The active GitHub issue.
6. GitHub Issues #44 and #37 for product interpretation and post-milestone direction.
7. `docs/PRODUCT_REQUIREMENTS.md`.
8. `docs/ARCHITECTURE.md` and accepted ADRs in `docs/decisions/`.
9. Existing tests and established code conventions.

`docs/OPERATOR_PROTOCOL.md` defines how the owner, ChatGPT, Claude, Codex, GitHub, pull requests, and CI move work through those sources. It does not override product requirements or milestone scope.

Do not silently resolve a genuine conflict. Record it in `docs/status/DECISIONS_NEEDED.md` and stop or choose the smallest reversible path that preserves existing behavior.

A PDF, chat handoff, old completion report, stale README, previous milestone branch, experiment branch, or temporary worktree is never authoritative over current GitHub state.

## 5. Mandatory reading before work

Before implementing or repairing any feature:

- read this file;
- read Issues #44 and #37;
- read `docs/OPERATOR_PROTOCOL.md`;
- read `docs/WORKSTREAM_OWNERSHIP.md`;
- read `docs/status/CURRENT.md`;
- read the active milestone specification and active GitHub issue;
- inspect any open PR, review threads, and exact-head workflow state;
- inspect neighboring packages and tests;
- read relevant ADRs;
- run the current verification commands when implementation exists.

Do not start a later milestone because it appears convenient. Milestones are gates, not suggestions.

## 6. Agent roles and separation of duties

### 6.1 Owner

The owner decides product direction, milestone order, pricing philosophy, trial policy, and milestone advancement.

### 6.2 ChatGPT — implementation and orchestration lead

ChatGPT is the active senior software engineer, implementation lead, and project orchestrator while `docs/status/CURRENT.md` records that assignment under ADR 0025.

ChatGPT must:

- work only on the one active milestone and one approved bounded slice;
- start fresh implementation slices from current `main` unless a reviewed repair continues an existing PR;
- use focused branches and reviewable PRs;
- inspect live GitHub state before editing;
- implement the smallest complete vertical result;
- add regression coverage and behavior-linked documentation in the same change;
- run required verification and inspect exact-head CI;
- keep PR evidence, issues, status, and code synchronized;
- distinguish implementation evidence from acceptance review;
- perform a fresh exact-head review before merge;
- merge and advance only after unchanged-head verification and explicit owner command;
- never treat an earlier summary or another agent's handoff as proof.

Implementation ownership does not authorize speculative rewrites, duplicate research, broad cleanup, parallel future milestones, or self-directed milestone advancement.

### 6.3 Claude — held unless explicitly assigned

Claude is not the default implementation agent while `CURRENT.md` assigns implementation to ChatGPT.

Claude remains available for an explicitly assigned independent review, repair, comparison, or specialist implementation task. The assignment must be recorded in `CURRENT.md`, the active issue, or the active PR.

An old `Continue LaserX` instruction, stale execution plan, or local worktree does not authorize Claude to begin product work.

### 6.4 Codex — held unless explicitly assigned

Codex is held under the same boundary. It remains available for an explicit independent review, repair, comparison, specialist task, or later machine-platform assignment.

### 6.5 GitHub

GitHub stores the durable plan, code, evidence, review findings, CI state, and milestone status. Chat is coordination, not project truth.

## 7. Locked product principles

### 7.1 Open it and know what to do

The application must not assume CAD knowledge. Guided workflows, normal shop language, clear next actions, and recoverable navigation are core product requirements.

### 7.2 Editable first

Generated, traced, imported, or typed content must become editable objects or paths. Flattened previews are temporary only.

### 7.3 Exact dimensions

A design shown as 24 inches wide must export as 24 inches wide within documented tolerance. Screen pixels are never authoritative manufacturing units.

### 7.4 Manufacturing-aware, not CAM

LaserX may analyze manufacturability and prepare files. Version 1 does not own machine motion, lead-ins, pierce timing, speed, power, amperage, focus, gas, toolpaths, THC, firmware, or G-code.

Post-Version-1 machine-platform work is allowed only through explicitly activated M24 and M25 gates. Those gates preserve the privileged-host, simulator, operator-review, and safety boundaries defined by ADR 0018.

### 7.5 AI is optional

Normal sign tools must remain useful offline and without provider access. AI output must become editable geometry and pass the same normalization and manufacturing validation as manual or imported work.

At launch, supported AI access is user-supplied, user-billed, and securely stored. LaserX does not embed a shared provider key or resell AI credits unless a later owner-approved business and security design changes that boundary.

### 7.6 Truthful physical preview

The 3D preview is derived from authoritative 2D manufacturing geometry, explicit physical layers, material identity, and exact canonical thickness. It is read-only and non-mutating.

It must never silently close, repair, scale, union, discard, reinterpret, or invent physical geometry. Rendering failure must not block normal editing, saving, or manufacturing export.

### 7.7 Safe defaults and visible warnings

Never silently delete or alter user geometry during import, simplification, bridging, registration, alignment, preview, or export. Show proposed changes and preserve undoability.

### 7.8 Local-first projects

Editing, project storage, deterministic sign tools, import, validation, save, and export must work without an internet connection.

### 7.9 Premium product, generous price

Product decisions must support a restrained, obvious, polished experience without turning LaserX into an extractive subscription maze. Pricing and trial mechanics are controlled by M20 and explicit owner decisions.

### 7.10 Narrow before broad

Prefer one excellent sign workflow over ten partial CAD features. Reject scope that recreates a general-purpose CAD or machine-control system unless a future milestone explicitly authorizes it.

## 8. Technology direction

The approved stack is:

- Electron desktop shell;
- React and TypeScript renderer UI;
- Vite;
- pnpm workspaces;
- Vitest;
- Playwright;
- pure TypeScript domain packages where practical;
- Web Workers for measured expensive work;
- optional native/WASM acceleration only after profiling proves need.

For M14 physical preview:

- use Three.js and React Three Fiber;
- promote the accepted pure scene contract into `packages/physical-preview-3d/`;
- place renderer conversion in `packages/physical-preview-three/`;
- lazy-load the entire production preview;
- use typed Electron preload/main IPC for PNG capture;
- do not add a CAD kernel;
- do not merge the experiment branch wholesale;
- do not ship the lab shell, benchmark hooks, fixture registry, or bundled research fixture payloads.

Do not add a second UI framework, state library, geometry engine, desktop runtime, or CAD kernel without an ADR and owner approval.

## 9. Repository boundaries

Expected production layout includes:

```text
apps/desktop/                    Electron + React desktop application
packages/application/            commands, use cases, orchestration
packages/domain/                 document model and invariants
packages/geometry/               pure geometry operations and tolerances
packages/cutability/             manufacturing analysis and repair proposals
packages/fonts/                  font discovery, metadata, licensing, text outlines
packages/import-raster/          raster preprocessing and tracing adapters
packages/io-svg/                 SVG import/export
packages/io-dxf/                 DXF import/export
packages/project-format/         native serialization and migrations
packages/ai/                     optional provider boundary
packages/production-export/      deterministic production packages
packages/physical-preview-3d/    renderer-independent physical scene contract
packages/physical-preview-three/ Three.js conversion and renderer helpers
packages/material-catalog/       immutable approved material definitions
packages/ui/                     reusable presentation components
packages/test-fixtures/          fixture builders and golden helpers
apps/desktop/tests/              desktop integration and E2E
fixtures/                        reviewed external test fixtures
docs/                            requirements, architecture, milestones, ADRs
tools/                           developer-only inspection utilities
native/                          reserved for measured bottlenecks
```

Boundary rules:

- React components must not contain geometry algorithms.
- Electron main/preload code must not contain document-model behavior.
- Domain and geometry packages must remain UI-independent and deterministic.
- `packages/cutability` may depend on domain and geometry, never React or Electron.
- Importers return normalized domain objects plus warnings; they do not mutate an open document directly.
- Exporters consume normalized snapshots and explicit settings.
- `packages/ai` cannot write project files or bypass validation.
- `packages/production-export` must not perform filesystem writes.
- physical-preview packages consume authoritative snapshots and never mutate them.
- renderer-bound production source must not rely on Node-only globals or unrestricted Node APIs.
- material catalog definitions must remain renderer-independent.
- privileged filesystem, capture, credentials, and future device access belong behind typed Electron main/preload boundaries.

## 10. Canonical units and geometry rules

- canonical stored length unit: millimeters;
- display units: millimeters or inches;
- user-facing angles: degrees;
- internal mathematical angles: radians where required;
- domain coordinates: Cartesian, positive X right, positive Y up;
- renderer coordinate conversion happens only at tested boundaries;
- no external geometry API accepts ambiguous unitless values.

All geometry work must be deterministic for identical inputs and settings. Centralize tolerances. Every path declares open or closed state.

Topology-changing operations must return resulting geometry, warnings, replaced/discarded IDs, a UI summary, and enough information for undo or reversal.

Never treat visual overlap as geometric union.

## 11. Document, command, and preview model

The editor uses a serializable document model and command-based mutations with stable IDs, layers, deterministic serialization, migration, dirty-state tracking, and undo/redo.

A React state snapshot is not a project file.

Derived preview state—including 3D camera, exploded spacing, visible-layer toggles, and capture state—is not authoritative project state unless a later schema migration explicitly says otherwise.

## 12. Cutability and process-awareness rules

Warnings must include severity, object/segment references, measured value, configured limit, and plain-language repair guidance.

Automatic repair is proposed, previewable, explicit, and undoable. Passing checks does not certify physical safety.

M17 may add process-aware guidance for plasma, CO2 laser, diode laser, fiber laser, router, waterjet, and other reviewed flat-cut workflows. These are bounded guidance profiles, not universal machine settings and not machine control.

## 13. Fonts and intellectual property

- Bundle only fonts with documented redistribution rights.
- Store license and provenance for bundled fonts.
- Do not commit commercial font binaries.
- Preserve editable text when possible and outline it for portable manufacturing export when required.
- Do not bundle trademark logos or copied branded templates.
- Prompt examples may describe general style but must not request exact protected-logo reproduction.

## 14. AI pipeline rules

AI features are provider-isolated and optional.

- Keep credentials out of source control and renderer code.
- Route secret-bearing requests through a secure main-process boundary.
- Never send unrelated local project contents.
- Persist only accepted ordinary geometry and schema-defined project data.
- Keep prompt text, references, alternatives, provider metadata, usage, and provenance transient unless an owner-approved opt-in migration changes that policy.
- Validate generated geometry like imported geometry.
- A project remains openable when the provider is unavailable.
- AI may never issue machine motion or safety-control commands.

## 15. File-format and export rules

Native projects are versioned, deterministic, migratable, editable, and independent of future machine hardware.

SVG is the preferred editable interchange format. DXF is a primary manufacturing interchange format. Native DWG editing is explicitly out of scope.

Raster images are references or tracing inputs, never manufacturing export geometry.

Production packages are deterministic derived artifacts. Export only explicit physical layers, preserve shared millimeter origin and scale, exclude non-cut preview data, and make partial failure visible.

M18 may add target-software export profiles for LightBurn, plasma CAM, router CAM, waterjet, fiber workflows, and generic flat-cut consumers. Profiles may control interchange details but must never mutate source geometry, fake proprietary formats, or silently discard unsupported information.

## 16. Security rules

- Electron renderer has no unrestricted Node access.
- Use context isolation and narrow typed preload APIs.
- Validate IPC, paths, imported files, project files, and production folders.
- Do not execute embedded scripts.
- Do not load remote content into privileged renderer contexts.
- Never log credentials, full private prompts, or unnecessary user content.
- Future machine access remains in a privileged host, never the renderer.

## 17. ChatGPT implementation protocol

When the owner tells ChatGPT `Continue LaserX` or `Repair LaserX`, ChatGPT must:

1. read the mandatory sources and live GitHub state;
2. identify the one active milestone, issue, bounded sub-slice, and any open PR;
3. address unresolved blocking findings first;
4. otherwise repair required CI failures;
5. otherwise implement only the next smallest complete slice authorized by the active milestone and current issue;
6. add tests, behavior-linked documentation, and exact evidence;
7. push or update a draft PR;
8. stop in `AWAITING_REVIEW`, `REPAIRING`, or `BLOCKED` unless the owner also issued a valid advancement command.

`Continue LaserX` never authorizes ChatGPT to close the milestone issue, activate a later milestone, expand scope, or merge an experiment branch wholesale.

Detailed evidence belongs in GitHub. The owner-facing handoff stays compact:

```text
LaserX M## — AWAITING_REVIEW | REPAIRING | BLOCKED
PR: #__
Head: <full SHA>
CI: green | failing | running
Work: <one-sentence result>
Blocker: none | <one-sentence blocker>
Next command: Check LaserX | Continue LaserX | Plan LaserX: <decision>
```

## 18. Exact-head review and advancement protocol

`Check LaserX` requires a fresh review of:

- current milestone and issue acceptance criteria;
- exact PR head and full diff;
- existing findings and whether repairs genuinely close them;
- relevant source, tests, fixtures, migrations, ADRs, and documentation;
- required workflow results on the final pushed head or reviewed merge ref;
- scope control and later-gate restraint;
- whether PR claims match live code and CI.

The review must not rely on the implementation handoff or an earlier summary. A second-model review may be assigned to Claude or Codex when risk, uncertainty, or owner direction warrants it.

Detailed findings go on GitHub. The chat verdict is:

```text
LaserX M## PR #__ — READY | REPAIR | BLOCKED
Head: <full SHA>
CI: green | failing | running
Finding: none | <brief blocker>
Next command: Advance LaserX | Continue LaserX | Plan LaserX: <decision>
```

`Advance LaserX` is valid only after the reviewed head is unchanged, required checks are green, blocking findings are resolved, acceptance criteria are satisfied, and the owner explicitly authorizes advancement. Then ChatGPT may merge with an expected-head guard, close the issue when appropriate, record the exact merge, and activate only the next owner-approved gate.

## 19. Milestone gate policy

The active milestone is named in `docs/status/CURRENT.md`.

No agent may begin the next milestone until:

- required acceptance tests and automated coverage pass;
- no severity-1 defect remains;
- limitations are documented;
- the exact final head is freshly reviewed;
- required workflows are green;
- the PR is merged using the established method;
- the active issue is closed;
- current status records the verified merge;
- the owner authorizes advancement.

Work from a later milestone is allowed only when narrowly required to complete the active vertical result.

M24 and M25 additionally require the hardware and safety prerequisites stated in their milestone contracts. Their roadmap presence does not authorize early machine work.

## 20. Large milestone sequence

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
- M09 — Deterministic sign-building tools and templates.
- M10 — Optional prompt/image-to-sign AI pipeline.
- M11 — UI, branding, accessibility, and product polish.
- M12 — Layered-sign workflow and production export packages.
- M13 — Windows installer, packaging, and private beta hardening.
- M14 — Production physical 3D preview integration.
- M15 — Guided onboarding and Learn Mode.
- M16 — Truthful material catalog and wood/acrylic expansion.
- M17 — Process-aware manufacturability profiles.
- M18 — Downstream software export profiles.
- M19 — Optional AI idea-to-cuttable-design onboarding.
- M20 — Licensing, trial, and purchase experience.
- M21 — Community beta distribution readiness.
- M22 — Real-user usability validation.
- M23 — Version 1.0 release and broader-market launch.
- M24 — Simulator-first machine platform foundation.
- M25 — First explicitly approved LaserX controller vertical slice.

Nesting, quoting, cloud collaboration, mobile editing, native DWG, general 3D CAD, additional controllers, and a marketplace remain deferred unless promoted through a new owner-approved milestone and ADR.

## 21. Testing expectations

Use unit tests for domain rules, geometry, scene conversion, file parsing, and policy; property tests for invariants; golden fixtures for SVG/DXF/tracing/production output; integration tests for command history and migrations; packaged desktop E2E for critical workflows; browser/GPU evidence where required; and manual real-job validation where the milestone demands it.

Every bug fix requires a regression test when feasible. Never update a golden merely to make a failure disappear.

M14 requires exact-thickness, hole/cutout, deterministic, non-mutation, lazy-loading, GPU-fallback, accessibility, capture, and Windows evidence.

M15 and M22 require measurable first-user workflow evidence.

M24 uses simulator and fault-injection tests. M25 requires hardware-in-the-loop evidence before process-enabled testing.

## 22. Verification commands

Expected root commands include:

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

Use all active-milestone commands and required CI. Do not report completion from local tests alone when GitHub evidence is required.

## 23. Git and change discipline

- Keep commits and PRs focused and reviewable.
- Use conventional commit prefixes where practical.
- Do not commit installers, local settings, credentials, unlicensed fonts, proprietary artwork, or research fixture payloads into production bundles.
- Do not rewrite public history without owner instruction.
- Do not mix architecture migrations with unrelated styling.
- Include screenshots for meaningful UI changes.
- Keep implementation and repair PRs draft until a fresh exact-head review.
- Never reuse an old milestone worktree for a new gate.

## 24. Definition of done

A feature is done only when it satisfies active acceptance criteria, is tested at the correct layer, handles error and empty states, preserves exact units, defines undo/redo where applicable, validates imported/generated data, keeps documentation current, verifies cleanly, passes exact-head GitHub workflows, and contains no fake-success path.

A milestone is not advanced merely because code exists.

## 25. Final restraint

The fastest path is not the largest code dump. Build one complete, testable workflow at a time. Keep manufacturing geometry authoritative, physical preview derived, AI optional, materials truthful, downstream exports exact, machine control safety-isolated, and the owner out of the courier role.
