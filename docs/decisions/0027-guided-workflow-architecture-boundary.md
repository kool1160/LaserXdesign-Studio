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
first-run state: the active goal and step definition, the current step, the
completed and skipped step ids, and status
(`idle | active | completed | dismissed | failed`). It is a pure TypeScript
module — no React, no DOM, no Electron, no Node import, and no browser global.
Both halves of that claim are mechanically enforced, by two different
mechanisms with different reach (§7): an ES-only typecheck for DOM and browser
globals, and a text audit for imports the typecheck cannot see. This is the
same reasoning that keeps `packages/physical-preview-3d` free of a renderer
dependency.

There is deliberately **no `canceled` status**: `cancel` restores the
pre-guided state, which is exactly `idle`. A status the reducer can never
produce would be a state every consumer must handle and none can observe.
Every status in the union is reachable, and the tests prove reachability by
walking the graph from the initial state rather than by constructing states
by hand.

Progress is tracked by **stable step id, never by array index**. An index is
only meaningful against one exact step set; an id survives a definition
gaining or reordering steps, and makes a stale persisted snapshot detectable
instead of silently pointing at a different step.

Because step lookup resolves an id to its *first* occurrence, a definition is
only usable if its ids are unique and non-blank, its step list is non-empty,
and its version is a positive integer. `isValidWorkflowDefinition` enforces
this before `start`, `resume`, and `replay`, and an invalid definition
**fails closed** rather than entering an active workflow. This is not
defensive tidiness: duplicate ids such as `["a", "a", "b"]` would advance
from the first `a` to the second, resolve back to the first, and never reach
`b` or complete -- a permanently non-progressing "active" state, which is
exactly the trapped state this contract promises cannot exist.

State **owns** its definition and progress lists: they are copied and frozen at
every boundary rather than aliased to caller values. TypeScript's `readonly`
is erased at runtime, so storing a supplied array by reference would leave
validated state mutable by whoever supplied it -- a caller could pass a valid
`["A", "B"]`, have it accepted, then write `stepIds[1] = "A"` and recreate the
non-progressing workflow the validator exists to prevent, *after* validation
passed. Snapshots returned for persistence are likewise detached.

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

### 4. Skipping a step is not leaving the workflow

These are two different user intentions and are two different actions:

- **`skip-step`** advances past the current step (recording it as skipped, not
  completed) and keeps the workflow `active`; on the final step it completes
  the workflow. Skipping one explanation must never end the journey.
- **`dismiss`** leaves the workflow deliberately and is terminal.

A step is recorded as completed or skipped but never both, so the summary the
user is shown afterwards is truthful even if they went back and redid a step
they had skipped.

**Going back reopens the destination step and discards completion/skip records
from that step forward.** Keeping them would let an interrupted journey resume
while claiming the step currently being redone -- and every step after it --
is already finished. If the user returns to change an earlier decision such as
material or text, any later "completion" is simply false.

### 5. Every action declares its allowed source states

`ALLOWED_SOURCE_STATUSES` is part of the contract, not an implementation
detail. An action arriving from a status it does not list is a **no-op that
returns the same state reference**. This is what makes a stale or
out-of-sequence UI event safe: a late `start` cannot reset a journey in
progress, and a late `resume` cannot overwrite a terminal record. Restarting
or leaving a journey must be an explicit `replay`, `dismiss`, or `cancel`
decision.

`cancel` is the one action allowed from every status, and always returns
exactly the pre-guided state. Two separate properties are proven in tests
over the **reachable** state graph: every reachable non-terminal state can
move forward on its own, and every reachable state can reach `idle` via
`cancel`. Unreachable states are never synthesized to pad the matrix.

**A source status is necessary but not sufficient.** Status alone cannot tell
a fresh event from a duplicated or delayed one, because both arrive while the
workflow is merely `active`. Every step-scoped action — `advance`, `back`,
`skip-step`, `fail` — therefore also carries the step it was produced for and
the run it belonged to, and is a same-reference no-op unless both match live
state:

- **`expectedStepId`** stops a duplicated Next from confirming the *following*
  step, and a delayed Skip from skipping a step the user never saw. Issue #45
  requires each guided step to be explicitly confirmed; without this, a
  repeated event confirms steps on the user's behalf.
- **`runToken`** is opaque, supplied by the caller, and replaced on every
  `start`, `resume`, and `replay`. A step id alone is not enough: cancelling
  and restarting, or replaying, puts a new run on the same step id, so an
  event still in flight from the abandoned run would still match.

`dismiss` and `replay` are run-scoped but not step-scoped — leaving or
restarting a journey is a decision about the journey, not about one step.
`cancel` is deliberately unconditional: it is the guaranteed exit from every
state and always restores the same pre-guided state, so binding it to identity
could only ever make an escape hatch fail to work.

Generating tokens belongs to the caller, which keeps the reducer pure and
deterministic; a token minted inside the reducer would make the same inputs
produce different outputs.

### 6. Resumable persistence

`resume` is keyed off a persisted snapshot that can truthfully reconstruct an
interrupted workflow. G0 locks the **shape** only:

```ts
interface OnboardingWorkflowSnapshot {
  goal: GuidedGoal;
  definitionVersion: number;
  currentStepId: string;
  completedStepIds: string[];
  skippedStepIds: string[];
}

interface OnboardingPreferences {
  schemaVersion: 1;
  completedGoals: GuidedGoal[];
  dismissed: boolean;
  activeWorkflow: OnboardingWorkflowSnapshot | null;
}
```

`definitionVersion` is what makes a stale snapshot detectable: step ids are
stable, but their meaning and ordering belong to one specific step set.

Resume is **fail-closed**, and validates the full semantic invariant rather
than only checking that ids are recognizable. Recorded progress must be
**exactly the prefix of steps before the open step, each accounted for exactly
once** across completed and skipped.

Requiring only that progress lies *behind* the current step is not enough: it
would accept `{current: C, completed: [A]}` for steps A/B/C, claiming the user
reached C without ever processing B -- a state the reducer cannot produce, and
resuming it would silently bypass a required step. The exact-prefix comparison
also subsumes the narrower rules it replaces, since a duplicated id, a step in
both lists, an unknown id, and the current or a later step marked finished each
break either its length or its coverage test.

`canResumeSnapshot` exposes that decision so a caller can offer a clean restart
instead.

Persistence is versioned the same way `RecentProjectsStore`/`RecoveryStore`
are, written atomically, and stored alongside `recent-projects.json` in
`userData`. The store implementation, its IPC surface, and its wiring into
`DesktopController`/`DesktopState` are **G1 work**. G0 does not add a new IPC
channel or touch `apps/desktop/electron/persistence.ts`.

### 7. Mechanical enforcement

Enforcement is split between two mechanisms, each covering what the other
cannot. The claim recorded here is exactly what they enforce — no broader.

**The DOM and browser-global boundary is enforced by the type system.**
`apps/desktop/tsconfig.onboarding-pure.json` compiles this module alone
against `lib: ["ES2023"]` with `types: []`, run as
`pnpm audit:guided-workflow-types`. Any reference to a browser global or DOM
type — `window`, `document`, `self`, `location`, `history`, `indexedDB`,
`Worker`, `XMLHttpRequest`, `KeyboardEvent`, `Storage`,
`CSSStyleDeclaration`, and every other one — simply fails to resolve. A
pattern list was rejected for this job: it can only reject the globals someone
remembered, so it silently overclaims the moment a new one appears. The
desktop app's own `tsconfig.json` includes `DOM` and `DOM.Iterable`, so the
ordinary typecheck cannot close this gap and a dedicated configuration is
required.

**The import boundary is enforced by text scan.**
`scripts/guided-workflow-architecture-audit.mjs` rejects a `node:` import, a
Node built-in imported by bare specifier (`from "fs"`, `from "path"`,
`from "fs/promises"`, and the rest — these resolve regardless of `types: []`,
so the `node:` spelling alone would not be the whole boundary), a `require(`
call, an `electron` import, and a `from "react"` import. These are the rules a
typecheck cannot express, because those packages ship real type declarations
and would resolve happily.

The audit also rejects a triple-slash `/// <reference lib="..." />` or
`types="..."` directive, which would re-add ambient libraries from *inside*
the source while leaving the JSON configuration untouched, and verifies the
pure configuration still exists and has not been weakened — no DOM library, no
ambient types, covering exactly this module — so enforcement cannot be
disabled by editing a config instead of the code.

`scripts/test-guided-workflow-architecture-audit.mjs` proves every rule fires
on a real violation, that ordinary code is not falsely rejected, and that the
real module and real configuration both pass, matching
`scripts/test-renderer-source-boundary-audit.mjs`.

### 8. Owner-observed ten-minute fixture set

G0 defines, without producing, the fixture the owner-observed usability
session (G6) will use: a real multi-layer `.laserx` project capable of
exercising all three first-run goals within the session, following the same
provenance-recording convention the M14 G6 owner retest already established
(exact byte size and SHA-256 recorded alongside the fixture). Producing this
fixture is G1/G6 work.

### 9. Accessibility lock

Guided-workflow UI (once built) must, at minimum: remain fully keyboard
operable; move focus deliberately when a guided overlay opens or closes and
restore it on close; show a visible focus indicator against the dark canvas;
publish an `aria-live` region for step changes and for findings; respect the
OS reduced-motion preference; and never rely on color alone to distinguish
progress or severity. These close the specific gaps already flagged as open
during M14's physical-preview accessibility research rather than leaving them
unaddressed a second time.

### 10. Boundary and non-goals

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
