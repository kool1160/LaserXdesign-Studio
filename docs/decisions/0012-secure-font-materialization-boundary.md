# ADR 0012: Secure Font Materialization Boundary

## Status

Accepted.

## Decision

Font discovery, binary loading, shaping, and outline materialization run in the
Electron main process through `packages/fonts`. The sandboxed renderer receives
only validated catalog metadata and may submit a font ID plus text layout
settings. It cannot submit or receive filesystem paths, font bytes, generated
contours, or arbitrary document objects.

The catalog combines:

- six pinned, redistributable Fontsource families with five OFL-1.1 licenses
  and one Apache-2.0 license;
- installed `.ttf` and `.otf` files discovered only in known Windows font
  directories;
- stable source IDs, SHA-256 fingerprints, family/style names, categories,
  source kind, and license metadata.

The font engine uses Fontkit behind a replaceable adapter. It shapes each line,
applies millimeter size, tracking, word spacing, line spacing, alignment, and
optional deterministic circular warping, then flattens font curves into
canonical millimeter contours. The main process creates or replaces the
authoritative text object with those contours.

Editable text persists both font intent and its materialized contours. A
missing or changed font is detected by ID and fingerprint; saved contours
remain unchanged until the user explicitly chooses a substitute and updates
the text. Converting text creates ordinary path children and can preserve the
editable text record as group source metadata.

Live editing is allowed only while the selected object's saved font ID and
fingerprint exactly match the current catalog. Both the renderer and
main-process service enforce this rule. A mismatch pauses live materialization;
choosing a current font and pressing Update is the explicit, undoable
substitution boundary.

Each materialized text contour records the deterministic index of the shaped
glyph compound that produced it. Viewport projection renders one even-odd SVG
path per glyph compound, and domain hit testing applies even-odd within each
compound before unioning the compound results. Enclosed counters therefore
remain empty regardless of contour winding, while overlaps between separate
glyphs remain filled. Outline conversion still emits every contour as an
individual path child for later geometric containment analysis.

## Rationale

Font files are privileged local inputs, while the renderer is untrusted.
Persisting the shaped result makes dimensions deterministic across save/reopen
and prevents an unavailable or updated font from silently changing geometry.
An explicit substitution action keeps the geometry change visible and
undoable.

## Alternatives

- Renderer-side font loading was rejected because it would expose filesystem
  access or local font bytes across the security boundary.
- Persisting only family/style names was rejected because font resolution can
  differ across machines and releases.
- Automatically substituting a missing font was rejected because it silently
  changes cut geometry.
- Bundling commercial or logo fonts was rejected because M04 permits only
  redistributable, audited assets.

## Consequences

Font discovery may add startup work and must remain restricted and testable.
Text contours increase project size, but provide deterministic geometry and
portable previews. Every bundled family must remain pinned in
`bundled-fonts.json`, retain complete attribution, and pass the license audit.
