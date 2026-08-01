# LaserX Desktop Design System

This specification governs the LaserX Design Studio desktop shell. The approved [LaserX Design website](https://www.laserxdesign.com/) is the brand source of truth; desktop interaction density, precision, accessibility, and manufacturing clarity take priority when a web pattern does not translate directly.

The M11 comparison was performed against the live approved reference after the product owner supplied it in Issue #26 and PR #28. The website's exposed identity tokens are ink `#071019`, secondary ink `#0b1622`, panel `#101e2c`, raised panel `#142638`, electric blue `#49b9f2`, ice blue `#9bdcff`, white `#f6f8fb`, muted steel `#9caebe`, and steel `#3a6e8c`. Those values, rather than the earlier provisional teal palette, define the desktop shell.

## Brand assets

- The LaserX mark is an electric-blue engineered `X` with a fine horizontal beam, ice highlight, dark steel interior, and near-square ink field. Do not introduce the earlier teal-and-warm-beam mark or round it into a consumer-app badge.
- The shell wordmark uses uppercase, tracked `LASERX` with a smaller muted `DESIGN STUDIO` line. Use the full product name, `LaserX Design Studio`, on startup and in the application shell. Use `LaserX` only where space is constrained.
- The renderer source is `apps/desktop/public/laserx-mark.svg`; the packaged Windows icon is `apps/desktop/public/laserx-icon.png`, generated deterministically with `pnpm --filter @laserx/desktop brand:assets`.

The website uses Inter. The offline Windows application requests Inter first and falls back to Segoe UI Variable/Segoe UI without downloading remote fonts. Strong display-style typography is reserved for product identity and first-run hierarchy; dense editor labels retain Windows-readable sizing.

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

## Interaction rules

1. Project files and artwork are different concepts. Use **Open Project** only for `.laserx`; use **Import Artwork** for SVG/DXF and **Trace Image** for PNG/JPEG.
2. Primary actions have a visible verb and object. File extensions can be supporting text, never the only label.
3. Every keyboard-reachable control receives the same high-contrast focus ring. Disabled controls retain readable labels and use `not-allowed`; application work in progress is announced separately.
4. Status is never color-only. Pair color with an icon or text such as `Saved`, `Warning`, `Offline`, or `Failed`.
5. Errors state what failed and whether files or geometry changed. Cancellation controls name the operation they stop.
6. Sidebars expose workflow landmarks. Create, import, trace, analyze, text, sign, and AI tools remain available without changing geometry or project semantics.
7. Primary calls to action may use a solid electric-blue field with ink text. Secondary actions use an ink or panel field with a blue/steel border; labels stay uppercase only when they act as compact navigation or section metadata.

## Layout rules

- The design surface always receives the flexible center column. Tool panels use bounded widths and independent scrolling.
- At 1366 x 768, primary commands, both tool navigators, the viewport toolbar, and status are visible without horizontal clipping.
- At 1920 x 1080, panel width remains bounded so additional space benefits the design surface.
- Compact-height rules reduce shell and panel spacing without reducing interactive targets below 28 px.
- The shell tolerates Windows scaling because geometry uses CSS pixels while the viewport adapter accounts for device pixel ratio.

## Review checklist

- Compare packaged screenshots at 1366 x 768 and 1920 x 1080 with the approved website reference.
- Verify keyboard order, focus visibility, readable disabled labels, non-color warning text, and reduced-motion behavior.
- Verify New Design, Open Project, Import Artwork, Save, and Export remain visually and semantically distinct.
- Run the complete packaged regression suite before review.
