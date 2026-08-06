# AGENTS.md — LaserX Design Studio

This file is the primary operating contract for every coding, planning, review, and architecture agent working in this repository. Read it before changing code, tests, configuration, architecture, milestone state, or documentation.

## 1. Mission

LaserX Design Studio is an affordable, premium-feeling, Windows-first, machine-independent idea-to-manufacturable-product platform for flat-cut signs and layered products.

LaserX takes a user from:

> I want to make something, but I do not want to waste half the night preparing the design.

To:

> Here is the editable design, the physical layer stack, the manufacturing problems, the truthful 3D preview, and the correctly scaled file to open in the software that runs my machine.

LaserX is not plasma-control software, not a general CAD replacement, not a generic vector editor, and not an AI-dependent product. Plasma was the proving ground, not the ceiling.

Simple distinction:

> LaserX creates the product. Downstream software cuts, engraves, marks, routes, or otherwise manufactures it.

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

The core sign-building experience must work without an API key, AI account, internet access, or provider credits. AI is optional assistance, not the product itself.

## 3. Source-of-truth order

When instructions conflict, use this order:

1. Explicit owner instruction for the current task.
2. This `AGENTS.md` file.
3. `docs/status/CURRENT.md` for the active milestone, implementation assignment, PR, state, and allowed scope.
4. The active milestone document in `docs/milestones/`.
5. The active GitHub issue.
6. GitHub Issues #44 and #37 for product interpretation and post-milestone direction.
7. `docs/PRODUCT_REQUIREMENTS.md`.
8. `docs/ARCHITECTURE.md` and accepted ADRs in `docs/decisions/`.
9. Existing tests and established conventions.

`docs/OPERATOR_PROTOCOL.md` defines how the owner, planning/review chat, SOL High implementation thread, GitHub, pull requests, and CI move work through those sources. It does not override product requirements or milestone scope.

A PDF, chat handoff, old completion report, stale README, previous milestone branch, experiment branch, or temporary worktree is never authoritative over current GitHub state. The owner may use an older handoff to restore an operating method; once accepted, that decision must be recorded in current GitHub truth.

Do not silently resolve a genuine conflict. Record it in GitHub and stop or choose the smallest reversible path that preserves existing behavior.

## 4. Durable operating model

The owner restored the original command workflow on **2026-08-06**.

> Chat decides. GitHub remembers. SOL High executes. Pull requests hold the evidence. The owner receives the verdict and next command.

Hard operating rules:

- one repository;
- one active milestone gate;
- one active implementation target;
- one next valid command;
- only `Continue LaserX` goes to the implementation thread;
- planning, locking decisions, review, status, holds, and advancement stay in the planning/review chat;
- implementation stops after pushing exact-head evidence;
- no implementation agent merges, closes the active issue, activates the next gate, or approves its own work;
- no agent creates scheduled heartbeats, background polling, recurring CI checks, or self-waking sessions;
- no agent keeps working after `AWAITING_REVIEW` unless the owner issues the next command;
- detailed evidence belongs on GitHub, not in a giant duplicate chat report.

## 5. Roles and separation of duties

### 5.1 Owner

The owner controls product direction, milestone order, pricing philosophy, trial policy, model choice, and advancement.

### 5.2 Planning/review chat — orchestrator and acceptance authority

The planning/review chat:

- discusses product intent through `Plan LaserX: <idea>`;
- records accepted decisions through `Lock that into LaserX`;
- reads live GitHub state rather than relying on handoffs;
- performs exact-head review through `Check LaserX`;
- posts detailed findings to GitHub;
- returns `READY`, `REPAIR`, or `BLOCKED`;
- performs `Status LaserX` without changing anything;
- performs `Hold LaserX` when requested;
- merges, closes, records, and activates the next gate only through the owner's explicit `Advance LaserX` command;
- never accepts an implementation report as proof without checking the exact head, diff, tests, review state, and required CI.

There is no automatic routine merge. A `READY` verdict makes `Advance LaserX` valid; it does not replace the owner's advancement command.

### 5.3 SOL High — implementation agent

The implementation model is **SOL High**, meaning the owner-selected OpenAI coding model running at High reasoning in the Codex coding workspace. “Codex” is the execution surface; SOL High is the selected implementation model.

SOL High receives only `Continue LaserX` as the normal owner command.

SOL High must:

- read live repository truth before editing;
- work only on the one active milestone and bounded slice recorded in `CURRENT.md`;
- inspect the active PR, review findings, and CI first;
- repair blocking review findings before doing new work;
- repair required CI failures second;
- implement new work only when no active PR is awaiting review or repair;
- use focused branches and draft PRs;
- implement the smallest complete vertical result;
- add regression tests and behavior-linked documentation in the same change;
- run required verification and inspect exact-head CI;
- push exact-head evidence and stop at `AWAITING_REVIEW` or `BLOCKED`;
- never merge, close the active issue, activate the next gate, redesign unrelated architecture, create speculative infrastructure, or approve its own work.

Implementation responsibility does not authorize broad cleanup, parallel future milestones, duplicate research, wholesale experiment merges, or self-directed scope expansion.

### 5.4 Claude / Anthropic — held

Claude and other paid Anthropic models are **held**. Do not invoke them, spend Anthropic usage credits, assign background work to them, or treat them as the implementation lead unless the owner explicitly authorizes one named, bounded task in GitHub.

Earlier Claude-authored code and evidence remain valid historical repository content and must be reviewed on their merits. The hold changes future routing, not authorship history.

### 5.5 Independent verification

A verifier who did not author the load-bearing change may be assigned for critical geometry, manufacturing truth, schema/migration, filesystem, IPC, credential, signing, licensing, release, or machine-safety boundaries. The planning/review chat records the exact target and verifier in GitHub.

### 5.6 GitHub

GitHub stores the durable plan, code, evidence, review findings, CI state, and milestone status. Chat is coordination, not project truth.

## 6. Mandatory reading before implementation or repair

SOL High must read:

- this file;
- `docs/OPERATOR_PROTOCOL.md`;
- `docs/WORKSTREAM_OWNERSHIP.md`;
- `docs/status/CURRENT.md`;
- Issues #44 and #37;
- the active milestone document and active issue;
- the active PR, review findings, review threads, and exact-head CI;
- neighboring code, tests, and relevant ADRs.

Read enough repository history to understand the active contract, but do not repeatedly consume the entire project history when the exact current issue, PR, and findings already define the bounded task.

Do not start a later milestone because it appears convenient. Milestones are gates, not suggestions.

## 7. Command protocol

### `Plan LaserX: <idea>`

Use in the planning/review chat. Discuss product behavior, workflow, concern, priority, business model, manufacturing rule, architecture, or sequencing. No repository implementation begins.

### `Lock that into LaserX`

Use in the planning/review chat. Record the accepted decision in the smallest authoritative GitHub location: issue, milestone, requirements file, ADR, status file, ownership document, or PR finding.

### `Continue LaserX`

Use in the SOL High implementation thread.

SOL High must:

1. Read repository truth: `AGENTS.md`, `docs/OPERATOR_PROTOCOL.md`, `docs/status/CURRENT.md`, active milestone, active issue, active PR, review findings, and CI.
2. Fix blocking review findings first, with regression tests.
3. Repair required CI second, without expanding scope.
4. If the PR is green with no unresolved blocker, refresh exact-head evidence and stop at `AWAITING_REVIEW`.
5. Implement only when no active PR exists for the bounded gate; build the smallest complete vertical slice, test it, open a draft PR, and stop.
6. If repository truth conflicts or no active gate exists, record the blocker and stop instead of guessing.

`Continue LaserX` never means merge, close the issue, activate the next gate, redesign unrelated architecture, create speculative future infrastructure, or dump a giant duplicate project report into chat.

Compact completion response:

```text
LaserX M## — AWAITING_REVIEW | BLOCKED
PR: #__
Head: <full SHA>
CI: green | failing | running
Work: <one-sentence result>
Blocker: none | <one-sentence blocker>
Next command: Check LaserX | Continue LaserX | Plan LaserX: <decision>
```

### `Check LaserX`

Use in the planning/review chat. Review the exact current head, full relevant diff, milestone acceptance, tests, review threads, and required CI. Detailed findings go on GitHub.

Compact verdict:

```text
LaserX M## PR #__ — READY | REPAIR | BLOCKED
Head: <full SHA>
CI: green | failing | running
Finding: none | <one or two short blocking reasons>
Next command: Advance LaserX | Continue LaserX | Plan LaserX: <decision>
```

### `Advance LaserX`

Use only in the planning/review chat after `READY`. Before advancing, verify:

- the reviewed head has not changed;
- required GitHub workflows are green;
- no unresolved blocking review thread remains;
- milestone or gate acceptance and exit criteria are satisfied;
- the owner explicitly issued `Advance LaserX`.

Then merge using the established method, close the appropriate issue, update `CURRENT.md` with exact merge and verification evidence, activate only the next approved gate from latest `main`, and stop. Implementation of the new gate has not begun until the owner later sends `Continue LaserX` to SOL High.

### `Status LaserX`

Use in the planning/review chat. Read-only status: active milestone, issue, PR, head, CI, blocker, and next valid command. No review, implementation, merge, or status mutation.

### `Hold LaserX`

Use in either chat. Pause implementation, merging, and advancement while preserving the current branch and PR. Resume only through an explicit owner command.

## 8. Locked product principles

- **Open it and know what to do.** Guided workflows, normal shop language, clear next actions, and recoverable navigation are core product requirements.
- **Editable first.** Generated, traced, imported, or typed content becomes editable geometry. Flattened previews are temporary only.
- **Exact dimensions.** Canonical stored length is millimeters. Display may be millimeters or inches. One inch is exactly 25.4 mm.
- **Manufacturing-aware, not CAM.** Version 1 does not own machine motion, lead-ins, pierce timing, speed, power, amperage, focus, gas, toolpaths, THC, firmware, or G-code.
- **AI is optional.** Normal sign tools work offline and without provider access. AI output passes the same validation as manual or imported geometry.
- **Truthful physical preview.** Physical 3D is derived, read-only, non-mutating, and never silently repairs or invents geometry.
- **Safe defaults and visible warnings.** Proposed geometry changes are visible, previewable, explicit, and undoable.
- **Local-first projects.** Editing, project storage, deterministic tools, import, validation, save, and export work without internet access.
- **Premium product, generous price.** Avoid extractive subscription behavior and artificial feature crippling.
- **Narrow before broad.** Prefer one excellent sign workflow over ten partial CAD features.

## 9. Architecture and repository boundaries

Expected production ownership:

```text
apps/desktop/                    Electron + React desktop application
packages/application/            commands, use cases, orchestration
packages/domain/                 serializable document model and invariants
packages/geometry/               pure geometry operations and tolerances
packages/cutability/             manufacturing analysis and repair proposals
packages/fonts/                  font discovery, metadata, licensing, outlines
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
fixtures/                        reviewed fixtures
docs/                            requirements, architecture, milestones, ADRs
tools/                           developer inspection utilities
native/                          reserved for measured bottlenecks
```

Boundary rules:

- React components do not contain geometry algorithms.
- Electron main/preload code does not own document-model behavior.
- Domain and geometry packages remain deterministic and UI-independent.
- Importers return normalized candidates plus warnings; they do not mutate the open document directly.
- Exporters consume normalized snapshots and explicit settings.
- AI cannot write project files or bypass validation.
- Production-export code does not perform filesystem writes.
- Physical-preview packages consume authoritative snapshots and never mutate them.
- Privileged filesystem, capture, credential, signing, update, and future device access remain behind typed Electron main/preload boundaries.
- Do not add a second UI framework, geometry engine, desktop runtime, state library, or CAD kernel without an owner-approved ADR.

## 10. Units, files, security, and AI

- Canonical stored length: millimeters.
- Display: millimeters or inches.
- Domain coordinates: positive X right, positive Y up.
- External geometry APIs never accept ambiguous unitless lengths.
- Geometry operations are deterministic for identical inputs and settings.
- SVG and DXF are untrusted input; reject unsafe scripts and references.
- Native projects are versioned, deterministic, migratable, and editable.
- Raster images are references or tracing inputs, never manufacturing export geometry.
- Electron renderer has no unrestricted Node access.
- Use context isolation, sandboxing, narrow typed preload APIs, and strict boundary validation.
- Keep credentials out of source control and renderer code.
- Never send unrelated local project content to an AI provider.
- Projects remain openable when the provider is unavailable.

## 11. Testing and verification

Use unit tests for domain rules, units, geometry, parsers, policies, and transitions; property tests for invariants where valuable; golden fixtures for project/SVG/DXF/tracing/production output; integration tests for commands, history, migration, recovery, import/export; and packaged Electron/Playwright tests for complete Windows workflows.

Every defect repair requires a regression test when feasible. Never update a golden merely to hide a failure.

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

Use all active-milestone commands and required CI. Do not report success from local tests alone when GitHub evidence is required.

## 12. Change discipline

1. Restate the active milestone and exact deliverable.
2. Inspect before editing.
3. Implement the smallest complete vertical slice allowed.
4. Add or update tests in the same change.
5. Run required checks.
6. Update documentation when behavior, architecture, commands, schema, or status changes.
7. Report changed files, tests, assumptions, and remaining risks in GitHub.

Keep commits and PRs focused. Keep implementation and repair PRs draft until exact-head review. Do not leave fake placeholder success. Do not advance because code exists. Do not reuse an old milestone worktree for a new gate.

## 13. Active gate

`docs/status/CURRENT.md` names the one active milestone, issue, PR, exact state, implementation model, and next valid command. Read it fresh every time.

The fastest path is not the largest code dump. Build one complete, testable workflow at a time. Keep manufacturing geometry authoritative, physical preview derived, AI optional, materials truthful, downstream exports exact, and the owner out of the courier role.
