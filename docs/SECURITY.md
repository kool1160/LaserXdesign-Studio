# Security

## Desktop boundaries

- context isolation and renderer sandboxing enabled;
- Node integration disabled in the renderer;
- normal renderer navigation and renderer-requested windows denied;
- local packaged content only, with the Vite loopback URL allowlisted only in development;
- one frozen typed normal-renderer preload API with fixed allowlisted IPC
  methods; the main-created credential modal uses a separate minimal preload
  that can only submit or cancel its own password field;
- strict Zod validation of IPC arguments and results on both sides;
- arbitrary renderer-provided save paths rejected;
- no arbitrary command execution from project data.

Packaged Playwright smoke tests assert that `process` and `require` are absent
from the page world and that preload reports an isolated, sandboxed context.

## Untrusted files

SVG, DXF, raster, and `.laserx` project files are untrusted input. Apply size limits, parser limits, cancellation, and safe failure. Ignore executable SVG content and unsafe external references.

## Secrets

AI API keys are acquired in a main-created, parent-bound modal credential
window and used only by Electron main. Its isolated renderer has no normal
LaserX preload/state, Node, navigation, network, DevTools, project, or file
access; the key exists only in its password field and one sender-validated
submit message before the window is destroyed. The visible window is
cancelable, has a two-minute hard timeout, and is destroyed before prior
connection state and controls are restored. On Windows, Electron `safeStorage`
encrypts the key before an envelope is written under application user data.
Keys never belong in project files, normal renderer/preload state, normal
application IPC arguments, logs, crash reports, fixtures, source control, or
provider request bodies. Connection tests and generation read the vault at
call time; replace overwrites the encrypted envelope only after validation and
disconnect deletes it.

Reference images require explicit consent, strict byte/pixel limits, trusted-
host decoding, and a second consent check at generation. Prompts and references
are sent only on Generate. Mocked CI uses no real provider credential or
network request.

## Reporting

Do not publish active exploit details in a public issue. Record a private remediation path when repository tooling supports it.

## Beta packaging and diagnostics

The production Windows build fails closed unless electron-builder can sign the
application and NSIS installer with credentials injected through
`WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`. The certificate and password are CI
secrets and may not be committed, uploaded as evidence, printed, or copied into
release provenance. Pull-request signing uses a disposable self-signed identity
created, trusted, and removed on the isolated runner; it is never a release
publisher.

Renderer session data, logs, crash dumps, recovery, recents, and encrypted
credential envelopes stay under Electron's per-user application-data root.
Crash records are local only: the beta has no telemetry, analytics, crash
upload, or remote diagnostics client. Emergency recovery logs only bounded
event names and never prompt text, file contents, geometry, credentials, or
provider request bodies.
