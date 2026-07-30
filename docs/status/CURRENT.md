# Current Project Status

## Active gate

**M01 — Desktop shell and project lifecycle**

## State

M00 is complete. The Codex-ready repository foundation was merged to `main` in commit `683a0aff72671a76b1e5ac7b366069d4cd0a29d2` after the Repository Guard passed on the reviewed PR head.

Production feature implementation has not started. M01 is now the only active implementation milestone.

## M00 completion record

- [x] Repository initialized.
- [x] Root `AGENTS.md` created.
- [x] Product requirements documented.
- [x] Architecture and package boundaries documented.
- [x] Large milestone sequence documented.
- [x] Directory/package scaffold committed.
- [x] GitHub workflow and contribution templates committed.
- [x] Repository Guard passed.
- [x] Foundation merged to `main`.
- [x] Status advanced to M01.

## M01 objective

Deliver a launchable, securely isolated Windows desktop shell with a versioned blank `.laserx` project lifecycle: new, open, save, save-as, dirty-state protection, and recovery skeleton.

Read `docs/milestones/M01-desktop-shell.md` before starting.

## Allowed work

- select and pin compatible active versions for Node, pnpm, Electron, React, Vite, TypeScript, Vitest, and Playwright;
- establish the lockfile and working root verification commands;
- implement secure Electron main/preload/renderer boundaries;
- implement the blank application shell and typed IPC;
- implement `.laserx` schema version 1 for an empty project;
- implement new/open/save/save-as/recent-file/dirty-state behavior;
- implement autosave and recovery skeleton;
- add M01 unit, integration, smoke, package, and end-to-end tests;
- record required M01 ADRs and update documentation.

## Not allowed yet

Do not implement the production canvas, geometry engine, text/font tools, tracing, SVG/DXF workflows, cutability, sign generators, AI generation, layered export, CAM, G-code, DWG, or any M02+ feature.

## M01 exit rule

Do not advance to M02 until every acceptance test and exit item in `docs/milestones/M01-desktop-shell.md` passes and this file is updated with the verified completion commit.
