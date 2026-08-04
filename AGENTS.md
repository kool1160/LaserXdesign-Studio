# AGENTS.md — LaserX Design Studio

This is the primary operating contract for every coding, planning, review, and architecture agent working in LaserX. Read it before changing code, tests, configuration, architecture, milestone state, or durable project documentation.

## 1. Mission

LaserX Design Studio is an affordable, premium-feeling, Windows-first, machine-independent idea-to-manufacturable-product platform for flat-cut signs and layered products.

LaserX should take a user from:

> I want to make something, but I do not want to waste half the night preparing the design.

To:

> Here is the editable design, the physical layer stack, the manufacturing problems, the truthful 3D preview, and the correctly scaled file to open in the software that runs my machine.

LaserX creates the product. Downstream software cuts, engraves, marks, routes, or otherwise manufactures it.

LaserX is not plasma-control software, not a general CAD replacement, not a generic vector editor, and not an AI-dependent product. Plasma was the proving ground, not the ceiling.

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

First-session target:

> A first-time user can create or import a design, understand major manufacturing warnings, view it in 3D, and export a usable file within ten minutes.

The core sign-building experience must work without an API key, AI account, internet access, or provider credits. AI is a prominent optional creation path, never a dependency of the core product.

## 3. Mandatory product direction

Before planning or implementing post-M13 work, read:

1. GitHub Issue #44 — product reset and interpretation;
2. GitHub Issue #37 — post-milestone direction;
3. `docs/status/CURRENT.md`;
4. the active milestone specification and issue.

Locked product interpretation:

- first-time usability is central, not late polish;
- normal sign creation works without AI;
- AI is optional and user-supplied;
- physical 3D is a major feature but remains derived and non-mutating;
- Inkscape and downstream machine software are companions;
- LaserX must feel premium while remaining generously priced;
- R&D reduces uncertainty but does not establish priority or authorize wholesale merges;
- licensing, trial, beta, and real-user usability are product work;
- one excellent workflow is preferred over ten partial CAD features.

Do not reinterpret LaserX as plasma-only, AI-dependent, a machine controller, a collection of experiments, a low-end utility, or a conventional subscription product.

## 4. Authority and source-of-truth order

When instructions conflict, use this order:

1. Explicit owner instruction for the current task.
2. This `AGENTS.md`.
3. `docs/status/CURRENT.md` for the active milestone, current gate, and assigned agents.
4. The active milestone document.
5. The active GitHub issue.
6. Issues #44 and #37.
7. `docs/PRODUCT_REQUIREMENTS.md`.
8. Accepted ADRs and `docs/ARCHITECTURE.md`.
9. Existing tests and established code conventions.

`docs/OPERATOR_PROTOCOL.md` defines how work moves. `docs/WORKSTREAM_OWNERSHIP.md` defines the durable role model. `docs/CLAUDE_EXECUTION_PLAN.md` remains the current M14 implementation-agent queue for compatibility; it does not make any model the permanent engineering authority.

GitHub is project truth. A chat handoff, PDF, stale README, old branch, experiment branch, temporary worktree, or local completion report is not authoritative over live GitHub state.

Do not silently resolve a genuine product or architecture conflict. Record it in `docs/status/DECISIONS_NEEDED.md` and choose the smallest reversible path until the owner decides.

## 5. Senior-led delivery model

The owner directive dated 2026-08-04 establishes a senior-led engineering model.

### 5.1 Owner

The owner decides product direction, milestone order, pricing philosophy, trial policy, major scope changes, and milestone advancement.

### 5.2 Senior engineering lead and orchestrator

ChatGPT is the senior engineering lead and project orchestrator unless the owner explicitly changes that assignment.

The senior lead owns:

- translating owner intent into durable requirements and architecture;
- inspecting the repository before setting direction;
- choosing the next technically correct work, not merely the next unchecked box;
- writing bounded execution briefs with scope, acceptance criteria, non-goals, and verification;
- assigning implementation to Claude, Codex, or another approved implementation agent;
- integrating work across packages, branches, issues, and milestones;
- deciding whether a change needs routine review, senior checkpoint review, or independent verification;
- reviewing exact heads at important risk-bearing turning points;
- returning `READY`, `REPAIR`, or `BLOCKED` when a checkpoint audit is required;
- merging routine work inside an already approved active gate after exact-head verification;
- merging checkpoint work and advancing milestones only under the owner-authorized rules in the operator protocol;
- preventing scope creep, architecture drift, fake-success states, and governance overhead from becoming a second product.

The senior lead must verify claims against the code and GitHub evidence. Agent summaries are leads, not proof.

### 5.3 Implementation agent

`docs/status/CURRENT.md` maps the current implementation assignment to Claude, Codex, or another approved agent. Agent brand is temporary; the role is durable.

An implementation agent must:

- work only inside the approved active gate and brief;
- inspect before editing;
- start fresh work from current `main` unless repairing an existing PR;
- keep changes focused and reviewable;
- implement the smallest complete vertical result;
- add regression coverage with the implementation;
- run required local verification;
- push exact-head evidence;
- report blockers honestly;
- never invent the roadmap, merge without authorization, activate a later milestone, or approve its own high-risk work.

### 5.4 Independent verifier

A separate verifier is required when:

- the senior lead directly authored load-bearing implementation and would otherwise review its own work;
- the change crosses a critical trust or manufacturing boundary;
- evidence is contested or two agents materially disagree;
- the owner requests an independent audit;
- the senior lead classifies the change as requiring separation of duties.

The verifier may be Claude, Codex, another capable model, a human reviewer, or a combination. Independence means the verifier did not author the load-bearing implementation being approved.

### 5.5 GitHub

GitHub stores the durable plan, code, evidence, review findings, CI state, and milestone status. Chat is coordination, not project truth.

## 6. Review and audit cadence

LaserX does not require a heavyweight senior audit after every small commit. Review depth must match risk.

### 6.1 Routine integration review

Routine review is normally sufficient for:

- narrow documentation updates;
- test-only improvements that do not redefine product behavior;
- localized refactors with unchanged contracts;
- straightforward UI polish inside an already approved architecture;
- low-risk dependency maintenance with no runtime or licensing boundary change;
- small repairs with a clear regression test and green required CI.

Routine work still requires focused diff inspection, tests, exact-head CI where applicable, scope control, and clean Git state. The senior lead may merge it inside the active approved gate without forcing the owner through a separate audit command.

### 6.2 Senior checkpoint review

A senior exact-head review is required when work changes or proves:

- package or system architecture;
- a public contract used by multiple packages;
- a measured performance bottleneck or worker/caching strategy;
- a new major runtime dependency;
- a user-visible workflow that determines milestone success;
- a major integration slice;
- milestone midpoint evidence that materially changes the remaining plan;
- a repaired defect that previously produced false success, data loss, resource leakage, or silent incorrect output.

### 6.3 Critical independent checkpoint

Independent verification is required for:

- project schema or migration changes;
- canonical units, geometry, cutability, physical-layer truth, or manufacturing export changes;
- filesystem, IPC, credential, signing, update, installer, or other privileged boundaries;
- AI credential or provider-security boundaries;
- capture evidence claimed as proof;
- release candidates and milestone exit;
- public distribution, licensing enforcement, or payment activation;
- machine-control, hardware, safety, simulator, or operator-review gates;
- any change the owner or senior lead marks critical.

### 6.4 Mandatory milestone turning points

At minimum, the senior lead performs a full project-direction and exact-head audit at:

1. architecture lock or ADR acceptance;
2. completion of each risk-bearing integration gate;
3. milestone exit before advancement;
4. private/public release candidate approval;
5. any point where evidence suggests the roadmap or architecture is wrong.

Green CI is necessary evidence, not automatic approval.

## 7. Operating commands

### `Plan LaserX: <idea>`

Discuss product behavior, architecture, scope, priority, business model, manufacturing rules, or sequencing. The senior lead inspects relevant project truth before recommending direction.

### `Lock that into LaserX`

Write an accepted decision to the smallest authoritative GitHub location.

### `Continue LaserX`

Use with the senior engineering lead. The senior lead:

1. inspects current GitHub state and any active local/worktree evidence available;
2. determines the next correct implementation or repair;
3. writes or updates the execution brief;
4. assigns and orchestrates the implementation agent;
5. reviews the resulting work at the risk level required by Section 6;
6. keeps routine work moving without using the owner as a courier;
7. stops for the owner only at a decision, critical checkpoint, milestone advancement, or genuine blocker.

When used directly in an implementation-agent environment, `Continue LaserX` means execute only the current approved brief and stop with an exact-head handoff.

### `Check LaserX`

Force a senior audit of the live project, active worktree/branch evidence available, active PR, exact head, tests, CI, architecture, scope, and product direction. The result is `READY`, `REPAIR`, or `BLOCKED` when approval is being judged.

### `Advance LaserX`

Authorize a checkpoint merge, gate transition, milestone transition, or other state change that the operator protocol reserves for owner approval.

### `Status LaserX`

Return live read-only status: active milestone, gate, implementation assignment, branch/PR/head, CI, blockers, next engineering action, and next owner decision if one exists.

### `Hold LaserX`

Pause new implementation and merging until explicitly resumed.

## 8. Locked product principles

### 8.1 Open it and know what to do

The application must not assume CAD knowledge. Guided workflows, normal shop language, clear next actions, and recoverable navigation are core product requirements.

### 8.2 Editable first

Generated, traced, imported, or typed content must become editable objects or paths. Flattened previews are temporary only.

### 8.3 Exact dimensions

A design shown as 24 inches wide must export as 24 inches wide within documented tolerance. Screen pixels are never authoritative manufacturing units.

### 8.4 Manufacturing-aware, not CAM

LaserX may analyze manufacturability and prepare files. Version 1 does not own machine motion, lead-ins, pierce timing, speed, power, amperage, focus, gas, toolpaths, THC, firmware, or G-code.

Post-Version-1 machine work is allowed only through explicitly activated M24 and M25 safety gates.

### 8.5 AI is optional

Normal sign tools remain useful offline and without provider access. AI output becomes editable geometry and passes the same validation as manual or imported work.

### 8.6 Truthful physical preview

The 3D preview is derived from authoritative 2D manufacturing geometry, explicit physical layers, material identity, and exact canonical thickness. It is read-only and non-mutating.

It must never silently close, repair, scale, union, discard, reinterpret, or invent physical geometry. Rendering failure must not block editing, saving, or manufacturing export.

### 8.7 Safe defaults and visible warnings

Never silently delete or alter user geometry during import, simplification, bridging, registration, alignment, preview, or export. Proposed changes are visible, explicit, and undoable.

### 8.8 Local-first projects

Editing, project storage, deterministic sign tools, import, validation, save, and export work without internet access.

### 8.9 Premium product, generous price

The product should feel restrained, obvious, and polished without becoming an extractive subscription maze.

### 8.10 Narrow before broad

Prefer one excellent sign workflow over broad partial CAD. Do not recreate a general-purpose CAD or machine-control system without a later owner-approved milestone.

## 9. Approved technology and repository boundaries

Approved stack:

- Electron;
- React and TypeScript;
- Vite;
- pnpm workspaces;
- Vitest;
- Playwright;
- pure TypeScript domain packages where practical;
- Web Workers for measured expensive work;
- native/WASM acceleration only after profiling proves need.

Core boundaries:

- React components do not contain authoritative geometry algorithms.
- Electron main/preload code does not contain document-model behavior.
- Domain and geometry packages remain UI-independent and deterministic.
- Importers return normalized domain objects plus warnings and do not mutate an open document directly.
- Exporters consume normalized snapshots and explicit settings.
- AI cannot write project files or bypass validation.
- Production export does not perform filesystem writes.
- Physical-preview packages consume authoritative snapshots and never mutate them.
- Material definitions remain renderer-independent.
- Privileged filesystem, capture, credentials, signing, and future device access stay behind typed Electron boundaries.
- Do not add a second UI framework, state library, geometry engine, desktop runtime, or CAD kernel without an ADR and owner approval.

M14 additionally requires Three.js plus React Three Fiber, a pure scene package, a Three adapter package, lazy loading, typed capture IPC, no CAD kernel, no wholesale experiment merge, and no research shell/fixtures/debug hooks in production.

## 10. Canonical data and geometry rules

- canonical stored length: millimeters;
- display length: millimeters or inches;
- user-facing angles: degrees;
- internal mathematical angles: radians where required;
- domain coordinates: Cartesian, positive X right, positive Y up;
- renderer conversion occurs only at tested boundaries;
- no external geometry API accepts ambiguous unitless values.

All geometry work is deterministic for identical inputs and settings. Tolerances are centralized. Every path declares open or closed state.

Topology-changing operations return resulting geometry, warnings, replaced/discarded IDs, a UI summary, and enough information for undo or reversal.

Never treat visual overlap as geometric union. Never treat rendered values as manufacturing evidence.

## 11. Document, preview, cutability, and export rules

The editor uses a serializable document model and command-based mutations with stable IDs, deterministic serialization, migration, dirty-state tracking, and undo/redo. A React state snapshot is not a project file.

Derived preview state—including camera, exploded spacing, layer visibility, and capture state—is not authoritative project state unless a later migration explicitly says otherwise.

Warnings include severity, source references, measured value, configured limit, and plain-language repair guidance. Automatic repair is proposed, previewable, explicit, and undoable. Passing checks does not certify physical safety.

Native projects are versioned, deterministic, migratable, editable, and independent of future machine hardware. SVG is preferred editable interchange. DXF is primary manufacturing interchange. Native DWG editing is out of scope.

Production packages are deterministic derived artifacts. Export only explicit physical layers, preserve shared millimeter origin and scale, exclude non-cut preview data, and make partial failure visible.

## 12. Fonts, intellectual property, and AI

- Bundle only fonts with documented redistribution rights.
- Do not commit commercial font binaries, trademark-logo bundles, or copied branded templates.
- Preserve editable text when possible and outline it for portable export when required.
- Keep credentials out of source control and renderer code.
- Route secret-bearing requests through a secure main-process boundary.
- Never send unrelated local project contents.
- Persist only accepted ordinary geometry and schema-defined project data.
- Keep AI provenance transient unless an owner-approved migration changes that policy.
- Validate generated geometry like imported geometry.
- AI never issues machine motion or safety-control commands.

## 13. Security rules

- The Electron renderer has no unrestricted Node access.
- Use context isolation and narrow typed preload APIs.
- Validate IPC, paths, imported files, projects, and production folders.
- Do not execute embedded scripts.
- Do not load remote content into privileged renderer contexts.
- Never log credentials, full private prompts, or unnecessary user content.
- Future machine access stays in a privileged host, never the renderer.

## 14. Testing and evidence

Use unit tests for domain rules, geometry, scene conversion, parsing, and policy; property tests for invariants; golden fixtures for interchange and production output; integration tests for commands and migrations; packaged desktop E2E for critical workflows; browser/GPU evidence where required; and manual real-job validation when the milestone demands it.

Every bug fix gets a regression test when feasible. Never update a golden merely to make a failure disappear.

Expected root verification includes:

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

Use all active-milestone commands and exact-head CI. Local tests alone do not prove completion when GitHub or packaged evidence is required.

## 15. Git and change discipline

- Keep commits and PRs focused and reviewable.
- Use conventional commit prefixes where practical.
- Do not commit installers, local settings, credentials, unlicensed fonts, proprietary artwork, or research payloads into production bundles.
- Do not rewrite public history without owner instruction.
- Do not mix architecture migrations with unrelated styling.
- Include screenshots for meaningful UI changes.
- Never reuse an old milestone worktree for a new gate.
- Every handoff reports branch, full head SHA, `git status --porcelain`, CI state, work completed, and blockers.
- PR bodies describe stable scope; exact-head evidence belongs in generated or updated PR comments so it cannot silently become stale.

## 16. Milestone gates and definition of done

The active milestone is named in `docs/status/CURRENT.md`.

No milestone advances until required acceptance tests pass, critical defects are resolved, limitations are documented, required checkpoint review is complete, exact-head workflows are green, merge evidence is recorded, and the owner authorizes advancement.

A feature is done only when it satisfies active acceptance criteria, handles error and empty states, preserves exact units, defines undo/redo where applicable, validates imported/generated data, keeps documentation current, verifies cleanly, and contains no fake-success path.

A milestone is not advanced merely because code exists.

## 17. Final restraint

The fastest path is not the largest code dump or the largest review bureaucracy. Build one complete, testable workflow at a time. Keep manufacturing geometry authoritative, physical preview derived, AI optional, materials truthful, downstream exports exact, machine control safety-isolated, and the owner out of the courier role.