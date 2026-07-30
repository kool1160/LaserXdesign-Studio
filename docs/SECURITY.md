# Security

## Desktop boundaries

- context isolation enabled;
- renderer sandboxing evaluated and enabled where compatible;
- no unrestricted Node integration in renderer;
- typed allowlisted IPC methods;
- strict validation of IPC arguments and results;
- no arbitrary command execution from project data.

## Untrusted files

SVG, DXF, raster, and `.laserx` project files are untrusted input. Apply size limits, parser limits, cancellation, and safe failure. Ignore executable SVG content and unsafe external references.

## Secrets

API keys live in platform-appropriate secure storage or user environment configuration. Never commit, echo, or send them to the renderer unnecessarily.

## Reporting

Do not publish active exploit details in a public issue. Record a private remediation path when repository tooling supports it.
