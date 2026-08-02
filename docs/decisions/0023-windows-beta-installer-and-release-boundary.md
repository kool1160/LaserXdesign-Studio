# ADR 0023: Windows Beta Installer and Release Boundary

## Status

Accepted.

## Decision

LaserX Design Studio beta releases use an x64 assisted NSIS installer produced
by the pinned electron-builder toolchain. The stable application identity is
`studio.laserx.desktop`; changing it requires a new ADR because it would break
upgrade and uninstall continuity.

The installer defaults to a per-user installation, creates a Start Menu
shortcut, and presents an application-owned option for a desktop shortcut.
The desktop shortcut is off by default and its prior state is retained during
upgrade. The first beta does not provide automatic updates.

Uninstall always removes installed application files and shortcuts. It
preserves projects and `%APPDATA%\LaserX Design Studio` by default. The
assisted uninstaller separately offers an unchecked option to remove settings,
encrypted credentials, recovery snapshots, local crash dumps, logs, and
caches. User-chosen `.laserx`, SVG, DXF, raster, and production-package files
outside that directory are never removed by the uninstaller.

Electron main assigns session data, logs, and local crash dumps to named
subdirectories of `app.getPath("userData")`. Credentials, recent-project
metadata, and recovery already use that same per-user root. A renderer-process
failure stops active work, writes the latest recoverable snapshot after any
older autosave settles, and relaunches. A main-process fatal exit attempts the
same bounded snapshot without rewriting the last explicit project save.
Crash and diagnostic files remain local; M13 ships no telemetry or crash-upload
client.

Production packaging sets `forceCodeSigning` and receives an exportable Windows
code-signing certificate only through `WIN_CSC_LINK` and
`WIN_CSC_KEY_PASSWORD`. Certificates and passwords are never stored in the
repository or release artifact and are scoped only to the signing build steps.
Production validation requires both a trusted signature and the exact reviewed
certificate thumbprint. Pull-request CI uses a disposable, explicitly CI-only
self-signed certificate on its temporary runner. It verifies the exact embedded
signer thumbprint and rejects unsigned or hash-mismatched artifacts without
adding the test identity to a root trust store. That identity is not a
distribution identity.

Every release build records the exact source commit, semantic beta version,
x64 platform, byte sizes, SHA-256 hashes, Authenticode subjects, thumbprints,
expected and observed signer identities, and certificate expiration in a
versioned provenance manifest. Publication is a manual, review-gated workflow
against an existing version tag. The workflow fails rather than publishing an
unsigned artifact or one signed by a different valid certificate.

## Rationale

NSIS is already supplied by the pinned packaging toolchain and supports a
normal Windows install/uninstall lifecycle without adding another desktop
runtime. Per-user installation avoids requiring administrator access for the
normal beta path. Stable identity and explicit data-retention choices make
upgrade and uninstall predictable while protecting user projects and recovery
data.

Separating disposable CI signing from production signing proves the complete
technical path without confusing a self-signed test certificate with a public
publisher identity. Manual tagged publication preserves the exact-head review
and owner-advancement gate.

## Alternatives

- A portable executable was rejected because it provides no Start Menu,
  upgrade, or uninstall contract.
- MSI and AppX were deferred because NSIS covers the first beta distribution
  and does not require a Store or enterprise deployment decision.
- One-click install was rejected because it cannot present the required
  shortcut and user-data choices clearly.
- Deleting application data by default was rejected because it can destroy
  recovery state and encrypted credentials without explicit consent.
- Automatic update was deferred because the milestone makes it optional and no
  update service or rollback policy has been accepted.
- Unsigned fallback in production was rejected because it can silently publish
  an artifact with an unknown publisher.

## Consequences

The controlled beta supports Windows 10/11 x64. ARM64-native and 32-bit
installers are not beta artifacts. Production release execution remains
blocked until the repository has the two Windows signing secrets and the owner
authorizes publication of an exact reviewed tag. Signed artifacts are not
expected to be byte-identical because Authenticode uses trusted timestamps;
the deterministic source/lockfile process plus manifest hashes provides the
rebuild and provenance record.
