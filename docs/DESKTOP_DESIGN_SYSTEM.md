# LaserX Desktop Design System

This specification governs the LaserX Design Studio desktop shell. The approved LaserX Design website is the brand source of truth; desktop interaction density, precision, accessibility, and manufacturing clarity take priority when a web pattern does not translate directly.

The approved website URL is not stored in the repository as of the M11 implementation branch. The checked-in token values preserve the established LaserX desktop teal/industrial identity and remain subject to final product-owner comparison against that approved reference.

## Brand assets

- The LaserX mark combines two tool-path strokes, a warm laser beam, and a bright focal point. Keep its proportions intact and do not recolor individual strokes outside an approved theme.
- Use the full product name, `LaserX Design Studio`, on startup and in the application shell. Use `LaserX` only where space is constrained.
- The renderer source is `apps/desktop/public/laserx-mark.svg`; the packaged Windows icon is `apps/desktop/public/laserx-icon.png`, generated deterministically with `pnpm --filter @laserx/desktop brand:assets`.

## Tokens

Renderer tokens live in `apps/desktop/src/styles/app.css`. Components consume semantic tokens instead of choosing one-off colors.

| Role | Token | Desktop use |
| --- | --- | --- |
| Application canvas | `--surface-app` | Window and startup background |
| Shell | `--surface-shell` | Header, command bar, status bar |
| Panel | `--surface-panel` | Sidebars and inspectors |
| Raised control | `--surface-raised` | Buttons, fields, cards |
| Primary text | `--text-primary` | Titles and critical values |
| Secondary text | `--text-secondary` | Labels and supporting copy |
| Muted text | `--text-muted` | Metadata only |
| Brand accent | `--accent` | Focus, selection, primary actions |
| Attention | `--warning` | Recovery, caution, destructive previews |
| Failure | `--danger` | Errors and destructive actions |
| Success | `--success` | Saved, connected, completed states |

Spacing uses a 4 px base scale (`--space-1` through `--space-8`). Corners use `--radius-sm`, `--radius-md`, and `--radius-lg`. Motion uses `--motion-fast` and `--motion-standard`, and is disabled when reduced motion is requested.

## Interaction rules

1. Project files and artwork are different concepts. Use **Open Project** only for `.laserx`; use **Import Artwork** for SVG/DXF and **Trace Image** for PNG/JPEG.
2. Primary actions have a visible verb and object. File extensions can be supporting text, never the only label.
3. Every keyboard-reachable control receives the same high-contrast focus ring. Disabled controls retain readable labels and use `not-allowed`; application work in progress is announced separately.
4. Status is never color-only. Pair color with an icon or text such as `Saved`, `Warning`, `Offline`, or `Failed`.
5. Errors state what failed and whether files or geometry changed. Cancellation controls name the operation they stop.
6. Sidebars expose workflow landmarks. Create, import, trace, analyze, text, sign, and AI tools remain available without changing geometry or project semantics.

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
