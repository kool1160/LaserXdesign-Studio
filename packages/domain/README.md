# @laserx/domain

Serializable project/document entities, object IDs, layers, transforms, units, process settings, invariants, command contracts, and migration-neutral types. No UI, Electron, Node-only, or file-format dependencies.

M03 implements canonical millimeter documents, ordered layers and guides,
stable IDs, minimal line/rectangle/ellipse/path/group objects, affine
transforms, bounds, hit testing, snapping, and pure editing commands. It has no
React, Electron, Node, clipboard, or history dependency. Production text,
curves, node editing, booleans, offsets, and manufacturing geometry remain
deferred.
