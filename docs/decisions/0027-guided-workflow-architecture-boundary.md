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

The machine is deliberately **linear**: one immutable `stepIds` list per run,
moving forward and back by one step. Conditional experience — the
vector/raster presentation split, the sometimes-invisible post-analysis
checkpoint — is expressed as contextual variants and auto-completing
checkpoints over that stable list (§3), never as a branch graph, a mid-run
definition swap, or a skip. A definition also declares which steps are
skippable (`skippableStepIds`, §4) and which depend on transient in-memory
state (`transientStepIds`, §6); both sets are validated as known,
duplicate-free subsets of `stepIds` and fail closed with the rest of the
definition.

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

### 3. Contextual-control matrix

Every surface takes one of three states under an active guided stage:

- **primary** — the stage's one clear action, highlighted;
- **available** — reachable but visually subordinate;
- **hidden** — not presented at this stage.

The surfaces are the ones the app mounts unconditionally today: **Import**
(SVG/DXF), **Trace** (raster), **Analyze** (cutability), **Create** (shapes),
**Text**, **Sign** (sign tools), **AI**, **Editing** (selection/geometry/
transform/layers), **3D** (physical preview), **Save**, and **Export**
(SVG/DXF and production package).

Two rules hold in every row, and are the reason the matrix exists:

- an **Exit guidance** action is always reachable from every stage — a single,
  global affordance to leave guided mode and return to ordinary editing, kept
  separate from any individual surface's visibility. This is what "a guided
  stage narrows what is prominent, never what is reachable" actually means: a
  focused stage (3D, most notably) can legitimately hide every other mounted
  surface and still satisfy it, because leaving guidance is still one click
  away. It is not a promise that every panel stays visible;
- **Save** is always *available* from any stage that has a document.

#### One stable step list per goal — variants and checkpoints, never branches

The reducer is deliberately **linear**: one immutable ordered `stepIds` list
per run, forward and back by one step, no route action, no successor graph,
no way to add or remove a step mid-run. Everything conditional in the three
goals is therefore expressed inside that constraint, by exactly two devices —
never by mutating or swapping a definition during an active run, never by
cancel-and-restart with a different step list, and never by misusing
`skip-step`:

- a **contextual variant**: one stable step whose *presentation* differs
  according to live feature state the caller reads (a classified file type, a
  connection status). The step id, position, completion signal, and recovery
  route are identical across variants; which surface is shown is a rendering
  decision over transient state, not workflow identity. The vector/raster
  split in Import My Own Design is the canonical case (below).
- an **auto-completing checkpoint**: a stable step that is *always present*
  in `stepIds` and completes through an ordinary step-scoped `advance` —
  immediately and without presenting a stage when there is nothing for it to
  do, or after real work when there is. The post-analysis resolution
  checkpoint is the canonical case (below).

This is what makes ADR-described conditionality representable by the locked
state machine as it exists: every path through a goal traverses the same step
ids in the same order, so Back, persistence, resume, run identity, and the
reachability proofs all keep working unchanged. Promoting the reducer to a
validated branch graph was considered and rejected as strictly more machine
than the three locked goals need; reopening that choice requires amending
this ADR, not a G1 improvisation.

#### The post-analysis resolution checkpoint (Create, Import, and AI)

Every goal's `stepIds` contains one **resolution checkpoint** immediately
after cutability analysis. It is never absent, never in `skippableStepIds`,
and its behavior is fixed by three pure functions exported from
`guidedWorkflowState.ts`, so all three goals share one deterministic rule
instead of each UI inventing its own:

- **`resolutionPrimaryAction(counts)`** decides the one primary action by
  strict first-match precedence over the milestone's locked grouping —
  `safeFixableCount` (Safe to fix), `needsDecisionCount` (Suggested fix or
  Needs your decision), `blockingCount`:
  1. eligible safe fixes exist → **Fix safe problems**;
  2. otherwise anything still needs attention (a decision or a blocking
     finding) → **Review decisions**;
  3. otherwise → **Continue**.
  Exactly one rule ever applies, so two compliant implementations cannot
  choose different behavior — the overlap the earlier four-route wording left
  open (safe fixes coexisting with blocking findings, decisions that are also
  blocking) resolves to one answer by construction.
- **`canCompleteResolution(counts)`** is the *user permission* rule: a
  user-chosen Continue is allowed exactly when **no blocking findings
  remain**. Non-blocking suggestions never trap the user — Review decisions
  stays primary while they exist, but the visible Continue action remains
  available under this rule. An explicitly-approved truthful acknowledgment
  path (G4 work, not invented here) may later widen this rule; nothing here
  does. Malformed counts fail closed: a human reviews, and the checkpoint
  never unlocks on a broken count.
- **`shouldAutoCompleteResolution(counts)`** is the *unseen auto-advance*
  rule, and the only trigger for completing the checkpoint without
  presenting a stage: true exactly when **nothing is actionable at all** —
  no safe fixes, no decisions, no blocking findings — which is also exactly
  when `resolutionPrimaryAction` returns Continue, an equivalence the tests
  pin so the rules cannot drift apart. The two decisions are deliberately
  separate: permission to continue is broader than "nothing to show", and
  auto-advancing on `canCompleteResolution` would silently bypass Fix safe
  problems and Review decisions — the milestone's flagship repair workflow —
  whenever the remaining work happened to be non-blocking. Malformed counts
  fail closed here too: the stage is presented, never silently bypassed.

**Only a checkpoint with nothing actionable auto-completes.** If
`shouldAutoCompleteResolution` already holds at the moment the checkpoint
opens (or re-opens via Back), the caller dispatches an ordinary step-scoped
`advance` immediately: no stage is presented, the checkpoint is recorded
completed — truthfully, since passing with nothing to fix is what happened —
and nothing is recorded skipped. When safe fixes or decisions exist, even
non-blocking ones, the stage **is** presented with its precedence-decided
primary action; leaving it then is a visible, user-chosen Continue permitted
by `canCompleteResolution`. Producing the counts (grouping findings into the
three tiers) is the grouped-repair engine's job and remains G4 work; this
contract fixes only what the checkpoint does with them.

**Enforcement is split the same way as run tokens (§5).** The reducer cannot
see findings, so the checkpoint's guarantees come from two places: the
definition keeps its step id out of `skippableStepIds`, making `skip-step` a
same-reference no-op on it by construction (`isStepSkippable`), and the
caller's dispatch of `advance` on it is bound to **both** rules — dispatched
unseen only when `shouldAutoCompleteResolution` returns true, and otherwise
only for a user-chosen Continue while `canCompleteResolution` returns true —
an explicit two-part G1 caller obligation, tested at the layer that owns it,
exactly like minting fresh run tokens. 3D therefore unlocks only through the
checkpoint's completion.

This applies identically to Create My First Sign, Import My Own Design, and
Describe What I Want With AI — the milestone's grouping is a classification
of *findings*, not of how the document arrived, and a Create or AI document
can contain the same unsafe geometry as an imported one.

The **Large-finding broken DXF** fixture (§8) exercises the no-safe-fixes
case: hundreds of findings, none safely auto-fixable, so
`resolutionPrimaryAction` returns **Review decisions** and **Fix safe
problems** is correctly never presented, since nothing qualifies for it. Its
forward path is resolving or truthfully acknowledging findings until
`canCompleteResolution` holds, then 3D. Its exit path is the same global
**Exit guidance** action every other stage has — a large finding count must
never become a trap with no way out short of finishing repairs.

#### Create My First Sign

| Stage | Primary action | Completion signal | primary | available | hidden |
|---|---|---|---|---|---|
| Choose size and material | Set stock size and material | Physical layer has material and thickness | Editing (layers) | Create, Text, Save | Import, Trace, AI, Analyze, 3D, Export |
| Add the sign content | Add text or a shape | Document has at least one object on a physical layer | Text | Create, Sign, Editing, Save | Import, Trace, AI, Analyze, 3D, Export |
| Check it can be cut | Run cutability analysis | Analysis has run and findings are grouped | Analyze | Editing, Text, Create, Save | Import, Trace, AI, 3D, Export |
| Resolve what's found — the resolution checkpoint, always present; auto-completes unseen when nothing is actionable | One of Fix safe problems / Review decisions / Continue, by `resolutionPrimaryAction` | Complete via user Continue under `canCompleteResolution` (no blocking findings); unseen auto-advance only under `shouldAutoCompleteResolution` (nothing actionable) | Analyze | Editing, Save | Import, Trace, AI, 3D, Export, Create, Text, Sign |
| See it in 3D | Open the physical preview | Preview rendered, or an explicit unavailable state | 3D | Save | Import, Trace, AI, Create, Text, Sign, **Editing**, Analyze, Export |
| Save and export | Export SVG or DXF | Export written, or an explicit failure | Export | Save, 3D | Import, Trace, AI, Create, Text, Sign, Editing, Analyze |

#### Import My Own Design

Source classification is a **contextual variant of one stable step, not a
branch**: nothing about it is a choice the user makes deliberately, so it
never forks the step sequence. The *Prepare the source* step is one step id
at one position with one completion signal — "the source is committed as
editable geometry" — and which surface it presents is a rendering decision
over the classified file type, which lives in the transient preview slot the
caller already owns. Before a file is chosen, its type is unknown, so only
the generic "bring in a file" action is primary and Trace stays hidden until
a raster file is actually selected. The reducer walks the identical `stepIds`
list for both variants; nothing branches, and no definition changes mid-run.

| Stage | Primary action | Completion signal | primary | available | hidden |
|---|---|---|---|---|---|
| Choose the file | Pick a source file | A file is selected and classified as vector (SVG/DXF) or raster (PNG/JPEG) | Import | Save | AI, Analyze, 3D, Export, Create, Text, Sign, Editing, **Trace** |
| Prepare the source *(vector variant)* — review scale and findings | Accept the import | The source is committed as editable geometry | Import | Editing, Save | **Trace**, AI, Analyze, 3D, Export, Create, Text, Sign |
| Prepare the source *(raster variant)* — trace settings | Accept the traced paths | The source is committed as editable geometry | Trace | Editing, Save | **Import**, AI, Analyze, 3D, Export, Create, Text, Sign |
| Assign physical information | Set material, thickness, and role | Imported layer has manufacturing metadata | Editing (layers) | Create, Text, Save | Import, Trace, AI, 3D, Export, Analyze |
| Check it can be cut | Run cutability analysis | Analysis has run and findings are grouped | Analyze | Editing, Save | Import, Trace, AI, 3D, Export, Create, Text, Sign |
| Resolve what's found — the resolution checkpoint, always present; auto-completes unseen when nothing is actionable | One of Fix safe problems / Review decisions / Continue, by `resolutionPrimaryAction` | Complete via user Continue under `canCompleteResolution` (no blocking findings); unseen auto-advance only under `shouldAutoCompleteResolution` (nothing actionable) | Analyze | Editing, Save | Import, Trace, AI, 3D, Export, Create, Text, Sign |
| See it in 3D | Open the physical preview | Preview rendered, or an explicit unavailable state | 3D | Save | Import, Trace, AI, Create, Text, Sign, **Editing**, Analyze, Export |
| Export the result | Export SVG or DXF | Export written, or an explicit failure | Export | Save, 3D | Import, Trace, AI, Create, Text, Sign, Editing, Analyze |

The two *Prepare the source* rows are **one step** — same id, same position,
same completion signal — shown here as two rows only because their surface
states differ. The bolded cells are the anti-pattern Issue #45 names, stated
as a rule rather than an example: **the vector variant hides Trace outright,
and the raster variant hides Import outright**, and neither is presented
until source classification actually resolves one way or the other. Today
both panels are permanently mounted side by side, and physical 3D does not
exist as a focused stage at all. Analysis is its own explicit stage here for
the same reason it is in the other two goals: the resolution checkpoint's
counts have to come from an analysis that actually ran, in every goal, not
only in Create.

**Import/trace completion is explicit, not implied.** "Import committed or
cancelled" and "paths accepted or rejected" named two outcomes but left the
negative one undefined — G1 would have had to guess whether it advanced,
looped, or exited. It does neither on its own:

- **Accept** (commit the vector import, or accept the traced paths) advances
  to *Assign physical information*.
- **Cancel** (vector) or **Reject** (raster) returns to *Choose the file* —
  dispatched as an ordinary step-scoped `back`, clearing the pending preview
  so a different file can be tried. This is the same nullable-preview-slot
  pattern already proven for import/raster/sign-tools/AI previews (§1) — the
  reducer never marks a cancelled or rejected preview as commit-complete.
- **Exit guidance** (the global action, §3 rule) is always the other option
  from either variant, and never implied by cancel/reject.

Required 3D before export, restated as a table rule rather than left to §3's
prose alone: **every primary path that reaches Export must have passed through
its own 3D stage first**, with 3D's primary action being the sole primary
action of that stage and Export never primary until the preview completion
signal (rendered, or an explicit graceful-unavailable state) is recorded. No
stage collapses 3D and Export together.

The same rule extends one stage earlier in every goal: **the resolution
checkpoint must complete — `canCompleteResolution`, meaning no blocking
findings remain or a separately-approved acknowledgment (G4) is recorded —
before 3D**. No stage collapses the resolution checkpoint and 3D together
either.

#### Describe What I Want With AI — Optional

Reachable only while `ai.connection.status === "connected"`; otherwise the goal
is presented as unavailable and never as broken, reusing the existing check
rather than a new one (§2).

| Stage | Primary action | Completion signal | primary | available | hidden |
|---|---|---|---|---|---|
| Describe the sign | Enter a prompt and generate | Concepts returned, or an explicit failure | AI | Save | Import, Trace, Analyze, 3D, Export, Create, Text, Sign, Editing |
| Choose a concept | Accept one concept | Concept accepted into the document | AI | Editing, Text, Save | Import, Trace, Analyze, 3D, Export, Create, Sign |
| Make it manufacturable | Set material and thickness | Physical layer has material and thickness | Editing (layers) | Text, Create, Save | Import, Trace, AI, 3D, Export, Analyze |
| Check it can be cut | Run cutability analysis | Analysis has run and findings are grouped | Analyze | Editing, Save | Import, Trace, AI, 3D, Export, Create, Text, Sign |
| Resolve what's found — the resolution checkpoint, always present; auto-completes unseen when nothing is actionable | One of Fix safe problems / Review decisions / Continue, by `resolutionPrimaryAction` | Complete via user Continue under `canCompleteResolution` (no blocking findings); unseen auto-advance only under `shouldAutoCompleteResolution` (nothing actionable) | Analyze | Editing, Save | Import, Trace, AI, 3D, Export, Create, Text, Sign |
| See it in 3D | Open the physical preview | Preview rendered, or an explicit unavailable state | 3D | Save | Import, Trace, AI, Create, Text, Sign, **Editing**, Analyze, Export |
| Export the result | Export SVG or DXF | Export written, or an explicit failure | Export | Save, 3D | Import, Trace, AI, Create, Text, Sign, Editing, Analyze |

Accepted AI geometry passes the same import, editing, and cutability
validation as manual geometry — guidance never routes around a check.

#### Which stages are transient — the resume policy per goal

A stage is **transient** (`transientStepIds`, §6) when its prerequisites live
in in-memory feature state that does not survive an application restart — a
nullable preview slot or current analysis results. Every other stage rests
only on the document itself and resumes exactly. The designation is part of
this contract, not a G1 guess:

- **Create My First Sign** — only *Resolve what's found* is transient (its
  grouped findings are current analysis results); it recovers to *Check it
  can be cut*, which re-runs the deterministic analysis. Every other stage
  reads and writes the document.
- **Import My Own Design** — *Prepare the source* is transient (the pending
  import/trace preview slot); it recovers to *Choose the file*. *Resolve
  what's found* is transient exactly as in Create. *Choose the file* itself
  is stable: it is the re-entry point, needing nothing but an open document.
- **Describe What I Want With AI** — *Choose a concept* is transient
  (generated concepts are deliberately never persisted, per the AI privacy
  boundary); it recovers to *Describe the sign*. *Resolve what's found* is
  transient exactly as in Create.

3D and Export stages are stable in every goal: the physical preview and the
exporters derive everything from the authoritative document on demand.

#### What this matrix does and does not decide

It fixes, per stage, the primary action, the completion signal, and each
surface's state. It deliberately does not specify visual treatment, copy,
layout, component structure, or step ids — those are G1's to choose, and
pinning them here would be a UI decision wearing a contract's clothes.

Implementing the hiding and highlighting in `App.tsx` is G1+. G0 locks the
matrix so later slices implement one already-agreed contract instead of
inventing per-panel rules while building the shell.

### 4. Skipping a step is not leaving the workflow

These are two different user intentions and are two different actions:

- **`skip-step`** advances past the current step (recording it as skipped, not
  completed) and keeps the workflow `active`; on the final step it completes
  the workflow. Skipping one explanation must never end the journey.
- **`dismiss`** leaves the workflow deliberately and is terminal.

Not every step is skippable, and eligibility is **locked in the step
definition, not left to whichever caller happens to dispatch `skip-step`.**
`GuidedWorkflowDefinition.skippableStepIds` names exactly which of `stepIds`
may be bypassed this way; `isValidWorkflowDefinition` requires it to be a
known, duplicate-free subset of `stepIds`, and `skip-step` for a step outside
it is a **same-reference no-op** (`isStepSkippable`) — identical in shape to
every other identity mismatch this reducer already treats as a stale or
invalid event rather than a silent bypass. `canResumeSnapshot` (§6) enforces
the same rule against persisted history: a snapshot recording a skipped step
outside `skippableStepIds` describes a journey the reducer could never have
produced, and resume refuses it exactly like a duplicated or out-of-order
snapshot.

This is what makes the locked M15 product direction enforceable rather than
aspirational: physical 3D is a required guided checkpoint before export, and
the resolution checkpoint with unresolved blocking findings (§3) must stay in
the flow — both are simply step ids a definition must never place in
`skippableStepIds`. The 3D stage's own completion signal
already covers the one legitimate way past it without a rendered preview —
"Preview rendered, or an explicit unavailable state" (§3) — so a truthful
unavailable acknowledgment reaches the next stage through an ordinary
`advance` once that signal is satisfied, never through `skip-step`. A
genuinely optional explanation step, by contrast, belongs in
`skippableStepIds` and behaves exactly as described below.

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

`replay` carries **both** identities: `expectedRunToken` names the terminal run
the user actually chose to replay, and `nextRunToken` is the identity the
restarted run takes. Without the first, a delayed replay produced by run A
would restart whichever run happens to be terminal now. Without requiring the
second to differ, step events still in flight from the finished run would match
the restarted one. A blank token is rejected everywhere it is accepted, because
a blank token makes every run indistinguishable and the identity checks would
pass vacuously.

**Caller obligation.** Generating tokens belongs to the caller. That keeps the
reducer pure and deterministic -- a token minted inside would make identical
inputs produce different outputs -- but it means the reducer *cannot* verify
uniqueness on its own: `cancel` returns exactly the initial state, so the
module deliberately remembers no history of prior runs. G1 must therefore mint
a fresh, unique token for every `start`, `resume`, and `replay` (`randomUUID`
in the app layer is sufficient), and must test that integration contract at the
layer that owns it. The reducer enforces what it can see: non-blank, and, for
replay, different from the run being restarted.

### 6. Resumable persistence

`resume` is keyed off a persisted snapshot that can truthfully reconstruct an
interrupted workflow. G0 locks the **shape** only:

```ts
interface GuidedProjectBinding {
  documentId: string; // opaque, supplied by the app layer
  fingerprint: string; // opaque, captured at snapshot time
}

interface OnboardingWorkflowSnapshot {
  goal: GuidedGoal;
  definitionVersion: number;
  currentStepId: string;
  completedStepIds: string[];
  skippedStepIds: string[];
  projectBinding: GuidedProjectBinding;
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

**Progress is bound to one exact document.** `projectBinding` carries an
opaque identity and an opaque content fingerprint, both supplied by the app
layer — which already owns document identity and fingerprinting via the
`documentFingerprint`/`projectFingerprint` idiom in `ProjectSession` (§1) —
and compared by exact string equality only, keeping the pure module
independent of every project package. Resume refuses a snapshot whose
binding does not match the live document: a different identity is the wrong
project outright, and the same identity with a different fingerprint means
the document changed since the snapshot, so recorded progress ("analysis
passed", "material assigned") may no longer describe it. A binding that
cannot distinguish documents — blank identity or fingerprint — is rejected
at both capture (`toWorkflowSnapshot` returns `null` rather than persisting
a record every later resume must refuse) and resume. Deriving the binding
freshly at snapshot time and at resume time is a **G1 caller obligation** of
the same kind as minting run tokens (§5): fingerprints are point-in-time
values, so the reducer cannot carry one from `start` without it going stale
as the user edits.

**Transient steps recover; they are never reopened.** A snapshot whose open
step is in `transientStepIds` (§3's per-goal designation) resumes at the
nearest earlier non-transient step — `resolveResumeStepId` exposes the
target so G1 can say "we took you back to X" — reopening it with exactly
`back`'s semantics: progress from the recovery step forward is discarded, so
the restored record stays truthful. A snapshot open on a transient step with
no stable predecessor cannot resume at all, and the goal restarts. In every
refusal or recovery, the document itself is untouched; only guidance
position is lost.

Resume is otherwise **fail-closed**, and validates the full semantic
invariant rather than only checking that ids are recognizable. Recorded
progress must be **exactly the prefix of steps before the open step, each
accounted for exactly once** across completed and skipped.

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

A single saved project cannot exercise clean first launch, blank-canvas
creation, vector import, raster tracing, broken-file recovery, or the optional
AI path — those are different starting states, not different projects. G0
defines the actual **set**, without producing any of it; producing and wiring
it is G1/G6 work. Each entry, once produced, follows the same
provenance-recording convention the M14 G6 owner retest already established
(exact byte size and SHA-256 recorded alongside the fixture).

| Fixture | Starting state | Success signal | Failure/recovery route | Exercises |
|---|---|---|---|---|
| Clean install state | No recent projects, no persisted onboarding preferences, no autosave/recovery snapshot | The three goal choices are presented, not a blank professional workspace | n/a — this *is* the first-launch state | Clean first launch |
| Deterministic first-sign inputs | Empty document | Stock size, material, and text content specified in the fixture produce the same document every run | n/a (deterministic, no AI) | Create My First Sign |
| Representative SVG | A real multi-object SVG with layers | Import commits with expected units/scale/findings | A deliberately malformed variant returns to *Choose the file* without committing | Import My Own Design (vector) |
| Representative DXF | A real multi-entity DXF | Same as SVG | Same as SVG | Import My Own Design (vector) |
| Raster image (PNG or JPEG) | A real photo/scan of sign artwork | Trace accepted, editable paths produced | A degenerate image (blank/solid) is rejected without producing empty paths | Import My Own Design (raster) |
| Large-finding broken DXF | A file with a large finding count (hundreds+), none safely auto-fixable | Findings are summarized into a small number of grouped categories, not a raw entity-level list; `resolutionPrimaryAction` returns **Review decisions** and **Fix safe problems** is correctly absent (§3) | Forward: resolving or truthfully acknowledging findings until `canCompleteResolution` holds, then 3D. Exit: the global **Exit guidance** action, reachable from the resolution checkpoint like every other stage — a large finding count is never a trap with no way out short of finishing repairs | Resolve what's found |
| Multi-layer preview/export project | A real multi-layer `.laserx` project (already used for M14 G6 owner retest) | 3D preview renders exact thickness/holes/layer order; export writes real SVG/DXF | An explicit graceful-unavailable state if WebGL is absent | See it in 3D, Export the result |
| AI unavailable | `ai.connection.status !== "connected"` (no credential configured) | The AI goal is presented as unavailable, never as broken; manual paths remain fully usable | n/a | Describe What I Want With AI — Optional (disconnected) |
| AI connected (deterministic/stubbed) | `ai.connection.status === "connected"` via the existing test-mock credential path (`LASERX_TEST_AI_MOCK`/`LASERX_TEST_AI_CREDENTIAL_MODE`, defined in `apps/desktop/tests/e2e/helpers.ts` and already exercised by `ai-generation.spec.ts`) | A concept is generated and accepted deterministically, without a live provider call | A stubbed failure response is shown as an explicit failure, not a hang | Describe What I Want With AI — Optional (connected) |

For each owner-observed session: the fixture defines the **starting state**,
the session records whether the **success signal** was reached, whether any
**failure/recovery route** was needed and whether it worked, and whether the
primary path was completed within the **ten-minute observation target**. A
usability observation (a control that was hard to find or understand) is
explicitly valid session output, not a defect report — this is a locked
requirement from Issue #45's checklist convention (§ owner retest files),
carried forward rather than reinvented for M15.

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
