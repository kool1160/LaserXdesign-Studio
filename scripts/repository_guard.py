#!/usr/bin/env python3
"""LaserX repository structure and policy guard."""

from __future__ import annotations

import os
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]

# The active M14 slice legitimately advances G0 -> G6, so pinning one literal
# makes the guard fail on main every time the milestone moves forward. Pinning
# only the "G" prefix would accept G7, GARBAGE, or a truncated line, so the
# accepted values are matched explicitly instead.
CURRENT_SLICE_PATTERN = re.compile(r"^- Current slice: \*\*G[0-6] ", re.MULTILINE)


def current_slice_error(text: str) -> str | None:
    """Returns an error message when CURRENT.md does not name a valid M14 slice."""
    if CURRENT_SLICE_PATTERN.search(text) is None:
        return (
            "docs/status/CURRENT.md must name the active M14 slice as "
            '"- Current slice: **G<0-6> ..."'
        )
    return None

MILESTONE_FILENAMES = (
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
    "M14-production-physical-3d-preview.md",
    "M15-guided-onboarding-learn-mode.md",
    "M16-material-catalog-expansion.md",
    "M17-process-aware-manufacturability.md",
    "M18-downstream-export-profiles.md",
    "M19-optional-ai-idea-to-cuttable.md",
    "M20-licensing-trial-purchase.md",
    "M21-community-beta-readiness.md",
    "M22-real-user-usability-validation.md",
    "M23-version-1-release-launch.md",
    "M24-machine-platform-foundation.md",
    "M25-first-controller-vertical-slice.md",
)

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
    "docs/OPERATOR_PROTOCOL.md",
    "docs/WORKSTREAM_OWNERSHIP.md",
    "docs/CLAUDE_EXECUTION_PLAN.md",
    "docs/status/CURRENT.md",
    *(f"docs/milestones/{name}" for name in MILESTONE_FILENAMES),
    "docs/decisions/0016-secure-svg-dxf-interchange.md",
    "docs/decisions/0017-user-owned-ai-provider-credentials.md",
    "docs/decisions/0019-secure-replaceable-raster-tracing.md",
    "docs/decisions/0020-deterministic-cutability-and-bridge-proposals.md",
    "docs/decisions/0022-explicit-manufacturing-layers-and-atomic-production-packages.md",
    "docs/decisions/0023-windows-beta-installer-and-release-boundary.md",
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
    ROOT / "docs" / "milestones" / filename for filename in MILESTONE_FILENAMES
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


def require_terms(errors: list[str], path: Path, terms: tuple[str, ...], label: str) -> None:
    text = path.read_text(encoding="utf-8")
    for term in terms:
        if term not in text:
            errors.append(f"{label} is missing required contract text: {term}")


def check_instruction_links(errors: list[str]) -> None:
    require_terms(
        errors,
        ROOT / "AGENTS.md",
        (
            "GitHub Issue #44",
            "Claude — implementation lead",
            "ChatGPT — planning, audit, and advancement authority",
            "canonical stored length unit: millimeters",
            "Native DWG editing is explicitly out of scope",
            "M14 — Production physical 3D preview integration.",
            "M15 — Guided onboarding and Learn Mode.",
            "M23 — Version 1.0 release and broader-market launch.",
            "M24 — Simulator-first machine platform foundation.",
            "M25 — First explicitly approved LaserX controller vertical slice.",
        ),
        "AGENTS.md",
    )

    compatibility = (ROOT / "agent.md").read_text(encoding="utf-8")
    if "AGENTS.md" not in compatibility or "authoritative agent contract" not in compatibility:
        errors.append("agent.md must remain a compatibility pointer to authoritative AGENTS.md")

    milestone_index = ROOT / "docs" / "MILESTONES.md"
    required_rows = tuple(
        f"| M{number:02d} |" for number in range(14, 26)
    )
    require_terms(errors, milestone_index, required_rows, "docs/MILESTONES.md")

    require_terms(
        errors,
        ROOT / "docs" / "status" / "CURRENT.md",
        (
            "M14 — Production Physical 3D Preview Integration",
            "Implementation lead: Claude",
            "Independent planning/review/advancement: ChatGPT",
            "Issues #44 and #37",
        ),
        "docs/status/CURRENT.md",
    )

    slice_error = current_slice_error(
        (ROOT / "docs" / "status" / "CURRENT.md").read_text(encoding="utf-8")
    )
    if slice_error is not None:
        errors.append(slice_error)

    require_terms(
        errors,
        ROOT / "docs" / "milestones" / "M14-production-physical-3d-preview.md",
        (
            "The experiment branch is never merged wholesale.",
            "No CAD kernel is justified for M14.",
            "typed Electron preload/main PNG capture",
            "Status advances to M15 only after explicit owner approval.",
        ),
        "M14 milestone",
    )

    require_terms(
        errors,
        ROOT / "docs" / "CLAUDE_EXECUTION_PLAN.md",
        (
            "Slice G0",
            "Slice G6",
            "Claude is the implementation lead",
            "ChatGPT is the independent planning and audit authority",
        ),
        "Claude execution plan",
    )


def check_no_legacy_milestones(errors: list[str]) -> None:
    legacy_paths = (
        ROOT / "docs" / "milestones" / "M14-beta-validation-v1-release.md",
        ROOT / "docs" / "milestones" / "M15-machine-platform-foundation.md",
        ROOT / "docs" / "milestones" / "M16-first-controller-vertical-slice.md",
    )
    for path in legacy_paths:
        if path.exists():
            errors.append(f"legacy milestone path must be removed: {relative(path)}")


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
    check_no_legacy_milestones(errors)
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
