# M20 — Licensing, Trial, and Purchase Experience

## User-visible outcome

A user can install LaserX, use the full product on real projects for an owner-approved trial period, understand the affordable purchase terms, and activate a personal license without feature-hostage tactics or confusing subscription assumptions.

## Activation gate

M20 remains blocked until M19 is complete and the owner makes the final licensing, trial-length, introductory-price, standard-price, offline-grace, device-policy, and support-scope decisions.

Issue #76 is a planning input. It does not lock a price or activate M20 early.

## Product philosophy

- premium product, generous price;
- current direction: introductory/founder pricing near $19.99 and standard personal pricing around $25–$30; these remain hypotheses until tested with representative users;
- approximately two-week full-product trial;
- no credit card merely to evaluate;
- no watermark ruining exports;
- no project limit that prevents real evaluation;
- no premium gate blocking 3D preview;
- no hidden conventional SaaS model unless the owner explicitly changes direction;
- optional AI remains user-supplied and is not bundled into the license price;
- “send us your ugly files” means structured bug and fixture intake that improves LaserX, not an unlimited promise of custom file repair or individual design work;
- purchase copy must describe support limits honestly.

## Included

- documented license model and ADR;
- full-product trial state and clear remaining-time/status UI;
- owner-approved purchase and activation flow;
- local/offline behavior, clock-tamper policy, device transfer, reset, and support recovery;
- privacy-minimal license validation;
- secure local storage and typed main/preload boundary;
- explicit error, expired, offline, revoked, and recovery states;
- test-only deterministic licensing service and no production secrets in the repository;
- installer and uninstall interaction with license state;
- accessible plain-language terms and privacy information;
- a documented support model covering bug/fixture intake, response expectations, escalation, privacy handling, self-service guidance, and any custom-help boundary;
- representative-user validation of price comprehension, perceived value, and support expectations before final purchase copy is approved.

## Acceptance tests

1. A new user can run the complete product during the approved trial without feature locks or export watermarking.
2. No payment card is required merely to start the trial.
3. Trial expiration is clear and never destroys projects or exports.
4. License activation and recovery never expose secrets to renderer state or logs.
5. Offline behavior matches the owner-approved policy and fails visibly rather than corrupting state.
6. Reinstall, upgrade, device transfer, and uninstall behavior are documented and tested.
7. Optional AI access remains separate from LaserX licensing and billing.
8. Purchase copy does not imply a subscription or tier structure the owner has not approved.
9. The system remains testable without contacting a real payment or licensing service in CI.
10. Support copy clearly distinguishes bug/fixture intake from custom file repair and design services.
11. Representative users understand the price, trial, update entitlement, device policy, and support boundary before purchase terms are locked.
12. No support or pricing promise exceeds the approved business model’s capacity.

## Exit checklist

- [ ] Owner final licensing, pricing, update-entitlement, and support-scope decisions are recorded.
- [ ] License/trial ADR and privacy review are accepted.
- [ ] Full-product trial, activation, expiration, recovery, and offline tests pass.
- [ ] Packaged Windows and installer lifecycle evidence pass.
- [ ] Terms, pricing presentation, ugly-file intake, privacy handling, and support boundaries are validated and approved.
- [ ] Status advances to M21 only after audit, merge, issue closure, and owner approval.

## Explicitly excluded

No automatic subscription, AI-credit resale, unlimited custom file repair bundled into the personal license, complex enterprise licensing, marketplace, cloud project storage, invasive telemetry, or DRM that risks user projects belongs in M20.
