# LaserX pre-cleanup archive — 2026-08-05

## Authority boundary

This archive is a historical knowledge base only. Its branches, files, status text, architecture notes, and implementation choices are **non-authoritative** once cleanup occurs. Current `main`, `AGENTS.md`, `docs/status/CURRENT.md`, the active milestone, and live GitHub issues/PRs remain the only operational truth.

Archive base before cleanup: `main` at `078d4637fe0660792ebe1513aebb31b6a8593c1f`.

No source file, branch, issue, PR, or status record was deleted when this archive was created.

## Branch tips approved as cleanup candidates

| Original branch | Exact archived tip |
|---|---|
| `bootstrap/codex-scaffold` | `72d05b7e19be0c36afb0cf1320870ca1b87a1642` |
| `docs/m14-governance-correction` | `a012f4144129dea81fe6bef6aeb6adfa12295da7` |
| `docs/operator-protocol` | `bc2c6a35e4250bd57de3c9d61ba0ca4438697c9b` |
| `docs/pin-post-milestone-direction` | `2b978856dd6e3f389474ad6f612dbe1c9d89e250` |
| `docs/planning-chat-product-direction-handoff` | `04404690c1c089a46986915ea16628bb39a8fe94` |
| `feat/m01-desktop-shell` | `c6df55b000736803e5f337b7f3ced247dc99e8ba` |
| `feat/m02-document-viewport` | `1b9bd6623a0e2fdcd38523b4d9e91418d5beb39e` |
| `feat/m03-editing-core` | `1e40fc3ad1e865ab79df89c76a50fe6848352115` |
| `feat/m04-text-fonts` | `a08a7afb062954782266ec572b895b21fd556b66` |
| `feat/m05-geometry-editing` | `48a8519223dbce8438e89397ed40ddad9ec6423f` |
| `feat/m06-svg-dxf` | `f9fb69f298580d3346414d445c94c4654a5c177e` |
| `feat/m07-raster-tracing` | `144a44532f36f2d8453fde60d61836301b3ec133` |
| `feat/m08-cutability` | `c3068c2591cae93ef00434bd05e7b16850e32121` |
| `feat/m09-sign-tools` | `2e7214c1805555f7ab330e1497c34bab72b8de54` |
| `feat/m10-ai-generation` | `18a9d8b23c0306638f5529c2c4f6e5bfc0aeec6d` |
| `feat/m11-ui-branding-polish` | `cef44b91abadf04b3a5dd17afd41557085c4edea` |
| `feat/m12-layered-production` | `3770ecbf9f459898a9e848b7a8e338b3c69e567d` |
| `feat/m13-windows-installer-beta` | `6cdfaf4fbf68e8c078b4b0b0cda095ea1fcad30f` |
| `feat/m14-g0-physical-preview-architecture` | `350214a70b3c9e5c1fe0a9855d703135f57c9959` |
| `feat/m14-g1-scaling-evidence` | `1adbfbacd872f4a24e3947b5b4d18eba40d9123a` |
| `feat/m14-g2-pure-scene-package` | `8ecf0fb002d712bd1110cade5b1d67e3ad34122e` |
| `feat/m14-g3-three-adapter` | `9785216183535917d8ab0c7f51f37e75ed8e7503` |
| `feat/m14-g4a-preview-worker-foundation` | `3d21510cbbe540420df185f09405917f17313d96` |
| `feat/m14-g4b-lazy-preview-screen` | `d115ec5d873c67087925eb9b9bb7dac03a3df843` |
| `feat/m14-g4c-interaction-fallback-cleanup` | `c20a2bb851cf3b1781f95f5195ba8038ee5ad4c6` |
| `feat/m14-g5-privileged-png-capture` | `d34c9cca2b7552551cfcd1efcd6fccd7baaa6a58` |
| `fix/m13-hands-on-repair-gate` | `5fb466f1d1c784c4d2d2bc14aab6f5167793b150` |
| `fix/m13-project-reopen-persistence` | `e642aa56cb70d6876a9af43024920349f0c8ab7a` |
| `governance/audit-turning-points` | `a7c3a133695b7fb44b4d5c6c31026327cb698c97` |
| `governance/chatgpt-implementation-ownership` | `e7969c36119c46b9ba198f044ff8f86ac252f1b0` |
| `governance/senior-engineering-orchestration` | `1fb6f240e448b2c58b422e04955d8d6c60cd2952` |
| `maintenance/resolve-pr-template-collision` | `1c1ca0b8152294e7503a6313b9668ffa4303f449` |

## Live branches explicitly preserved outside cleanup

- `main`
- `experiment/m14-physical-3d-preview-lab`
- `experiment/material-aware-3d-presentation`
- `experiment/material-catalog-wood-acrylic` — open draft PR #40

## Restore commands

Restore any historical branch from its exact SHA:

```bash
git fetch origin
git branch <restored-name> <exact-sha-from-table>
git push origin <restored-name>
```

Inspect one archived snapshot without restoring a branch:

```bash
git show <exact-sha-from-table>:path/to/file
```

Create a temporary worktree from an archived tip:

```bash
git worktree add ../laserx-archive-inspect <exact-sha-from-table>
```

Never merge an archived branch wholesale merely because it exists. Promote useful ideas component by component against current contracts, tests, and active milestone authority.
