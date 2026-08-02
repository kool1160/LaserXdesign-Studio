# `@laserx/physical-preview-3d`

Pure deterministic adapter from a validated LaserX project snapshot to a renderer-independent physical-preview scene description.

## Boundary

Allowed dependencies:

- current LaserX domain and geometry contracts;
- project-format parsing and migrations where required by tests/tools;
- cutability and production-export contracts when they provide authoritative topology or manufacturing-layer evidence.

Forbidden dependencies:

- React;
- Electron;
- Three.js;
- browser globals;
- filesystem APIs;
- GPU APIs.

## Responsibilities

- identify explicit physical manufacturing layers;
- carry exact canonical material thickness in millimeters;
- carry material and stock-designation presentation metadata;
- preserve authoritative world transforms, dimensions, layer order, outer contours, and interior cutouts;
- derive assembled and exploded Z placement from explicit preview settings;
- return source-linked findings for unsupported or ambiguous geometry;
- produce deterministic serializable scene output and fingerprints;
- prove source-project immutability.

## Non-responsibilities

- drawing or GPU rendering;
- modifying the LaserX document;
- repairing or closing contours;
- manufacturing exports;
- cutability approval;
- project persistence;
- general solid modeling;
- CAD-kernel or mesh editing;
- CAM or machine control.

Read `../../docs/experiments/m14-physical-3d-preview/PROJECT_BRIEF.md` before implementation.
