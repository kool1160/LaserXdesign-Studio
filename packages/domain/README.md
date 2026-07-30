# @laserx/domain

Serializable project/document entities, object IDs, layers, transforms, units, process settings, invariants, command contracts, and migration-neutral types. No UI, Electron, Node-only, or file-format dependencies.

M02 implements canonical millimeter dimensions, a Cartesian stock/document,
display and viewport preferences, stable IDs, minimal line/rectangle/ellipse/
path objects, bounds, conversion helpers, immutable updates, and a hit-test
interface. It does not implement selection, transforms, layers, or production
geometry editing.
