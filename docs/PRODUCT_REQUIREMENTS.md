# Product Requirements

## Product name

LaserX Design Studio

## Product definition

LaserX Design Studio is an affordable, premium-feeling, machine-independent idea-to-manufacturable-product platform for flat-cut signs and layered products.

It compresses the work between having an idea and opening a usable file in the software that operates the user's machine.

Product statement:

> Spend your time making the sign, not preparing to make the sign.

Product distinction:

> LaserX creates the product. Your downstream software manufactures it.

## Problem

The machine may cut a sign in minutes, while deciding what to make, building the design, fixing islands and contours, creating layers, choosing materials, previewing the assembly, and preparing exact files can consume the entire evening.

General CAD programs are powerful but slow and intimidating for artistic sign work. General graphics tools are useful companions but do not own manufacturing validation, physical layers, exact stock truth, or assembled preview.

LaserX joins those steps in one focused product without attempting to replace Inkscape, LightBurn, plasma CAM/controller software, fiber-laser software, router CAM, waterjet software, or general CAD.

## Primary users

- plasma-table owners;
- CO2, diode, and fiber-laser users;
- CNC router and waterjet users;
- sign makers and fabrication shops;
- woodworking and acrylic-product makers;
- Etsy and home-decor makers;
- makerspaces, schools, hobbyists, and garage fabricators;
- designers converting customer artwork into manufacturable geometry.

## Primary jobs to be done

1. Open LaserX and understand the next action.
2. Create a sign from deterministic text, shapes, borders, backing plates, holes, and templates without AI.
3. Import SVG/DXF or trace raster artwork into editable vectors.
4. Optionally request AI ideas or concept assistance through user-supplied provider access.
5. Repair geometry so islands, open contours, overlaps, and fragile features are visible and addressable.
6. Assign physical layers, truthful material identity, and exact thickness.
7. Inspect the finished product as an interactive physical 3D object.
8. Export exact SVG, DXF, and approved production packages for downstream software.

## Primary usability requirement

The biggest remaining product requirement is first-time usability.

A clean first launch must offer clear real-project paths:

- **Create My First Sign**
- **Import My Own Design**
- **Describe What I Want With AI — Optional**

Guidance should point to the correct control, explain what and why in plain shop language, dim unrelated areas, confirm completion, explain warnings, preserve orientation, and lead through 3D preview and export.

The measurable goal is:

> A first-time user can create or import a design, understand major manufacturing warnings, view it in 3D, and export a usable file within ten minutes.

## Required workflows

### Deterministic sign creation

Create text, choose a licensed or installed font, set dimensions, add borders/backing/holes, choose material and thickness, validate, preview in 3D, and export—without an AI account, API key, internet connection, or provider credits.

### Image trace

Import PNG/JPEG, adjust preprocessing, trace to editable vectors, simplify, edit, validate, assign physical information, preview, and export.

### Existing vector

Import SVG/DXF, preserve known scale, surface unsupported or repaired entities visibly, edit paths, validate, assign layers/materials, preview, and export.

### Optional AI concept

Connect user-owned supported provider access, request concepts or reference-image interpretation, compare choices, accept one into ordinary editable geometry, validate it, and continue through the same physical and export workflow. AI is optional and user-billed directly by the provider.

### Layered product

Separate face, backing, spacer, registration, and other explicit physical layers; preserve each material and exact thickness; inspect assembled and exploded views; export organized deterministic files and manifest evidence.

### Inkscape companion

Create manufacturing structure in LaserX, export SVG for artistic editing in Inkscape, then reimport and validate it. Likewise, import Inkscape artwork into LaserX for physical/manufacturing preparation.

### Downstream software handoff

Prepare exact reviewed SVG/DXF/packages for LightBurn, plasma CAM, router CAM, waterjet, supported fiber workflows, and generic consumers without generating machine settings or motion.

## Core functional requirements

- project create/open/save/save-as/recovery;
- exact document size and unit switching;
- selection, move, rotate, scale, mirror, duplicate, group, align;
- layers and z-order;
- undo/redo;
- text and text-to-path conversion;
- node editing and deterministic geometry operations;
- SVG/DXF interoperability;
- raster tracing;
- cutability warnings and repair proposals;
- deterministic sign tools and templates;
- physical manufacturing layers and production packages;
- truthful material and exact thickness;
- interactive non-mutating physical 3D preview;
- guided onboarding and Learn Mode;
- optional user-supplied AI assistance;
- downstream export profiles;
- Windows installation, trial, purchase, upgrade, recovery, and uninstall;
- offline normal editing.

## AI boundary

LaserX generates signs without AI.

At launch:

- the user supplies supported provider access;
- the user pays the provider directly;
- LaserX does not embed a shared provider key;
- LaserX does not resell AI credits;
- credentials remain protected through the accepted operating-system boundary;
- accepted AI output becomes ordinary editable geometry;
- AI cannot bypass normalization, cutability, or manufacturing truth;
- all normal sign workflows remain usable without AI.

## Physical 3D boundary

The preview is derived from authoritative 2D manufacturing geometry, explicit physical layers, material identity, and exact canonical thickness.

It supports truthful holes/cutouts, layer order, assembled/exploded views, front/back/edge/perspective, orbit/pan/zoom/reset, visibility controls, dimensions, safe failure, and customer-preview capture.

The preview is not a 3D CAD kernel. It cannot mutate geometry, dirty state, Undo/Redo, analysis, save, SVG/DXF, or production packages.

## Quality requirements

- exported dimensions remain within documented tolerance;
- no silent geometry loss or invented physical geometry;
- large operations are cancellable and bounded;
- project formats are versioned and migratable;
- critical workflows have automated packaged coverage;
- renderer security follows Electron isolation;
- user content stays local unless explicitly sent to an AI provider or explicitly shared for support;
- ordinary editing, preview, analysis, and export do not depend on AI access;
- 3D/WebGL failure does not block normal editing or saving;
- first-time workflow is measured with real users rather than assumed;
- the product feels polished and understandable despite advanced internals.

## Pricing and trial direction

The owner direction is a premium product at a generous price, approximately:

- introductory/founder pricing near $19.99;
- standard personal pricing around $25–$30;
- no default monthly $10 subscription assumption;
- no confusing stack of expensive tiers;
- approximately two weeks of full-product trial;
- no credit card merely to evaluate;
- no watermark ruining exports;
- no fake project limit or 3D paywall during trial.

Exact licensing mechanics remain owner-controlled and are implemented only through M20.

## Version 1 non-goals

- native DWG editing;
- general-purpose 3D CAD or mesh editing;
- STL/STEP/IGES/3MF manufacturing-solid export;
- G-code or machine control;
- automatic lead-ins, pierce order, THC, speed, power, or consumable settings;
- production nesting;
- parametric sketch constraints;
- cloud collaboration;
- mobile editor;
- marketplace of copyrighted logos or commercial fonts.

## Post-Version-1 machine path

Machine control is a Version 1 non-goal, not a permanent prohibition.

After Version 1, M24 may add a simulator-first privileged machine-platform foundation. M25 may validate one explicitly approved controller, machine, process, and hardware-specific safety model.

Core projects, geometry, text, tracing, AI, cutability, sign tools, materials, preview, and exports remain independent from controller hardware. AI and renderer code may never command motion or process output directly. ADR 0018 governs this boundary.

## Success criteria

A user can open LaserX, understand the next action, create or import a representative sign, edit it, receive useful manufacturing guidance, inspect the physical assembly in 3D, export exact files, and open them in downstream software at intended scale.

A real first-time user can complete that primary workflow within ten minutes on the documented validation fixture set.
