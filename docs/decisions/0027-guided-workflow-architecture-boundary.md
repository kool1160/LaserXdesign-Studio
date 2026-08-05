# ADR 0027: Guided-Workflow Architecture Boundary

## Status

Accepted for M15 G0.

This ADR locks the architecture before any guided-workflow UI, tutorial
content, or grouped-repair engine is built. It records decisions only; it adds
no visible onboarding surface, no new IPC channel, and no project-schema
change.

## Context

M14 shipped a real, deep feature set — vector import, raster tracing,
cutability analysis, sign generation, AI-assisted concepts, physical 3D
preview, and production export — behind a single always-mounted interface.
Issue #45 and `docs/milestones/M15-guided-onboarding-learn-mode.md` require
that a first-time user reach a finished, exported sign without outside
instruction, through one of three explicit goals, seeing only the controls
relevant to the current step.

A direct inspection of the shipped desktop app (`apps/desktop/src/app/App.tsx`,
current `main`) establishes the starting point precisely:

- The left **Workflow tools** sidebar (`aside.sidebar`) always mounts Project,
  Import (`#workflow-import`), Trace (`#workflow-trace`), Analyze
  (`#workflow-analyze`), Create, Text, Sign, and AI simultaneously. Raster-trace
  controls are a permanent sibling of SVG/DXF import, both visible regardless of
  which one the user is using — the exact anti-pattern Issue #45 names.
- The right **Editing tools** sidebar always mounts Selection, Geometry,
  Transform, and Layers (which contains production-package export).
- `workspaceIsEmpty` (a derived boolean gating the `workspace-welcome` overlay)
  is the *only* existing conditional top-level UI gate in the app today.
- Physical 3D preview — real, merged, working production code from M14 — is the
  closest thing to a focused view: it replaces `<main>` with an error-boundary-
  wrapped, lazily-loaded overlay. Even it does not hide the two always-mounted
  sidebars, which sit outside `<main>` as siblings. **No existing view in the
  app suppresses surrounding chrome.** A true focused/guided screen has no
  precedent to extend; it must be designed new.
- Import findings (`import-findings`) and cutability issues (`cutability-issues`)
  are two independently shaped, ungrouped flat lists. `CutabilityIssue.severity`
  (`packages/cutability/src/analysis.ts`) is confirmed two-tier only
  (`"warning" | "error"`). The milestone's required **Safe to fix / Suggested
  fix / Needs your decision** three-tier grouping is a new classification, not
  a relabeling of `severity`.
- No onboarding/first-run persistence exists anywhere in `apps/desktop`. The
  closest precedent is `RecentProjectsStore`/`RecoveryStore`
  (`apps/desktop/electron/persistence.ts`): a zod schema carrying an explicit
  `schemaVersion`, written atomically (temp file + rename) into `userData`,
  loaded once at controller startup, exposed through the single `DesktopState`
  object already threaded through the whole app.
- The AI-optional mechanism already exists and is directly reusable:
  `AiGenerationPanel` renders unconditionally; its Generate action is `disabled`
  while `state.ai.connection.status !== "connected"`, and manual editing stays
  fully available while disconnected. "Describe What I Want With AI — Optional"
  reuses this exact check rather than inventing a new one.
- Two state-shape primitives are already proven in production and are the raw
  material this ADR builds on, not something it reinvents:
  1. **Nullable single preview slot + fingerprint staleness guard** —
     `ProjectSession`'s `previewX`/`cancelX`/`commitX` methods for import,
     raster-trace, sign-tools, and AI-concept previews each capture a
     `documentFingerprint`/`projectFingerprint` at preview time and refuse to
     commit if the document changed underneath it. M14 G5/G6 re-implemented and
     hardened this exact idiom for physical-preview capture-status staleness
     (`#physicalPreviewCapture.assemblyFingerprint`, re-checked against
     `fingerprintPhysicalPreviewInput` on every state read).
  2. **Job/progress/cancel** — `{operationId, percent, stage} | null` paired with
     an `AbortController` map keyed by `operationId` and emit-on-change,
     identical across raster trace, cutability analysis, and AI generation jobs
     in `apps/desktop/electron/desktop-controller.ts`.
- Accessibility conventions already established: a skip link with explicit
  focus assertions, an `aria-live="polite"` busy-status region, matched
  `aria-keyshortcuts`/`title` pairs on shortcut-bound controls, and
  `data-testid` as the dominant end-to-end selector. Explicitly open gaps
  (recorded in the M14 physical-preview integration research and still true):
  reduced-motion preference, focus management on overlay open/close, visible
  focus indicators against the dark canvas, and an `aria-live` region for
  findings.

## Decision

### 1. The guided-workflow state machine is a new, pure module

`apps/desktop/src/features/onboarding/guidedWorkflowState.ts` owns guided
first-run state: the active goal, the current step, visited/completed steps,
and status (`active | skipped | completed | canceled | failed`). It is a pure
TypeScript module — no React, no DOM, no Electron, no `node:` import — proven
by mechanical audit (§5), the same way `packages/physical-preview-3d` is proven
free of a renderer dependency.

The module reads relevant signals from existing state (e.g.
`workspaceIsEmpty`, `ai.connection.status`) but **never mutates** authoritative
project state, dirty state, undo/redo history, selection, analysis results,
save behavior, or export output — restating for guidance state exactly the
non-mutation guarantee ADR 0024 already locked for physical preview.

G0 defines and tests this module in isolation. Wiring it into a visible shell,
`App.tsx`, or any IPC boundary is explicitly **G1 work**, not G0.

### 2. Three locked first-run goals

- `create-first-sign`
- `import-own-design`
- `describe-with-ai` — optional, gated on `ai.connection.status === "connected"`
  using the existing status check; never presented as broken or required when
  no provider is connected.

No fourth goal, and no goal-specific product behavior beyond routing/highlight,
belongs to G0.

### 3. Contextual-control matrix (documented, not yet implemented)

For each always-mounted panel identified above (Import, Trace, Analyze,
Create, Text, Sign, AI, Editing tools), the guided-workflow contract locks
which of three states it takes under an active guided goal: **primary**
(highlighted, the step's one clear action), **available** (visible but
visually subordinate), or **hidden**. This locks, in particular:

- SVG/DXF import never presents raster-trace controls;
- raster import presents trace controls only once a raster source is chosen;
- the repair, 3D, and export surfaces each default to only their own relevant
  controls when reached through a guided goal.

Implementing this hiding/highlighting in `App.tsx` is G1+; G0 locks the matrix
so later slices implement one already-agreed contract instead of inventing
per-panel rules ad hoc.

### 4. Skip, back, resume, replay, cancel, failure, and recovery

Every state the guided-workflow reducer can reach has at least one action that
leads to a non-trapped exit — proven by exhaustively walking the reachable
state graph in tests, not asserted by convention. `cancel` is available from
every non-terminal state and always returns to the pre-guided state
unmodified. `skip` always advances or completes rather than erroring.

`resume` is keyed off a persisted preference. G0 locks its **shape** only:

```ts
interface OnboardingPreferences {
  schemaVersion: 1;
  lastGoal: GuidedGoal | null;
  completedGoals: GuidedGoal[];
  dismissed: boolean;
}
```

versioned the same way `RecentProjectsStore`/`RecoveryStore` are, written
atomically, and stored alongside `recent-projects.json` in `userData`. The
store implementation, its IPC surface, and its wiring into
`DesktopController`/`DesktopState` are **G1 work**. G0 does not add a new IPC
channel or touch `apps/desktop/electron/persistence.ts`.

### 5. Mechanical enforcement

`scripts/guided-workflow-architecture-audit.mjs` reads
`guidedWorkflowState.ts` as text and rejects a `node:` import, a `require(`
call, an `electron` import, or a `from "react"` import — the same
`requireText`/`rejectText` shape as `scripts/renderer-source-boundary-audit.mjs`.
This keeps the module renderer-framework-agnostic and privilege-free by
construction, so a later gate cannot accidentally couple guided-workflow state
to Electron privilege or to React internals. A companion
`scripts/test-guided-workflow-architecture-audit.mjs` proves the audit fires on
a real violation and does not false-positive on the clean module, matching
`scripts/test-renderer-source-boundary-audit.mjs`.

### 6. Owner-observed ten-minute fixture set

G0 defines, without producing, the fixture the owner-observed usability
session (G6) will use: a real multi-layer `.laserx` project capable of
exercising all three first-run goals within the session, following the same
provenance-recording convention the M14 G6 owner retest already established
(exact byte size and SHA-256 recorded alongside the fixture). Producing this
fixture is G1/G6 work.

### 7. Accessibility lock

Guided-workflow UI (once built) must, at minimum: remain fully keyboard
operable; move focus deliberately when a guided overlay opens or closes and
restore it on close; show a visible focus indicator against the dark canvas;
publish an `aria-live` region for step changes and for findings; respect the
OS reduced-motion preference; and never rely on color alone to distinguish
progress or severity. These close the specific gaps already flagged as open
during M14's physical-preview accessibility research rather than leaving them
unaddressed a second time.

### 8. Boundary and non-goals

Guided-workflow state never touches `packages/domain`, `packages/geometry`,
`packages/cutability`, `packages/project-format`, `packages/production-export`,
`packages/io-svg`/`packages/io-dxf`, the security/IPC-sender boundary
established for physical-preview capture, or the physical-preview system
itself. G0 does not implement the visible first-run shell, tutorial content,
the grouped-repair engine, material expansion, process profiles, export
profiles, new AI capability, licensing, or public beta.

## Rationale

The inventory above shows the app has no existing contextual UI to extend and
no existing tutorial/state-machine primitive at the "multi-step guided journey
with resume" level — only single-step preview/accept/reject slots and
job/progress trackers. Locking the state-machine shape, the three goals, the
contextual matrix, and the non-trapping contract now means G1 implements one
agreed design instead of five separately-negotiated ad hoc mechanisms across
five different panels.

Keeping the module pure and mechanically audited follows the same reasoning as
ADR 0024's package boundary: anything Node-testable belongs in an isolated,
audited module rather than inside the app, where its correctness would depend
on a full Electron/React harness to verify.

## Alternatives

- **Extending one of the existing preview-slot patterns directly** (e.g.
  generalizing `ProjectSession`'s import-preview shape) was rejected: those
  model a single propose/accept/reject step, not a multi-step journey with
  skip/back/resume/replay across steps that span multiple existing panels.
- **Building the visible shell first and inferring the architecture from it**
  was rejected: it is exactly how the current app arrived at "everything always
  mounted" — five previously-independent features grew their own ad hoc UI with
  no shared contract.
- **Reusing `CutabilityIssue.severity` as the three-tier repair grouping** was
  rejected: it is a two-tier field or a different concern (structural
  correctness), not a repair-confidence classification; conflating them would
  either weaken cutability's existing meaning or produce an inaccurate grouping.
- **Wiring persistence into Electron now** was rejected as premature for a
  contract-lock slice; only the schema shape is needed to unblock G1, and
  building the real store before the consuming UI exists risks guessing at
  fields G1 discovers it doesn't need.

## Consequences

M15 proceeds as bounded reviewed slices G0-G6, each stopping for independent
exact-head audit, mirroring M14's own gate discipline. G0 adds documentation,
a pure state-machine module with tests, and one narrow mechanical audit; it
adds no visible onboarding surface, no new IPC channel, and no project-schema
change.

G1 is authorized to wire `guidedWorkflowState.ts` into a real shell and to
implement `OnboardingPreferences` persistence against the shape locked here.
Reopening the three locked goals, the contextual-control matrix, or the
non-trapping contract requires a new or amended ADR.
