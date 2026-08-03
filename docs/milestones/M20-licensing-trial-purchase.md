# M20 — Licensing, Trial, and Purchase Experience

## User-visible outcome

A user can install LaserX, use the full product on real projects for an owner-approved trial period, understand the affordable purchase terms, and activate a personal license without feature-hostage tactics or confusing subscription assumptions.

## Activation gate

M20 remains blocked until M19 is complete and the owner makes the final licensing, trial-length, introductory-price, standard-price, offline-grace, and device-policy decisions.

## Product philosophy

- premium product, generous price;
- current direction: introductory/founder pricing near $19.99 and standard personal pricing around $25–$30;
- approximately two-week full-product trial;
- no credit card merely to evaluate;
- no watermark ruining exports;
- no project limit that prevents real evaluation;
- no premium gate blocking 3D preview;
- no hidden conventional SaaS model unless the owner explicitly changes direction;
- optional AI remains user-supplied and is not bundled into the license price.

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
- accessible plain-language terms and privacy information.

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

## Exit checklist

- [ ] Owner final licensing decisions are recorded.
- [ ] License/trial ADR and privacy review are accepted.
- [ ] Full-product trial, activation, expiration, recovery, and offline tests pass.
- [ ] Packaged Windows and installer lifecycle evidence pass.
- [ ] Terms, pricing presentation, and support process are approved.
- [ ] Status advances to M21 only after audit, merge, issue closure, and owner approval.

## Explicitly excluded

No automatic subscription, AI-credit resale, complex enterprise licensing, marketplace, cloud project storage, invasive telemetry, or DRM that risks user projects belongs in M20.
