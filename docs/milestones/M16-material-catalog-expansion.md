# M16 — Material Catalog and Wood/Acrylic Expansion

## User-visible outcome

LaserX truthfully distinguishes common wood-based sheet goods and acrylic constructions, preserves nominal versus measured thickness, carries that information through projects and exports, and presents material-aware physical previews without pretending every layer is steel.

## Activation gate

M16 remains blocked until M15 is complete and the owner explicitly activates material expansion.

Issue #39, draft PR #40, and accepted Issue #42 research are inputs, not merge authority.

## Included

- production promotion of an immutable material catalog after exact-head repair and review;
- MDF, Baltic birch plywood, hardwood plywood, hardboard/Masonite, and reviewed additional wood categories;
- cast clear, opaque, translucent, mirrored, frosted, and reviewed extruded acrylic categories;
- stable material IDs, human labels, family/subtype, finish/optical descriptors, and plain shop notes;
- exact canonical millimeters with preserved nominal labels and explicit measured-thickness override semantics;
- process compatibility and caution metadata without machine settings;
- schema migration and project-format persistence only after ADR review;
- UI selection, save/reopen, production-manifest, and material-aware 3D integration;
- neutral visible fallback for unknown or unsupported material identity;
- license/provenance review for any bundled appearance assets; remote texture downloads are prohibited.

## Acceptance tests

1. Every catalog entry and stock choice has a stable unique ID and deterministic order.
2. Fractional and nominal conversions normalize exactly to canonical millimeters.
3. User-measured thickness always overrides nominal thickness without losing the nominal label.
4. Legacy projects migrate without inventing a material subtype or nominal designation.
5. Save/reopen and production export preserve material identity, subtype, nominal label, measured value, and exact thickness.
6. 3D preview distinguishes approved wood/acrylic appearances without inventing species, finish, or optical behavior.
7. Unknown materials use a neutral fallback plus a visible finding.
8. Mixed-material assemblies preserve exact layer order and thickness.
9. Normal metal workflows remain unchanged and accurate.

## Exit checklist

- [ ] PR #40 foundation is independently repaired/reviewed before promotion.
- [ ] Catalog, schema, migration, UI, export, and preview contracts are accepted.
- [ ] Exact-head tests and packaged Windows evidence pass.
- [ ] Owner validates representative wood, acrylic, and mixed-material projects.
- [ ] Status advances to M17 only after merge, issue closure, and owner approval.

## Explicitly excluded

No universal materials database, photorealistic promise, remote textures, machine settings, kerf database presented as authoritative, CAM, toolpaths, or machine control belongs in M16.
