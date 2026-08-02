# Windows Beta Release

## Supported beta target

- Windows 10 or Windows 11, x64;
- per-user installation is the default and requires no administrator access;
- application identity: `studio.laserx.desktop`;
- product/version: `LaserX Design Studio 0.13.0-beta.1`;
- auto-update: deferred; install a reviewed newer beta over the existing beta.

## Current distribution status

LaserX is currently in **owner-only private testing** on personally controlled
computers. It is not a trusted public beta and is not authorized for sale or
public distribution.

For this private phase, an unsigned installer or the disposable CI-self-signed
installer is acceptable. Windows may display SmartScreen, `Unknown Publisher`,
or certificate-trust warnings. Those warnings are expected and accepted only
for the owner's controlled private testing.

Trusted public code signing, public tagging, and public prerelease publication
are deferred until the owner decides to sell or distribute LaserX outside the
private test group.

## Installer behavior

`LaserX-Design-Studio-Setup-0.13.0-beta.1-x64.exe` is an assisted NSIS
installer. It always creates a Start Menu shortcut. The options page offers an
unchecked **Create a desktop shortcut** choice. Upgrade keeps an existing
desktop shortcut but does not recreate one the user removed.

The uninstaller removes installed binaries and shortcuts. It preserves
application data by default and exposes a separate unchecked choice to remove
settings, encrypted credentials, recovery, local crash dumps, logs, and caches.
It never removes user project, import, export, or production-package files
outside the application-data directory.

## Windows-owned data locations

The runtime root is `%APPDATA%\LaserX Design Studio`:

| Data | Location below the root |
| --- | --- |
| recent projects | `recent-projects.json` |
| autosave/recovery | `recovery\active.laserx.autosave` |
| encrypted OpenAI credential envelope | `credentials\ai-provider.json` |
| application logs | `logs\main.log` |
| renderer session/cache data | `session\` |
| local crash dumps | `crash-dumps\` |

Explicit `.laserx` projects and exported files remain at paths chosen by the
user. No runtime data belongs in the installation directory or repository.

## Recovery and diagnostics

Autosave never overwrites an explicit project save. A renderer failure first
settles any older autosave, records the latest dirty project snapshot, and then
restarts LaserX. A fatal main-process exit makes the same bounded recovery
attempt before exiting. On the next launch, the normal recovery banner offers
recover or discard.

Crash dumps and logs remain local. This beta has no telemetry, analytics,
remote crash upload, or automatic diagnostic submission. A user who chooses to
share a diagnostic must review it first and must never send an API key or a
private customer project unintentionally.

## Performance safeguards

The release gate uses these gross safeguards on the documented Windows CI
reference runner:

- clean-installed cold launch to visible workspace: under 15 seconds;
- representative raster trace: under 5 seconds;
- representative boolean/offset geometry cases: under 5 seconds;
- 400-contour cutability analysis: under 5 seconds;
- save/export and other interactive commands: bounded by the existing
  10-second packaged command deadline;
- heavy tracing, geometry, and analysis operations remain cancellable and keep
  the renderer responsive.

The packaged suite repeats the 1366 × 768, 1920 × 1080, 150% scale, keyboard
focus, non-color status, reduced-motion, and renderer-isolation checks from M11.

## Private-test artifacts

From the repository root:

```powershell
pnpm install --frozen-lockfile
pnpm verify
pnpm --filter @laserx/desktop package:installer
```

`package:installer` deliberately disables certificate auto-discovery and may
produce an unsigned installer. Under the current owner-only private-testing
decision, that installer may be used on the owner's controlled computers after
reviewed-source verification.

A private-test installer must:

- come from reviewed source or recorded CI evidence;
- preserve the stable LaserX identity and version;
- retain recorded hashes and limitations;
- remain labeled private test software;
- never be represented as a trusted public release.

The current CI workflow may also produce a disposable self-signed installer to
prove signing and lifecycle mechanics. That certificate is not a public trust
identity.

## Private hands-on validation procedure

1. Obtain the current private-test installer from reviewed `main` evidence.
2. Run the installer on an owner-controlled Windows machine.
3. Accept the expected Windows trust warning.
4. Confirm Start Menu launch and optional desktop-shortcut behavior.
5. Complete a representative import, analysis, save, and DXF export workflow.
6. Confirm expected project scale and app-data location.
7. Run normal uninstall and confirm the documented data-preservation choice.
8. Record the observed result in Issue #13.

This private validation is the remaining M13 exit boundary.

## Future trusted public release

Before sale or distribution outside the owner's controlled private test group,
production signing uses:

- `WIN_CSC_LINK`: a CI-secret URL, path, or base64-encoded exportable PFX;
- `WIN_CSC_KEY_PASSWORD`: the matching CI-secret password;
- `WINDOWS_CODE_SIGNING_THUMBPRINT`: a reviewed repository variable containing
  the production certificate's complete 40-character SHA-1 thumbprint.

A separately accepted managed-signing ADR may replace the PFX mechanism later.

`package:installer:signed` turns on `forceCodeSigning`; missing or invalid
credentials fail the build. The PFX and password are exposed only to the two
electron-builder signing steps. Setup, install, validation, provenance,
artifact upload, and publication steps cannot read them. Never place the PFX or
password in the repository, workflow YAML, logs, release notes, or provenance
file. The public certificate thumbprint is recorded as the expected signer.

### Future public release procedure

1. Review and merge the exact public-release source with required checks green.
2. Configure the Windows signing secrets and reviewed signer variable.
3. Create the exact reviewed version tag through owner-authorized advancement.
4. Manually dispatch **M13 Controlled Beta Release** or its future replacement.
5. Force trusted signing, validate the exact approved signer, run the full clean
   lifecycle, and write public provenance with expected and observed signer
   identities.
6. Compare the manifest source commit to the reviewed tag and retain workflow,
   artifact, checksum, and publication evidence.
7. Publish only after every trusted-signing and distribution requirement passes.

Authenticode timestamps make signed binaries non-byte-reproducible. The pinned
toolchain, lockfile, exact source tag, commands, and recorded output hashes
provide the rebuild and provenance record.
