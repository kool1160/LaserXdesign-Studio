# M03 — Selection, Transforms, Layers, and History

## User-visible outcome

The workspace behaves like a real editor: users can select objects, move/scale/rotate/mirror them, organize layers, group objects, and undo or redo every edit.

## Included

- single, multi, marquee, and modifier-key selection;
- move, exact position, scale, exact size, rotate, mirror, duplicate, delete;
- transform handles and inspector entry;
- lock aspect ratio;
- align and distribute;
- group and ungroup;
- layers, visibility, lock, rename, reorder, and z-order;
- command history, undo/redo, transaction grouping, and history limits;
- keyboard shortcuts;
- snapping to grid, guides, object bounds, and centers at a basic level;
- copy/paste within the application;
- command serialization tests where relevant.

## Explicitly excluded

Node editing, text, topology-changing booleans, raster tracing, cutability, and AI.

## Acceptance tests

1. Every listed edit can be undone and redone without ID corruption.
2. Exact dimensions remain accurate after repeated transforms.
3. Locked or hidden-layer objects cannot be edited through accidental hit testing.
4. Group transforms preserve child geometry and can be ungrouped.
5. Save/reopen preserves layer order, groups, transforms, and locks.
6. A 100-step representative history remains deterministic.
7. Keyboard and pointer workflows produce the same domain commands.

## Exit checklist

- [x] Command/history model documented.
- [x] Transform invariant tests pass.
- [x] End-to-end editing workflow passes.
- [x] No direct arbitrary document mutation from UI components.
- [ ] Status advances to M04.

The final item remains blocked until the M03 pull request is reviewed, Windows
CI is green, and the pull request is merged.
