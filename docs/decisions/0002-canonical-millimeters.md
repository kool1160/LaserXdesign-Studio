# ADR 0002: Canonical Millimeter Units

## Status

Accepted.

## Decision

Persist and process physical lengths in millimeters. Convert inches only at UI and file-format boundaries.

## Rationale

A single canonical unit prevents ambiguous internal values and avoids repeated inch/mm drift.

## Consequences

APIs use explicit unit naming or typed wrappers. Import/export adapters own unit conversion and scale tests.
