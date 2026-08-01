# M11 — UI, Branding, and Product Polish

## User-visible outcome

LaserX looks and behaves like a cohesive commercial product, with a desktop interface that matches the approved LaserX Design website identity and makes existing workflows easier to discover and use.

## Included

- application logo, app icon, typography, color, spacing, border, elevation, and motion tokens aligned with the LaserX Design website;
- consistent command bars, side panels, inspectors, dialogs, buttons, inputs, tabs, badges, progress states, warnings, and preview surfaces;
- clearer information architecture and command grouping, including an explicit distinction between opening `.laserx` projects and importing SVG, DXF, PNG, or JPEG artwork;
- first-run guidance, useful empty states, contextual help, tooltips, and concise workflow explanations;
- consistent visual treatment for text, geometry, tracing, cutability, sign-template, and AI concept workflows;
- responsive desktop layout behavior for common Windows display sizes, scaling levels, and high-DPI environments;
- keyboard focus visibility, accessible contrast, non-color-only status communication, and reduced ambiguity in disabled/error states;
- polished loading, cancellation, offline, credential, recovery, and failure experiences without hiding technical truth;
- repository-owned visual regression screenshots and packaged Windows end-to-end coverage for representative workflows;
- small usability corrections required to expose or clarify existing capabilities, without adding a new major product feature.

## Brand boundary

The website is the visual reference, not a requirement to copy web layouts directly into the desktop application. Desktop interaction density, native window behavior, editing precision, accessibility, and manufacturing clarity take priority when a web pattern does not translate cleanly.

## Explicitly excluded

No new AI generation capability, layered-production system, CAM, nesting, G-code, DWG, machine control, marketplace, licensing platform, or unrelated feature expansion. M11 may reorganize and clarify existing controls but must not silently change geometry, file-format, cutability, or project-history semantics.

## Acceptance tests

1. Approved LaserX brand tokens and desktop usage rules are documented and used consistently across the application.
2. New, Open Project, Import Artwork, Save, and Export are unmistakably distinct in the primary navigation.
3. Core create, import, trace, cutability, sign-template, and AI-concept workflows are discoverable without reading repository documentation.
4. Representative workflows remain usable without clipping or inaccessible controls at 1366 × 768, 1920 × 1080, and common Windows scaling levels.
5. Keyboard focus is visible, essential workflows are keyboard reachable, contrast is acceptable, and warnings are not color-only.
6. Loading, empty, error, cancellation, offline, and recovery states use consistent language and visual hierarchy.
7. Existing project, geometry, import/export, analysis, undo/redo, and persistence regression suites remain green.
8. Packaged Windows screenshots demonstrate visual consistency with the approved LaserX website identity.

## Exit checklist

- [ ] Desktop brand and design-token specification documented.
- [ ] Navigation and information architecture review complete.
- [ ] Accessibility and high-DPI review complete.
- [ ] Representative visual-regression evidence reviewed.
- [ ] Packaged Windows polish workflow passes.
- [ ] Status advances to M12.
