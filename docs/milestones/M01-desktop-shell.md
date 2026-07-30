# M01 — Desktop Shell and Project Lifecycle

## User-visible outcome

A Windows desktop application launches reliably and can create, save, reopen, and recover a minimal editable project container.

## Included

- exact Node/pnpm/Electron/React/Vite versions and lockfile;
- secure Electron main, preload, and renderer boundaries;
- application window, menus, command routing, and empty workspace;
- new/open/save/save-as/recent-project commands;
- native `.laserx` schema version 1 with an empty document;
- dirty-state indicator and close confirmation;
- autosave/recovery skeleton;
- typed IPC with validation;
- basic logging and error boundary;
- Windows development build;
- lint, typecheck, unit-test, build, and smoke-test CI.

## Architecture work

- choose and record renderer state approach;
- define application-command interface;
- define file-service boundary;
- define initial project serializer and migration registry;
- define typed preload API.

## Explicitly excluded

Canvas geometry, text, tracing, DXF, cutability, AI generation, and production auto-update behavior.

## Acceptance tests

1. App launches in development and packaged smoke mode.
2. Renderer has no unrestricted Node access.
3. Create a blank project, save it, close it, reopen it, and preserve project identity and settings.
4. Unsaved changes trigger a close warning.
5. A simulated interrupted session offers a recovery file without overwriting the original.
6. Corrupt or future-version project files fail safely with a useful message.
7. Root `pnpm verify` succeeds in CI.

## Exit checklist

- [ ] Dependency and security ADRs accepted.
- [ ] Project schema fixture committed.
- [ ] Lifecycle end-to-end test passes.
- [ ] Windows smoke package produced in CI or documented equivalent.
- [ ] M01 known limitations documented.
- [ ] Status advances to M02.
