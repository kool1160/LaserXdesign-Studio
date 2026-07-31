# ADR 0016: Secure SVG/DXF Interchange Boundary

## Status

Accepted.

## Decision

SVG and ASCII DXF are untrusted interchange inputs. Native dialogs and bounded
UTF-8 file I/O stay in Electron main. The sandboxed renderer sends only an
import-preview intent with an explicit unitless-DXF assumption, or an export
intent containing `svg` or `dxf`; it never supplies paths or file contents.

`packages/io-svg` uses the pinned `saxes` streaming XML parser, rejects DTDs,
entities, active content, event attributes, references, malformed XML, files
over 5 MB, more than 50,000 elements, and more than 200,000 geometry points.
Supported geometry is normalized to canonical world millimeters. Unsupported
visible elements and path geometry produce user-visible warnings instead of a
partial silent reshape.

`packages/io-dxf` parses bounded ASCII group-code/value pairs without depending
on group order. `$INSUNITS` values for inches, millimeters, and centimeters are
accepted. A missing or zero `$INSUNITS` requires the user to choose whether one
drawing unit is one millimeter or one inch, and the recorded preview states
that assumption. Nonzero Z/elevation, 3D/polyface data, and unsupported entity
types are skipped with warnings.

Both adapters exchange normalized open/closed paths with layer names. Import
preview materializes fresh object/layer IDs but does not mutate the project,
dirty state, or history. Commit verifies the project fingerprint and applies
all new layers and paths through one `objects.import` command, so one undo
restores the exact pre-import document. Export reads visible world geometry,
flattens curves at 0.01 mm, and reports path count, warnings, millimeter units,
and bounds without changing project history.

## Rationale

A small normalized boundary keeps format quirks out of the document schema and
keeps privileged file access out of React. An explicit preview makes scale,
warnings, assumptions, layer mapping, and geometry visible before authoritative
state changes. One application command gives import the same undo and stale-
state guarantees as other edits.

## Alternatives

- Renderer-side XML/DXF parsing was rejected because it would widen IPC and
  filesystem authority and make untrusted data part of presentation state.
- Silent projection of unsupported or 3D entities was rejected because a
  visually plausible result can be dimensionally or topologically wrong.
- Persisting adapter records in `.laserx` was rejected because normalized paths
  already preserve the editable result without coupling the schema to external
  syntax.
- Native DWG, CAM interpretation, and unproven spline conversion remain out of
  scope.

## Consequences

SVG path arcs must be converted to circle/ellipse elements or cubic curves
before import. DXF curves and all exported document curves are flattened at a
documented 0.01 mm chordal tolerance. Hidden-layer objects are not exported and
produce a summary warning. The independent `dxf-parser` test dependency
inspects representative exports without participating in production parsing.
