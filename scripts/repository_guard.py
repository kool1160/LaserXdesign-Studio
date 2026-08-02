#!/usr/bin/env python3
"""M00 repository structure and policy guard."""

from __future__ import annotations

import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]

REQUIRED_FILES = (
    "AGENTS.md",
    "agent.md",
    "README.md",
    "package.json",
    "pnpm-workspace.yaml",
    "docs/PRODUCT_REQUIREMENTS.md",
    "docs/ARCHITECTURE.md",
    "docs/UNITS_AND_COORDINATES.md",
    "docs/FILE_FORMATS.md",
    "docs/TESTING.md",
    "docs/AI_PIPELINE.md",
    "docs/PRODUCTION_PACKAGES.md",
    "docs/WINDOWS_BETA_RELEASE.md",
    "docs/BETA_FEEDBACK.md",
    "docs/KNOWN_ISSUES.md",
    "docs/MILESTONES.md",
    "docs/status/CURRENT.md",
    "docs/milestones/M00-foundation.md",
    "docs/milestones/M01-desktop-shell.md",
    "docs/milestones/M13-windows-installer-beta-hardening.md",
    "docs/milestones/M14-beta-validation-v1-release.md",
    "docs/milestones/M15-machine-platform-foundation.md",
    "docs/milestones/M16-first-controller-vertical-slice.md",
    "docs/decisions/0016-secure-svg-dxf-interchange.md",
    "docs/decisions/0019-secure-replaceable-raster-tracing.md",
    "docs/decisions/0020-deterministic-cutability-and-bridge-proposals.md",
    "docs/decisions/0022-explicit-manufacturing-layers-and-atomic-production-packages.md",
    "docs/decisions/0023-windows-beta-installer-and-release-boundary.md",
    "docs/decisions/0017-user-owned-ai-provider-credentials.md",
    ".github/workflows/m06-svg-dxf.yml",
    ".github/workflows/m07-raster-tracing.yml",
    ".github/workflows/m08-cutability.yml",
    ".github/workflows/m10-ai-generation.yml",
    ".github/workflows/m11-ui-branding-polish.yml",
    ".github/workflows/m12-layered-production.yml",
    ".github/workflows/m13-windows-installer-beta.yml",
    ".github/workflows/m13-controlled-beta-release.yml",
    "fixtures/svg/24-inch.svg",
    "fixtures/svg/600-mm.svg",
    "fixtures/dxf/24-inch.dxf",
    "fixtures/dxf/600-mm.dxf",
    "fixtures/images/m07-raster-trace-goldens.json",
    "fixtures/images/m07/clean-logo.png",
    "fixtures/images/m07/clean-logo.jpg",
    "fixtures/images/m07/noisy-photo.png",
    "fixtures/images/m07/anti-aliased-text.png",
    "fixtures/images/m07/high-resolution-logo.png",
    "fixtures/cutability/README.md",
    "fixtures/cutability/m08-rule-goldens.json",
    "fixtures/production/m12-package-goldens.json",
    "scripts/generate-m07-raster-fixtures.cjs",
    "scripts/cutability-policy-audit.mjs",
    "scripts/ai-boundary-audit.mjs",
    "scripts/production-package-audit.mjs",
    "scripts/release-policy-audit.mjs",
    "scripts/authenticode-policy.ps1",
    "scripts/test-authenticode-policy.ps1",
    "scripts/validate-controlled-beta-release.mjs",
    "scripts/test-controlled-beta-release-gate.mjs",
    "scripts/verify-packaged-app-identity.cjs",
    "scripts/validate-windows-installer.ps1",
    "scripts/write-release-provenance.ps1",
    "docs/screenshots/m06-svg-dxf.png",
    "docs/screenshots/m07-raster-tracing.png",
    "docs/screenshots/m08-cutability-bridge-preview.png",
    "docs/DESKTOP_DESIGN_SYSTEM.md",
    "apps/desktop/public/laserx-icon.png",
    "apps/desktop/public/laserx-mark.svg",
    "apps/desktop/package.json",
    "apps/desktop/electron-builder.config.cjs",
    "apps/desktop/build-resources/installer.nsh",
    "packages/application/package.json",
    "packages/domain/package.json",
    "packages/geometry/package.json",
    "packages/cutability/package.json",
    "packages/fonts/package.json",
    "packages/import-raster/package.json",
    "packages/io-svg/package.json",
    "packages/io-dxf/package.json",
    "packages/project-format/package.json",
    "packages/production-export/package.json",
    "packages/ai/package.json",
    "packages/ui/package.json",
    "packages/test-fixtures/package.json",
)

EXPECTED_MILESTONES = tuple(
    ROOT / "docs" / "milestones" / filename
    for filename in (
        "M00-foundation.md",
        "M01-desktop-shell.md",
        "M02-document-viewport.md",
        "M03-editing-core.md",
        "M04-text-fonts.md",
        "M05-geometry-editing.md",
        "M06-svg-dxf.md",
        "M07-raster-tracing.md",
        "M08-cutability.md",
        "M09-sign-tools.md",
        "M10-ai-generation.md",
        "M11-ui-branding-polish.md",
        "M12-layered-production.md",
        "M13-windows-installer-beta-hardening.md",
        "M14-beta-validation-v1-release.md",
        "M15-machine-platform-foundation.md",
        "M16-first-controller-vertical-slice.md",
    )
)

FONT_SUFFIXES = {".ttf", ".otf", ".woff", ".woff2"}
SECRET_SUFFIXES = {".pem", ".key", ".p12", ".pfx"}
IGNORED_DIRECTORY_NAMES = {
    ".git",
    ".pnpm-store",
    "artifacts",
    "build",
    "coverage",
    "dist",
    "dist-packaged",
    "dist-packaged-upgrade-fixture",
    "node_modules",
    "out",
    "playwright-report",
    "release",
    "test-results",
}


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def repository_files():
    for directory, child_directories, filenames in os.walk(ROOT):
        child_directories[:] = [
            name for name in child_directories if name not in IGNORED_DIRECTORY_NAMES
        ]
        for filename in filenames:
            yield Path(directory) / filename


def check_required(errors: list[str]) -> None:
    for item in REQUIRED_FILES:
        if not (ROOT / item).is_file():
            errors.append(f"missing required file: {item}")

    for milestone in EXPECTED_MILESTONES:
        if not milestone.is_file():
            errors.append(f"missing milestone: {relative(milestone)}")


def check_instruction_links(errors: list[str]) -> None:
    agents = (ROOT / "AGENTS.md").read_text(encoding="utf-8")
    compatibility = (ROOT / "agent.md").read_text(encoding="utf-8")
    milestone_index = (ROOT / "docs" / "MILESTONES.md").read_text(encoding="utf-8")
    m13 = (
        ROOT / "docs" / "milestones" / "M13-windows-installer-beta-hardening.md"
    ).read_text(encoding="utf-8")

    required_agent_terms = (
        "docs/status/CURRENT.md",
        "docs/milestones/",
        "canonical stored length unit: millimeters",
        "Native DWG editing is explicitly out of scope",
        "packages/production-export/",
        "Prompt text, reference media, concept alternatives",
        "M11 - UI, branding, and product polish.",
        "M14 - Beta validation and Version 1.0 release.",
        "M15 - Simulator-first machine platform foundation.",
        "M16 - First explicitly approved LaserX controller vertical slice.",
    )
    for term in required_agent_terms:
        if term not in agents:
            errors.append(f"AGENTS.md is missing required contract text: {term}")

    if "AGENTS.md" not in compatibility or "authoritative agent contract" not in compatibility:
        errors.append("agent.md must remain a compatibility pointer to authoritative AGENTS.md")

    required_roadmap_terms = (
        "| M11 | UI, branding, and product polish |",
        "| M12 | Layered production |",
        "| M13 | Windows installer and beta hardening |",
        "| M14 | Beta validation and Version 1.0 release |",
        "| M15 | Machine platform foundation |",
        "| M16 | First LaserX controller vertical slice |",
    )
    for term in required_roadmap_terms:
        if term not in milestone_index:
            errors.append(f"docs/MILESTONES.md is missing required roadmap row: {term}")

    if "Status advances to M14" not in m13:
        errors.append("M13 must advance to M14 rather than stopping at maintenance/planning")


def check_secrets(errors: list[str]) -> None:
    for path in repository_files():
        if path.name == ".env.example":
            continue
        if path.name == ".env" or path.name.startswith(".env."):
            errors.append(f"environment file must not be committed: {relative(path)}")
        if path.suffix.lower() in SECRET_SUFFIXES:
            errors.append(f"possible credential/key file committed: {relative(path)}")


def check_fonts(errors: list[str]) -> None:
    for path in repository_files():
        if path.suffix.lower() not in FONT_SUFFIXES:
            continue

        rel = relative(path)
        expected_root = ROOT / "packages" / "fonts" / "bundled"
        try:
            path.relative_to(expected_root)
        except ValueError:
            errors.append(f"font binary outside packages/fonts/bundled: {rel}")
            continue

        family_dir = path.parent
        provenance = family_dir / "provenance.json"
        license_files = [
            candidate
            for candidate in family_dir.iterdir()
            if candidate.is_file()
            and (
                candidate.name.upper().startswith("LICENSE")
                or candidate.name.upper().startswith("OFL")
                or candidate.name.upper().startswith("COPYING")
            )
        ]
        if not provenance.is_file():
            errors.append(f"font missing provenance.json: {rel}")
        if not license_files:
            errors.append(f"font missing license file in its family directory: {rel}")


def main() -> int:
    errors: list[str] = []
    check_required(errors)
    check_instruction_links(errors)
    check_secrets(errors)
    check_fonts(errors)

    if errors:
        print("Repository guard failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("Repository guard passed.")
    print(f"Verified {len(REQUIRED_FILES)} required files and {len(EXPECTED_MILESTONES)} milestones.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
