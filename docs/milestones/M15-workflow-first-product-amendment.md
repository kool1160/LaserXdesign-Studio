# M15 Workflow-First Product Amendment

## Status and authority

This document records an owner-approved product and milestone amendment for LaserX Design Studio.

It supplements:

- `docs/milestones/M15-guided-onboarding-learn-mode.md`;
- GitHub Issue #45;
- `docs/CLAUDE_EXECUTION_PLAN.md`;
- `docs/milestones/M22-real-user-usability-validation.md`;
- GitHub Issue #52.

It does not replace ADR 0027, alter the exact acceptance of active M15 G0 / PR #67, merge that PR, activate G1, or authorize later-milestone work.

After this amendment is reviewed and merged, it becomes binding on M15 G1-G6 and on M22's final usability review.

## Product decision

LaserX must not behave primarily like a professional editor that happens to contain a tutorial.

The default product experience is a goal-driven guided workflow. The complete editor remains available through a clear **Advanced Workspace** or **Exit Guidance** action.

The normal user experience is:

1. choose what to do;
2. see one clear primary action;
3. use only the controls relevant to that step;
4. repair manufacturing problems without being buried in raw diagnostics;
5. inspect the finished physical result in 3D;
6. save and export into the downstream software the user already owns.

Guidance narrows what is prominent. It must never hide the existence of the advanced workspace, trap the user, mutate geometry invisibly, or replace existing manufacturing truth.

## Cross-slice rules

These rules apply throughout M15:

- Guided workflow is the default first-launch and task-oriented experience.
- Advanced Workspace and Exit Guidance remain one clear action away.
- The full editor remains powerful; advanced controls are discoverable without being permanently dominant.
- Feature surfaces are isolated incrementally as each active slice needs them. No single broad `App.tsx` rewrite or whole-application visual rewrite is authorized.
- Create, import, trace, repair, 3D, save, and export are treated as controllable workflow surfaces rather than one permanent wall of tools.
- Physical 3D is a required guided checkpoint before export, except when a truthful unavailable/failure route is explicitly acknowledged.
- Save remains available whenever a document exists.
- AI remains optional and user-supplied. Normal sign creation must remain complete without AI or internet access.
- LaserX remains machine-independent. No machine control, CAM, G-code, nesting, or direct LightBurn replacement belongs in M15.
- Every automated repair is classified by confidence, previewed before acceptance, undoable when technically practical, and followed by truthful remaining-risk reporting.
- Early user observation occurs during the user-facing M15 slices. M22 still owns the larger final Version 1 cohort and app-wide polish.

## G1 — Default guided shell and feature-surface controller

### Outcome

A new or returning user opens LaserX and immediately understands the next useful choice without being dropped into an unexplained professional workspace.

### Required behavior

G1 must deliver:

- the first-launch goal chooser for:
  - **Create My First Sign**;
  - **Import My Own Design**;
  - **Describe What I Want With AI — Optional**;
- **Resume previous workflow** when a valid resumable snapshot exists;
- **Advanced Workspace** as a direct manual entry;
- **Exit Guidance** from every guided state;
- local, privacy-respecting onboarding preference and resumable-state persistence;
- fresh workflow-run identity for every start, resume, and replay, as required by ADR 0027;
- keyboard and focus ownership that keeps the current step understandable and does not leak commands into hidden editor surfaces;
- a workflow-surface controller capable of marking the following surfaces primary, available, or hidden:
  - Create;
  - Import;
  - Trace;
  - Analyze / Repair;
  - Text;
  - Sign tools;
  - AI;
  - Editing;
  - 3D;
  - Save;
  - Export.

### Incremental extraction rule

G1 must not rewrite the entire desktop application.

Only extract, wrap, or isolate the minimum current surfaces required to prove the guided shell and contextual visibility contract. Later surfaces are extracted when their own slice needs them. Existing behavior and manufacturing contracts remain intact throughout the transition.

### Acceptance additions

- A clean launch presents the three goals and Advanced Workspace without requiring a tutorial video.
- A returning user can resume only a semantically valid workflow snapshot.
- Exit Guidance returns control without losing or mutating project work.
- Hidden surfaces do not receive unintended keyboard, pointer, or stale workflow actions.
- The shell can demonstrate one primary action while keeping advanced/manual access discoverable.

## G2 — Create My First Sign guided vertical slice

### Required sequence

The guided create path must lead through:

1. choose a basic sign type;
2. enter or edit text;
3. set exact dimensions;
4. choose material and physical thickness from the currently supported material model;
5. add an applicable border, backing, or layer structure;
6. run manufacturing analysis;
7. resolve, acknowledge, or intentionally defer findings;
8. save the project;
9. open the focused physical 3D preview;
10. complete or truthfully acknowledge the 3D checkpoint;
11. export the finished geometry.

### 3D checkpoint rule

Export must not become the guided primary action until:

- physical 3D has rendered and the user has completed the guided preview step; or
- a truthful WebGL, conversion, or unavailable path has been shown and explicitly acknowledged.

During the focused 3D step, unrelated create, import, trace, repair, and editing surfaces are hidden. Exit Guidance remains available as a separate global action.

### Early observation checkpoint

Before G2 closes, at least one owner-approved first-time participant must attempt the deterministic create workflow without direct coaching.

Record:

- completion time;
- where the participant hesitated or became lost;
- incorrect clicks;
- misunderstood language;
- whether the participant reached 3D;
- whether the participant exported successfully;
- concrete G2 blockers repaired before advancement.

This is a focused implementation reality check, not the final M22 market cohort.

## G3 — Vector import and raster trace contextual guidance

### Required branching

File selection begins with source type unknown.

- Trace controls remain hidden during generic file selection.
- SVG/DXF routes to vector import, scale, units, layer review, grouped findings, and accept/cancel behavior.
- PNG/JPEG routes to raster preprocessing and trace settings only after a raster source is selected.
- Import cancellation returns to source selection or exits through a named recovery path; it never counts as successful import completion.
- Conversion rejection returns to source selection or a truthful recovery state without inventing geometry.

### Required sequence after successful import

1. confirm scale and units;
2. review imported layers and geometry;
3. understand grouped conversion and repair findings;
4. accept the imported result;
5. run manufacturing analysis;
6. complete the focused 3D checkpoint;
7. save and export.

### Early observation checkpoint

Before G3 closes:

- at least one owner-approved first-time participant completes a vector-import attempt using a real SVG or DXF;
- at least one owner-approved first-time participant completes a raster-import and trace attempt using a real PNG or JPEG.

The same participant may cover both paths if the sessions remain independently observed and recorded.

Record scale/units confusion, inappropriate surface exposure, recovery behavior, 3D completion, and export success.

## G4 — Flagship broken-file repair and Fix Safe Problems

### Product priority

Repair is a flagship LaserX capability, not a buried diagnostic page.

The normal user should see a small number of understandable repair decisions rather than hundreds or thousands of entity-level messages.

### Required presentation

Findings are grouped into:

1. **Safe to fix**;
2. **Suggested fix**;
3. **Needs your decision**.

The main summary should communicate value in plain language, for example:

> **1,899 safe problems can be fixed automatically. Six decisions remain.**

Entity-level diagnostics remain available through Details for advanced users and support, but do not dominate the default experience.

### Required repair contract

Every repair class must define:

- why it is safe, suggested, or ambiguous;
- what geometry it affects;
- the exact deterministic eligibility rule;
- what will change;
- what remains uncertain;
- whether it can be applied as part of one undoable batch;
- whether manufacturing analysis must be rerun;
- what fixed, skipped, and remaining counts mean.

**Fix safe problems** must:

- preview the before/after result;
- change nothing before acceptance;
- apply accepted deterministic fixes as one undoable transaction whenever technically practical;
- preserve reject and undo paths;
- rerun or invalidate analysis truthfully;
- never claim that automated repair proves cut readiness or physical safety.

### Required fixture classes

G4 evidence must include:

- exact duplicate geometry;
- zero-length entities;
- redundant collinear points;
- approved near-closures within an explicit tolerance;
- open contours outside the safe threshold;
- self-intersections;
- overlaps;
- unsupported islands or ambiguous containment;
- scale or unit ambiguity;
- one genuinely large-finding broken DXF.

No additional class may be labeled safe without deterministic evidence and regression coverage.

### Early observation checkpoint

Before G4 closes, at least one owner-approved first-time participant must:

1. import a representative broken file;
2. understand the grouped summary;
3. preview Fix Safe Problems;
4. accept the repair;
5. undo it;
6. reapply it;
7. work through the remaining ambiguous decisions;
8. reach 3D and export.

Record whether the participant understood what changed and whether trust was preserved.

## G5 — Learn Mode, replay, recovery, and contextual explanations

### Product behavior

Learn Mode is not a disconnected slideshow or a separate manual pasted over the application.

It uses the same contextual surface system as guided onboarding and answers, in normal shop language:

- what is this;
- why would I use it;
- what changes if I continue;
- what happens if I skip it;
- can I undo it;
- does it affect geometry or only presentation;
- does it affect machine settings;
- why is LaserX warning me.

### Required topics

Learn Mode must cover at least:

- physical layers;
- material and thickness;
- bridges and islands;
- cutability and manufacturing warnings;
- repair confidence;
- Fix Safe Problems;
- 3D preview;
- save and export;
- the difference between LaserX and downstream machine software;
- AI as an optional assistant rather than a product requirement.

### Recovery rules

- Help can be opened inside create, import, trace, repair, 3D, and export.
- Replay never overwrites current project work.
- Resume fails closed when the saved workflow no longer matches the current definition.
- The user can disable Learn Mode entirely without disabling core product capability.
- Guidance failure leaves normal editing, saving, analysis, 3D, and export available.

## G6 — Packaged accessibility and first-session validation

### Minimum cohort

M15 G6 requires at least five owner-approved first-time participants.

At least four of the five must complete one documented primary workflow within ten minutes without direct coaching.

The cohort evidence must include:

- at least one Create My First Sign session;
- at least one vector-import session;
- at least one raster-import/trace session;
- at least one broken-file repair session;
- at least one AI-disconnected experience proving the normal product remains complete;
- physical 3D and export evidence;
- at least one realistic mistake and successful recovery.

One participant may cover more than one path, but the evidence set must cover every required path.

### Required measurements

Record:

- time to first successful project;
- stuck points;
- incorrect clicks;
- undiscovered features;
- misunderstood terminology;
- whether users understood LaserX versus machine-control software;
- whether users understood AI is optional;
- whether users reached and understood 3D;
- whether users exported at the intended scale;
- whether users recovered from a mistake;
- severity and disposition of every confirmed blocker.

### Packaged quality requirements

G6 also proves:

- keyboard and focus behavior;
- screen-reader labels and `aria-live` status;
- reduced motion;
- non-color-only guidance;
- high-DPI and supported Windows scaling;
- no permanent trapped workflow state;
- no hidden destructive edits;
- no regression to a permanent wall of unrelated controls.

M15 closes only after the owner accepts the packaged evidence and the exact-head audit passes.

## M22 carry-forward rule

M22 remains the final, broader Version 1 usability and visual-polish gate after M16-M21 add materials, process guidance, export profiles, AI onboarding, licensing, and community beta behavior.

M22 must begin by reviewing all M15 observation evidence and proving that later milestones did not reintroduce:

- permanent walls of unrelated tools;
- hidden or competing primary actions;
- optional 3D being bypassed in the guided path;
- raw entity-level repair overload;
- technical language that does not help the user decide;
- AI dependency;
- inaccessible or high-DPI-broken guidance;
- workflow drift between create, import, repair, 3D, and export.

M15 establishes the workflow-first pattern. M22 validates the complete Version 1 product against that pattern with the larger controlled cohort.

## Explicit non-goals

This amendment does not authorize:

- changing active G0 acceptance or PR #67 scope;
- activating G1 before G0 merge, exact-head acceptance, and owner advancement;
- a broad one-shot desktop rewrite;
- acrylic, wood, MDF, or material-schema implementation before M16;
- process profiles before M17;
- downstream export profiles before M18;
- new AI capability before M19;
- licensing before M20;
- public beta before M21;
- final app-wide Version 1 polish before M22;
- machine control, CAM, nesting, G-code, or controller work before the post-Version-1 gates.
