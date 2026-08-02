# ADR 0023: Windows Beta Installer and Release Boundary

## Status

Accepted, amended by owner directive on 2026-08-02.

## Decision

LaserX Design Studio beta installers use an x64 assisted NSIS installer produced
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
metadata, and recovery use that same per-user root. A renderer-process failure
stops active work, writes the latest recoverable snapshot after any older
autosave settles, and relaunches. A main-process fatal exit attempts the same
bounded snapshot without rewriting the last explicit project save. Crash and
diagnostic files remain local; M13 ships no telemetry or crash-upload client.

## Private-testing boundary

The owner is currently testing LaserX only on personally controlled computers.
For this private, noncommercial use, M13 may use an unsigned installer or the
CI-generated disposable self-signed installer. Windows SmartScreen,
`Unknown Publisher`, or certificate-trust warnings are expected and explicitly
accepted for this private testing boundary.

A private-test artifact must still preserve the reviewed application identity,
version, hashes, exact source evidence, install/upgrade/uninstall behavior,
user-data behavior, and automated verification. It must be labeled clearly as
private test software and must not be represented as a trusted public release.

No code-signing certificate purchase, `.pfx` export, GitHub production signing
secret, trusted signer thumbprint, or public prerelease publication is required
to complete the private-testing M13 gate.

## Public or commercial distribution boundary

Trusted code signing remains mandatory before LaserX is sold, publicly
distributed, presented as a trusted public beta, or released to users outside
the owner's controlled private test group.

For that future boundary, production packaging sets `forceCodeSigning` and
receives an exportable Windows code-signing certificate only through
`WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`, or through a separately accepted
managed-signing ADR. Certificates and passwords are never stored in the
repository or release artifact and are scoped only to the signing build steps.
Production validation requires both a trusted signature and the exact reviewed
certificate identity. The controlled public-release workflow must fail rather
than publish an unsigned artifact or one signed by an unexpected certificate.

Pull-request CI may continue using a disposable, explicitly CI-only self-signed
certificate on its temporary runner. It verifies the exact embedded signer
thumbprint and rejects unsigned or hash-mismatched artifacts without treating
the test identity as a public distribution identity.

Every release or private-test evidence build records the exact source commit,
semantic version, x64 platform, byte sizes, SHA-256 hashes, signature state and
identity when present, and artifact paths in versioned evidence. Public
publication remains a manual, review-gated workflow against an existing version
tag.

## Rationale

NSIS is already supplied by the pinned packaging toolchain and supports a
normal Windows install/uninstall lifecycle without adding another desktop
runtime. Per-user installation avoids requiring administrator access for the
normal beta path. Stable identity and explicit data-retention choices make
upgrade and uninstall predictable while protecting user projects and recovery
data.

Buying and operating a trusted public code-signing identity provides no current
product value while LaserX is used only by the owner on controlled computers.
Deferring that cost and setup avoids blocking product validation on a
commercial-distribution requirement that does not yet apply.

Separating private-test artifacts, disposable CI signing, and future trusted
public signing prevents a self-signed or unsigned installer from being
misrepresented as a public release while preserving the complete technical
signing path for later commercialization.

## Alternatives

- A portable executable was rejected because it provides no Start Menu,
  upgrade, or uninstall contract.
- MSI and AppX were deferred because NSIS covers the first installer and does
  not require a Store or enterprise deployment decision.
- One-click install was rejected because it cannot present the required
  shortcut and user-data choices clearly.
- Deleting application data by default was rejected because it can destroy
  recovery state and encrypted credentials without explicit consent.
- Automatic update was deferred because no update service or rollback policy
  has been accepted.
- Requiring a purchased trusted certificate for owner-only testing was rejected
  because it adds cost and operational complexity without improving the
  controlled private test.
- Unsigned fallback for a public or commercial release remains rejected because
  it could publish an artifact with an unknown publisher.

## Consequences

The private beta supports Windows 10/11 x64 on owner-controlled machines.
ARM64-native and 32-bit installers are not beta artifacts.

M13 may complete after the private installer is verified from reviewed source,
installed and exercised on an owner-controlled Windows machine, and its private
status and expected trust warnings are recorded. Trusted signing and public
publication move to a future commercialization gate and must be completed
before any public sale or distribution.
