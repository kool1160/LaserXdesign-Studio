# ADR 0010: Editing Commands, State Ownership, and History

## Status

Accepted.

## Decision

Keep the authoritative project and editing session in the Electron main
process. Persistent document state consists of ordered objects, layers, guides,
and affine transforms in canonical millimeters. Selection, clipboard contents,
undo/redo stacks, and active transaction state belong to
`packages/application` and are intentionally absent from the project file.
React receives only a replaceable projection of that state.

Every pointer, keyboard, toolbar, menu, and inspector workflow sends the same
runtime-validated `EditorActionRequest` through preload. Application actions
resolve selection, fresh IDs, clipboard behavior, and transactions before
calling pure `EditorCommand` operations in `packages/domain`. React components
never mutate document arrays or calculate canonical geometry.

Represent object placement with a six-number affine matrix:

```text
x' = a*x + c*y + eMm
y' = b*x + d*y + fMm
```

Raw child geometry remains unchanged when a group is transformed. Ungroup
composes the group matrix into each child, preserving child IDs and world
geometry.

Use stable IDs for existing objects. Duplicate and paste allocate a fresh UUID
for every copied node, including descendants of groups. Duplicate offsets the
copy by 10 mm. Repeated paste uses successive 10 mm offsets from the copied
source. Grouping creates one fresh group ID while preserving child IDs.

History stores deterministic before/after project snapshots plus the commands
that produced each entry. It is bounded to 100 entries by default. A
transaction records one initial snapshot and commits all contained commands as
one history entry. Undo and redo restore exact snapshots, including IDs and
matrix values.

A transaction also snapshots selection, clipboard/paste sequencing, redo
entries, and the last-command projection. Temporary edits do not clear redo.
Committing a transaction with a new project state clears redo when it appends
the new history entry; canceling restores every transaction-touched session
projection and leaves the pre-existing redo branch intact.

Hit testing and edits exclude objects whose layer is hidden or locked. Basic
move snapping considers enabled grid intersections, guides, document
bounds/center, and visible editable object bounds/centers.

## Rationale

One command path prevents keyboard, pointer, and inspector behavior from
drifting apart. Explicit ephemeral-state ownership keeps selection and local
clipboard details out of deterministic project serialization. Snapshot history
is straightforward to audit and guarantees exact replay for the current small
documents while the fixed bound prevents unlimited growth.

Affine placement preserves primitive dimensions and child geometry across
repeated transforms. A renderer-independent hit-test and snapping boundary
keeps screen pixels and SVG state from becoming document authority.

## Alternatives

- Direct React object mutation was rejected because it bypasses validation,
  history, locked-layer rules, and persistence invariants.
- Separate UI-specific command types were rejected because equivalent user
  gestures could produce different domain behavior.
- Persisting selection, clipboard, or history was rejected because they are
  session state rather than saved design intent.
- Destructively rewriting primitive coordinates for every transform was
  rejected because repeated operations would accumulate avoidable drift.
- An unbounded command log was rejected because it has no memory ceiling.
- A canvas-library scene graph as the document authority was rejected because
  it would couple project geometry to rendering state.

## Consequences

All new editing entry points must extend the validated action union and reuse
domain commands. Commands that create objects must receive or allocate IDs at
the application boundary. Snapshot history may need a measured compact
representation in a later performance milestone, but its observable replay
semantics and 100-entry default remain the contract.
