# LaserX Desktop Design System

This specification governs the LaserX Design Studio desktop shell. The approved [LaserX Design website](https://www.laserxdesign.com/) is the brand source of truth; desktop interaction clarity, precision, accessibility, and manufacturing truth take priority when a web pattern does not translate directly.

LaserX uses an Apple-like product philosophy without copying Apple artwork, macOS components, or branding. The intended qualities are simple, clean, calm, obvious, restrained, and dependable. The interface should hide unnecessary complexity while keeping advanced capability discoverable when the user actually needs it.

The M11 comparison was performed against the live approved reference after the product owner supplied it in Issue #26 and PR #28. The website's exposed identity tokens are ink `#071019`, secondary ink `#0b1622`, panel `#101e2c`, raised panel `#142638`, electric blue `#49b9f2`, ice blue `#9bdcff`, white `#f6f8fb`, muted steel `#9caebe`, and steel `#3a6e8c`. Those values, rather than the earlier provisional teal palette, define the desktop shell.

## Brand assets

- The LaserX mark is an electric-blue engineered `X` with a fine horizontal beam, ice highlight, dark steel interior, and near-square ink field. Do not introduce the earlier teal-and-warm-beam mark or round it into a consumer-app badge.
- The shell wordmark uses uppercase, tracked `LASERX` with a smaller muted `DESIGN STUDIO` line. Use the full product name, `LaserX Design Studio`, on startup and in the application shell. Use `LaserX` only where space is constrained.
- The renderer source is `apps/desktop/public/laserx-mark.svg`; the packaged Windows icon is `apps/desktop/public/laserx-icon.png`, generated deterministically with `pnpm --filter @laserx/desktop brand:assets`.

The website uses Inter. The offline Windows application requests Inter first and falls back to Segoe UI Variable/Segoe UI without downloading remote fonts. Strong display-style typography is reserved for product identity and first-run hierarchy; editor labels retain Windows-readable sizing.

## Tokens

Renderer tokens live in `apps/desktop/src/styles/app.css`. Components consume semantic tokens instead of choosing one-off colors.

| Role | Token | Desktop use |
| --- | --- | --- |
| Application canvas | `--surface-app` (`#071019`) | Window and startup background |
| Shell | `--surface-shell` (`#0b1622`) | Header, command bar, status bar |
| Panel | `--surface-panel` (`#101e2c`) | Sidebars and inspectors |
| Raised control | `--surface-raised` (`#142638`) | Buttons, fields, cards |
| Primary text | `--text-primary` (`#f6f8fb`) | Titles and critical values |
| Secondary text | `--text-secondary` (`#c7d2dc`) | Labels and supporting copy |
| Muted text | `--text-muted` (`#9caebe`) | Metadata only |
| Brand accent | `--accent` (`#49b9f2`) | Focus, selection, primary actions |
| Brand highlight | `--accent-strong` (`#9bdcff`) | Focus emphasis and mark highlights |
| Attention | `--warning` | Recovery, caution, destructive previews |
| Failure | `--danger` | Errors and destructive actions |
| Success | `--success` | Saved, connected, completed states |

Spacing uses a 4 px base scale (`--space-1` through `--space-8`). The website's square industrial controls translate to 1 px, 2 px, and 4 px desktop corner tokens; circles remain reserved for semantic dots, nodes, and progress indicators. Motion uses `--motion-fast` and `--motion-standard`, and is disabled when reduced motion is requested.

## Core interaction philosophy

The governing rule is:

> LaserX presents the next useful decision, not every possible decision.

And:

> A control appears because it is relevant to the current workflow, not merely because LaserX supports it.

The desktop experience must:

- keep one clear primary action visible for the current step whenever practical;
- put the most important information and controls directly in front of the user;
- use contextual tool surfaces instead of permanent walls of buttons;
- move advanced settings behind clear progressive disclosure such as **Advanced**, **More**, a contextual inspector, menus, or command search;
- preserve discoverability without making uncommon tools visually compete with the current task;
- keep the user oriented when moving between create, import, repair, 3D, and export;
- use normal shop language before geometry-engine language;
- never force the user to choose a tool that does not apply to the selected file type or workflow.

A blank professional workspace with every tool exposed at once is not the default first-run experience.

## Workflow-specific surfaces

### Create a sign

Show sign type, text, dimensions, shape, border/backing, holes, material, and the next manufacturing step. Do not show trace controls, import diagnostics, or unrelated node-repair controls unless the user intentionally enters an advanced editing mode.

### Import SVG or DXF

Show source scale, units, layer handling, conversion findings, grouped repair choices, preview, and accept/cancel. Do not show raster trace controls.

### Import PNG or JPEG

Show preprocessing, threshold/edge/trace settings, trace preview, cleanup, and accept/cancel because tracing is relevant to raster input.

### Repair geometry

Show grouped problem categories, affected geometry, repair confidence, before/after preview, and one clear primary action such as **Fix safe problems**. Raw entity-level findings remain available in Details or diagnostics, not as the main interface.

After safe repair, show a useful summary such as:

> 1,899 safe problems fixed. Six decisions remain.

Ambiguous decisions are navigable one group or affected area at a time.

### Physical 3D preview

Show view presets, orbit/pan/zoom/reset, assembled/exploded mode, physical layers, materials, dimensions, visibility, findings, and capture. Hide node editing, import, tracing, and unrelated design tools.

### Export

Show downstream target/profile, units, scale, included layers/operations, warnings, destination, and one clear export action. Do not expose machine-control settings that LaserX does not own.

## Repair presentation rules

1. Do not lead with a raw number such as `1,905 errors` when the findings can be grouped into a few repair decisions.
2. Group by problem class, affected scope, repair confidence, and user decision.
3. Use the explicit classes **Safe to fix**, **Suggested fix**, and **Needs your decision**.
4. **Fix safe problems** always previews proposed changes before authoritative mutation.
5. Accepted batch repair should be one undoable action whenever technically practical.
6. Report fixed, skipped, and remaining counts separately.
7. Never describe a design as safe or cut-ready solely because automatic repair completed.
8. Detailed per-entity diagnostics remain available for advanced users and support without dominating normal use.

## General interaction rules

1. Project files and artwork are different concepts. Use **Open Project** only for `.laserx`; use **Import Artwork** for SVG/DXF and **Trace Image** for PNG/JPEG.
2. Primary actions have a visible verb and object. File extensions can be supporting text, never the only label.
3. Every keyboard-reachable control receives the same high-contrast focus ring. Disabled controls retain readable labels and use `not-allowed`; application work in progress is announced separately.
4. Status is never color-only. Pair color with an icon or text such as `Saved`, `Warning`, `Offline`, or `Failed`.
5. Errors state what failed and whether files or geometry changed. Cancellation controls name the operation they stop.
6. Contextual surfaces expose the controls required by the selected workflow. Unrelated create, import, trace, analyze, text, sign, AI, 3D, and export controls must not remain permanently visible merely for discoverability.
7. Primary calls to action may use a solid electric-blue field with ink text. Secondary actions use an ink or panel field with a blue/steel border; labels stay uppercase only when they act as compact navigation or section metadata.
8. Advanced and uncommon actions remain reachable but visually subordinate to the current primary workflow.
9. Empty states explain the next useful action instead of presenting an unexplained blank canvas.
10. Success, loading, warning, failure, disabled, offline, and recovery states use consistent language and component patterns across the application.

## Layout rules

- The design surface receives the flexible center column.
- Contextual panels use bounded widths and independent scrolling.
- The default layout should not reserve permanent space for every possible tool category.
- At 1366 x 768, the current workflow's primary actions, viewport controls, and status remain visible without horizontal clipping.
- At 1920 x 1080, panel width remains bounded so additional space benefits the design surface rather than producing wider control walls.
- Compact-height rules reduce shell and panel spacing without reducing interactive targets below 28 px.
- The shell tolerates Windows scaling because geometry uses CSS pixels while the viewport adapter accounts for device pixel ratio.
- Modal and step-based workflows must preserve a visible escape, cancel, back, or close path and may not trap the user.

## M15 workflow review checklist

- Confirm SVG/DXF import does not expose raster trace controls.
- Confirm raster import exposes trace controls only after a raster source is selected.
- Confirm each guided step has one obvious primary action.
- Confirm advanced tools remain discoverable without permanent visual prominence.
- Confirm grouped repair and **Fix safe problems** preview/accept/undo behavior.
- Confirm empty states explain what to do next.
- Confirm keyboard order, focus visibility, non-color status, and reduced-motion behavior.

## M22 final interface-polish checklist

- Review every primary screen at 1366 x 768, 1920 x 1080, and supported Windows scaling.
- Remove redundant controls, duplicate navigation, unexplained icons, and technical language that does not help the user decide.
- Verify typography, spacing, panel hierarchy, button priority, menus, dialogs, inspectors, empty states, tables, loading, errors, success, recovery, and disabled states are consistent.
- Verify the current primary action remains visually dominant and unrelated controls remain subordinate or hidden.
- Verify create, import, trace, repair, 3D, and export each present only their relevant controls by default.
- Verify real-user evidence supports the final layout and hierarchy rather than relying only on internal preference.
- Complete owner visual review with packaged screenshots before Version 1 release.

## Review checklist

- Compare packaged screenshots with the approved brand reference while enforcing the workflow-first rules above.
- Verify New Design, Open Project, Import Artwork, Save, and Export remain visually and semantically distinct.
- Verify no screen becomes an engineering dashboard of unrelated controls.
- Run the complete packaged regression suite before final review.
