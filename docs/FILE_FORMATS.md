# File Formats

## Native project

Planned extension: `.laserx`.

The format must be versioned, deterministic, migratable, and capable of preserving editable objects. A packaged JSON-based structure is preferred initially unless fixture size or embedded assets require a container format.

Required data:

- schema version;
- project metadata;
- canonical millimeter document dimensions;
- layers and object order;
- stable IDs;
- text content and font references;
- path geometry and transforms;
- process/cutability settings;
- optional linked or embedded raster references;
- optional AI provenance selected by the user;
- migration history.

## SVG

SVG is the editable interchange format. Import/export must explicitly handle width, height, viewBox, unit suffixes, transforms, path closure, fill rules, groups, and unsupported elements.

Scripts, event handlers, and unsafe external references are ignored or rejected.

## DXF

Version 1 targets documented 2D entities required by downstream plasma/laser CAM. Entity support must be fixture-driven. Physical scale and units must be explicit.

Native DWG is out of scope. Do not rename a DXF file to `.dwg` or claim equivalence.

## PNG/JPEG

Raster files are tracing or reference inputs. Original pixels may be embedded or linked in the native project but never exported as cut paths.
