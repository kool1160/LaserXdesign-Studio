# ADR 0006: Secure Electron Boundary and Typed IPC

## Status

Accepted.

## Decision

The Electron main process owns windows, menus, dialogs, file paths, filesystem
access, recent projects, logging, autosave, and recovery. The renderer runs
with `nodeIntegration: false`, `contextIsolation: true`, and `sandbox: true`.
New windows and renderer navigation are denied.

Preload exposes one frozen `window.laserx` API. Every request and response is
typed and runtime-validated with strict Zod schemas. IPC uses fixed,
allowlisted channels. The renderer cannot select an arbitrary save path:
native dialogs choose open/save targets, and `openRecent` accepts only a path
already present in the main-process recent list.

## Rationale

Project files and renderer state are untrusted. A narrow capability API keeps
Node, Electron, filesystem, and dialog privileges out of the renderer while
still supporting the complete M01 lifecycle. Runtime validation protects the
boundary even when compile-time types are absent or bypassed.

## Alternatives

- Enabling Node integration was rejected.
- Exposing `ipcRenderer`, `fs`, or a generic invoke method was rejected.
- Passing arbitrary renderer-provided save paths was rejected.
- Loading remote renderer content was rejected.

## Consequences

New desktop capabilities require an explicit channel, request/result schema,
preload method, main handler, and boundary test. Imported content must never be
executed. Development loads only the allowlisted local Vite address; packaged
builds load local files under the renderer content security policy.
