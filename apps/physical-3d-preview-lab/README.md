# LaserX Physical 3D Preview Lab

This folder is the isolated browser-based research application for GitHub Issue #34.

M13 remains active. M14 is not active. This application is not part of the current LaserX product and must not be merged into `main` until the future M14 gate explicitly authorizes integration.

## Start here

1. Read `CLAUDE.md` in this folder.
2. Read `../../docs/experiments/m14-physical-3d-preview/PROJECT_BRIEF.md`.
3. Complete Phase 0 and write `ENGINE_DECISION.md` before scaffolding the application.

## Intended stack

The expected visualization stack is React, Vite, Three.js, and React Three Fiber. This remains subject to the documented evidence-based engine decision.

The application must consume the pure scene model from `@laserx/physical-preview-3d`. It must not calculate authoritative manufacturing geometry in React or Three.js components.

## Planned commands

Claude should add workspace-consistent commands for development, unit tests, browser tests, build, and evidence capture. Do not invent command names that conflict with existing repository conventions.

## Non-product warning

No result from this lab is manufacturing evidence. SVG, DXF, production packages, cutability analysis, explicit material/thickness metadata, and the native LaserX project remain authoritative.
