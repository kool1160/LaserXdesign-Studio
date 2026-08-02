# Windows Beta Release

## Supported beta target

- Windows 10 or Windows 11, x64;
- per-user installation is the default and requires no administrator access;
- application identity: `studio.laserx.desktop`;
- product/version: `LaserX Design Studio 0.13.0-beta.1`;
- auto-update: deferred; install a reviewed newer beta over the existing beta.

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

The production root is `%APPDATA%\LaserX Design Studio`:

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

## Performance budgets

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

## Local development artifacts

From the repository root:

```powershell
pnpm install --frozen-lockfile
pnpm verify
pnpm --filter @laserx/desktop package:installer
```

`package:installer` deliberately disables certificate auto-discovery and may
produce an unsigned local artifact. It is for layout/build inspection only and
cannot be published. Production signing uses:

- `WIN_CSC_LINK`: a CI-secret URL, path, or base64-encoded exportable PFX;
- `WIN_CSC_KEY_PASSWORD`: the matching CI-secret password.
- `WINDOWS_CODE_SIGNING_THUMBPRINT`: a reviewed repository variable containing
  the production certificate's complete 40-character SHA-1 thumbprint.

Then `package:installer:signed` turns on `forceCodeSigning`; missing or invalid
credentials fail the build. The PFX and password are exposed only to the two
electron-builder signing steps. Setup, install, validation, provenance,
artifact upload, and publication steps cannot read them. Never place the PFX or
password in the repository, workflow YAML, logs, release notes, or provenance
file. The public certificate thumbprint is recorded as the expected signer.

## Exact release procedure

1. Merge only an exact-head reviewed M13 implementation with required checks
   green.
2. Set both Windows signing secrets and the reviewed
   `WINDOWS_CODE_SIGNING_THUMBPRINT` repository variable in GitHub Actions.
3. Create the exact reviewed `v0.13.0-beta.1` tag only through owner-authorized
   advancement.
4. Manually dispatch **M13 Controlled Beta Release** for that tag.
5. The workflow installs locked dependencies, runs `pnpm verify`, forces
   signing, validates both installer and packaged executable signatures, runs
   clean install/upgrade/Start Menu/desktop option/uninstall tests, rejects a
   valid signature from any certificate other than the reviewed signer, and
   writes `laserx-release-provenance.json` with expected and observed signer
   identities.
6. Compare the manifest source commit to the reviewed tag, retain the workflow
   run and artifact digest, and only then publish the prerelease assets.

Authenticode timestamps make signed binaries non-byte-reproducible. The pinned
toolchain, lockfile, exact source tag, commands above, and recorded output
hashes are the reproducible-build evidence.
