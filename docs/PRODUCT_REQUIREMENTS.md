# Product Requirements

## Product name

LaserX Design Studio

## Problem

Metal-sign design usually requires a frustrating chain of unrelated tools: image editing, font browsing, vector tracing, CAD cleanup, bridge creation, contour checking, scaling, and DXF export. General-purpose CAD programs are powerful but slow for artistic sign work. Graphics programs are easier to draw in but do not understand manufacturing constraints.

LaserX Design Studio joins those steps in one focused editor.

## Primary users

- plasma-table owners;
- laser-cutting shops;
- sign makers and fabricators;
- hobbyists who need dependable DXF/SVG output;
- designers converting customer artwork into cut-ready geometry.

## Primary jobs to be done

1. Create a sign from text and common sign shapes.
2. Import a logo or image and convert it into editable vectors.
3. Generate a sign concept from a written prompt.
4. Repair geometry so enclosed parts do not unintentionally fall out.
5. Create layered designs with front art and backing plates.
6. Export a correctly sized file for CAM.

## Version 1 required workflows

### Text sign

Create text, choose an installed or bundled licensed font, adjust spacing and layout, convert to outlines, add bridges where needed, set physical size, and export DXF/SVG.

### Image trace

Import PNG/JPEG, adjust threshold and cleanup, trace to vectors, simplify, edit, validate, and export.

### Existing vector

Import SVG, preserve scale when known, edit paths, validate cutability, and export SVG/DXF.

### Prompt-generated sign

Enter a prompt and machine constraints, generate concept options, choose one, convert it into normalized editable geometry, validate it, and continue editing. The initial commercial model uses user-owned OpenAI API access and direct OpenAI billing behind a provider-neutral adapter. Credentials remain outside projects, renderer code, logs, fixtures, telemetry, and source control. Future delegated OpenAI/ChatGPT authorization may replace manual API-key setup without changing the generation pipeline.

### Layered sign

Separate front artwork, backing plate, spacers/holes, and export each manufacturing layer with an assembly preview.

## Core functional requirements

- project create/open/save/save-as/recovery;
- exact document size and display-unit switching;
- selection, move, rotate, scale, mirror, duplicate, group, align;
- layers and z-order;
- undo/redo;
- text objects and text-to-path conversion;
- node editing;
- union, subtract, intersect, split, join, close, and offset;
- SVG import/export;
- DXF export and limited import as defined by milestone;
- raster tracing;
- cutability warnings and repair proposals;
- borders, bridges, mounting holes, backing plates, and common sign templates;
- offline editing;
- Windows installer and update strategy for beta.

## Quality requirements

- exported physical dimensions must remain within documented tolerance;
- no silent geometry loss;
- large operations must remain cancellable and must not freeze the UI indefinitely;
- project files must be versioned and migratable;
- critical workflows must have automated end-to-end coverage;
- renderer security must follow Electron isolation practices;
- user content must remain local unless explicitly sent to an AI provider;
- AI provider credentials must use operating-system secure storage and remain
  replaceable independently from generation behavior;
- ordinary editing, tracing, analysis, and export must not depend on AI access.

## Version 1 non-goals

- native DWG editing;
- 3D CAD;
- G-code or machine control;
- automatic lead-ins, pierce order, THC, or consumable settings;
- production nesting;
- parametric sketch constraints;
- cloud collaboration;
- mobile editor;
- a marketplace of copyrighted logos or commercial fonts.

## Future expansion requirement

Machine control is a version 1 non-goal, not a permanent product prohibition.
LaserX must preserve a post-version-1 path for owner-built CNC control hardware
and broader manufacturing modules without rewriting the editor.

Core project, geometry, text, tracing, AI, cutability, and sign-tool behavior
must remain independent from controller boards, firmware, machine transports,
and process-specific execution. Future hardware support must enter through
capability-based machine and controller adapters, with privileged device access,
deterministic job preparation, simulation/review, explicit operator approval,
and separately gated safety requirements.

The post-Version-1 roadmap implements that expansion only through M15 and M16.
M15 is simulator-first foundation work and cannot energize live motion or process
outputs. M16 is limited to one explicitly approved controller, machine, process,
and hardware-specific safety model after the owner authorizes live hardware work.
The presence of those milestones does not authorize early machine-control code.

The future extension model must allow a custom LaserX control board and other
machine modules to expand the software beyond sign-file creation and beyond one
cutting process. AI and the renderer may never command motion or process output
directly. ADR 0018 governs this boundary.

## Success criteria

A beta user can create or import a representative sign, edit it, receive useful manufacturing warnings, export the front and backing geometry, and open the DXF in downstream CAM at the intended size without repairing basic scale or contour errors.
