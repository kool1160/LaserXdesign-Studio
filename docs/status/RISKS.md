# Known Risks

## Geometry-engine lock-in

Boolean and offset libraries differ in curve support, tolerance behavior, and licensing. Keep an adapter boundary and prove candidates with fixtures before committing.

## Scale errors

SVG and DXF unit handling can silently produce wrong physical dimensions. Scale fixtures and downstream CAM validation are release blockers.

## Tracing quality

Raster tracing can create excessive nodes, self-intersections, tiny islands, and unreadable details. Preprocessing and cutability analysis must be part of the same workflow.

## Electron security

File import and AI connectivity increase the risk of unsafe IPC or remote content. Keep privileged APIs narrow.

## Scope explosion

General CAD, CAM, nesting, cloud sync, and plugin systems can consume the project. Milestone gates and non-goals are mandatory.

## Font licensing

Popular commercial sign fonts cannot be redistributed without permission. Maintain provenance and license audits for every bundled font.
