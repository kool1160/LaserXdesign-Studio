# Beta Known Issues

## 0.13.0-beta.1

- The controlled beta publishes x64 Windows installers only. There is no
  ARM64-native or 32-bit beta artifact.
- Auto-update is not enabled. Upgrade by running a newer reviewed installer;
  projects and application data are preserved by default.
- A standard organization-validated Windows signing certificate can still show
  SmartScreen reputation warnings until publisher reputation develops.
- Recovery stores one active snapshot rather than a browsable recovery
  history. An explicit project save is never overwritten by recovery.
- Crash dumps and logs remain local and are not submitted automatically.
- SVG, DXF, raster, font, AI, and manufacturing-analysis limitations remain as
  documented in their format and feature contracts. LaserX is not CAM and does
  not certify physical safety.
