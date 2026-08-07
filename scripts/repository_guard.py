#!/usr/bin/env python3
"""LaserX repository structure and policy guard."""

from __future__ import annotations

import os
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]

# M15 legitimately advances G0 -> G6, so pinning one literal would make the
# guard fail on main every time the milestone moves forward. Pinning only the
# "G" prefix would accept G7, GARBAGE, or a truncated line, so the accepted
# values are matched explicitly instead.
CURRENT_SLICE_PATTERN = re.compile(r"^- Current slice: \*\*G[0-6] ", re.MULTILINE)


def current_slice_error(text: str) -> str | None:
    """Returns an error message when CURRENT.md does not name a valid M15 slice."""
    if CURRENT_SLICE_PATTERN.search(text) is None:
        return (
            "docs/status/CURRENT.md must name the active M15 slice as "
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
    "docs/CHAT_AUTHORITY.md",
    "docs/CODEX_EXECUTION_PLAN.md",
    "docs/CLAUDE_EXECUTION_PLAN.md",
    "docs/status/CURRENT.md",
    *(f"docs/milestones/{name}" for name in MILESTONE_FILENAMES),
    "docs/decisions/0016-secure-svg-dxf-interchange.md",
    "docs/decisions/0017-user-owned-ai-provider-credentials.md",
    "docs/decisions/0019-secure-replaceable-raster-tracing.md",
    "docs/decisions/0020-deterministic-cutability-and-bridge-proposals.md",
    "docs/decisions/0022-explicit-manufacturing-layers-and-atomic-production-packages.md",
    "docs/decisions/0023-windows-beta-installer-and-release-boundary.md",
    "docs/decisions/0025-chatgpt-implementation-ownership.md",
    "docs/decisions/0026-claude-implementation-chatgpt-orchestration.md",
    "docs/decisions/0027-guided-workflow-architecture-boundary.md",
    ".github/workflows/m06-svg-dxf.yml",
    ".github/workflows/m07-raster-tracing.yml",
    ".github/workflows/m08-cutability.yml",
    ".github/workflows/m10-ai-generation.yml",
    ".github/workflows/m11-ui-branding-polish.yml",
    ".github/workflows/m12-layered-production.yml",
    ".github/workflows/m13-windows-installer-beta.yml",
    ".github/workflows/m13-controlled-beta-release.yml",
    ".github/workflows/repository-guard.yml",
    ".github/workflows/canonical-verification.yml",
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
    "scripts/ci_scope.py",
    "scripts/test_ci_scope.py",
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

HISTORICAL_PR_WORKFLOWS = (
    "m04-text-fonts.yml",
    "m05-geometry-editing.yml",
    "m06-svg-dxf.yml",
    "m07-raster-tracing.yml",
    "m08-cutability.yml",
    "m09-sign-tools.yml",
    "m10-ai-generation.yml",
    "m11-ui-branding-polish.yml",
    "m12-layered-production.yml",
    "m13-windows-installer-beta.yml",
)

ACTIVE_GOVERNANCE_FILES = (
    "AGENTS.md",
    "README.md",
    "docs/MILESTONES.md",
    "docs/OPERATOR_PROTOCOL.md",
    "docs/WORKSTREAM_OWNERSHIP.md",
    "docs/CHAT_AUTHORITY.md",
    "docs/CODEX_EXECUTION_PLAN.md",
    "docs/status/CURRENT.md",
)


# Durable source-of-truth markers. These avoid volatile heads and PR numbers
# while enforcing Codex-only execution, primary-chat write authority, command
# separation, active milestone, product/unit/security boundaries, and clear
# historical supersession.
CONTRACT_REQUIREMENTS: tuple[tuple[str, tuple[str, ...], str], ...] = (
    (
        "AGENTS.md",
        (
            "GitHub Issues #44 and #37",
            "Primary operations chat — orchestrator and acceptance authority",
            "Codex — implementation surface",
            "the repository does not select, pin, auto-route, or fall back to a model",
            "every other chat is read-only for planning/review-side mutations and must fail closed",
            "Canonical stored length is millimeters.",
            "LaserX is not plasma-control software, not a general CAD replacement",
            "Electron renderer has no unrestricted Node access.",
            "no implementation agent merges, closes the active issue, activates the next gate, or approves its own work;",
        ),
        "AGENTS.md",
    ),
    (
        "docs/OPERATOR_PROTOCOL.md",
        (
            "The **LaserX Design Studio primary operations chat** is the sole planning/review write authority.",
            "Only `Continue LaserX` goes to a Codex implementation session.",
            "Other chats are read-only and fail closed.",
            "`READY`, `REPAIR`, or `BLOCKED`",
            "There is no automatic routine merge.",
            "Codex implements and repairs; it never merges or advances.",
            "Repository Guard / structure-and-policy",
            "Canonical Verification / exact-head",
        ),
        "docs/OPERATOR_PROTOCOL.md",
    ),
    (
        "docs/WORKSTREAM_OWNERSHIP.md",
        (
            "This assignment supersedes ADR 0026's Claude implementation assignment",
            "Codex is the sole active implementation surface.",
            "Only `Continue LaserX` goes to the Codex implementation session.",
            "Every other chat is read-only for those mutations.",
            "Claude, Anthropic, Fable, and other external paid implementation, repair, review, continuation, and fallback routes are removed",
        ),
        "docs/WORKSTREAM_OWNERSHIP.md",
    ),
    (
        "docs/CHAT_AUTHORITY.md",
        (
            "The **LaserX Design Studio primary operations chat** is the only chat authorized",
            "The Codex implementation session is separately authorized only for the one bounded `Continue LaserX` task",
            "LaserX write authority belongs to the LaserX Design Studio primary operations chat. Return there and issue the command.",
            "Identity uncertain means read-only.",
            "scripts/repository_guard.py",
        ),
        "docs/CHAT_AUTHORITY.md",
    ),
    (
        "docs/status/CURRENT.md",
        (
            "M15 — Guided Onboarding, Workflow-First UI, and Learn Mode",
            "Implementation surface: **Codex**",
            "Implementation model: **selected by the owner inside Codex",
            "LaserX Design Studio primary operations chat only",
            "external paid implementation routes: **removed from active operation",
            "Every agent must read GitHub Issues #44 and #37",
            "## M15 gate order",
            "## M14 completion record",
            "M14 is complete and accepted.",
        ),
        "docs/status/CURRENT.md",
    ),
    (
        "docs/CODEX_EXECUTION_PLAN.md",
        (
            "# Codex Execution Plan",
            "Codex is the only active implementation surface.",
            "The owner selects the model inside Codex for each session.",
            "Only `Continue LaserX` goes to Codex.",
            "Every other chat is read-only for those mutations.",
            "stop at `AWAITING_REVIEW` or `BLOCKED`",
            "There is no automatic routine merge.",
            "## Active M15 G1 task",
            "Visible onboarding UI, stores, IPC, grouped repair, and later G1 product work are excluded.",
        ),
        "docs/CODEX_EXECUTION_PLAN.md",
    ),
    (
        "docs/FILE_FORMATS.md",
        (
            "Native DWG is out of scope.",
            "Do not rename a DXF file to `.dwg` or claim\nequivalence.",
        ),
        "docs/FILE_FORMATS.md",
    ),
    (
        "docs/milestones/M15-guided-onboarding-learn-mode.md",
        (
            "## Approved implementation gates",
            "Each gate requires exact-head review and explicit owner advancement",
            "Status advances to M16 only after exact-head audit, merge, issue closure, and owner approval.",
        ),
        "M15 milestone",
    ),
    (
        "docs/decisions/0027-guided-workflow-architecture-boundary.md",
        (
            "Accepted for M15 G0.",
            "`transientStepIds`",
            "Transient steps recover; they are never reopened.",
            "stable-to-stable Back remains a one-step move.",
        ),
        "ADR 0027",
    ),
    (
        "docs/CLAUDE_EXECUTION_PLAN.md",
        (
            "# Claude Execution Plan — Superseded",
            "**Superseded and held as of 2026-08-06 by explicit owner direction.**",
            "docs/CODEX_EXECUTION_PLAN.md",
            "They have no active execution route.",
            "It contains no executable implementation authority.",
        ),
        "docs/CLAUDE_EXECUTION_PLAN.md (held historical notice)",
    ),
)


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

    retired_plan = ROOT / "docs" / "SOL_EXECUTION_PLAN.md"
    if retired_plan.exists():
        errors.append("fixed-model execution plan must remain removed: docs/SOL_EXECUTION_PLAN.md")

    retired_workflow = ROOT / ".github" / "workflows" / "repository-case-collision.yml"
    if retired_workflow.exists():
        errors.append(
            "standalone case-collision workflow must remain consolidated into Repository Guard"
        )


def missing_terms(text: str, terms: tuple[str, ...]) -> tuple[str, ...]:
    """Returns the contract markers absent from text."""
    return tuple(term for term in terms if term not in text)


def require_terms(errors: list[str], path: Path, terms: tuple[str, ...], label: str) -> None:
    text = path.read_text(encoding="utf-8")
    for term in missing_terms(text, terms):
        errors.append(f"{label} is missing required contract text: {term}")


def check_instruction_links(errors: list[str]) -> None:
    for relative_path, terms, label in CONTRACT_REQUIREMENTS:
        require_terms(errors, ROOT / relative_path, terms, label)

    compatibility = (ROOT / "agent.md").read_text(encoding="utf-8")
    if "AGENTS.md" not in compatibility or "authoritative agent contract" not in compatibility:
        errors.append("agent.md must remain a compatibility pointer to authoritative AGENTS.md")

    milestone_index = ROOT / "docs" / "MILESTONES.md"
    required_rows = tuple(f"| M{number:02d} |" for number in range(14, 26))
    require_terms(errors, milestone_index, required_rows, "docs/MILESTONES.md")

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
            "G4A — renderer-safe integration foundation",
            "Status advances to M15 only after explicit owner approval.",
        ),
        "M14 milestone",
    )

    require_terms(
        errors,
        ROOT / "docs" / "decisions" / "0026-claude-implementation-chatgpt-orchestration.md",
        (
            "Superseded on 2026-08-06 by the Codex-only G1 governance reset",
            "Retained as historical evidence only",
            "Originally accepted by owner on 2026-08-04",
            "Claude is the active implementation agent",
            "ChatGPT is the senior software engineer, project orchestrator, exact-head auditor, and acceptance authority",
            "G5 owns the complete capture transaction",
        ),
        "ADR 0026",
    )

    # ADR 0025 is retained for history rather than deleted; it must stay
    # visibly marked superseded so a future edit cannot silently make it read
    # as the current model again.
    require_terms(
        errors,
        ROOT / "docs" / "decisions" / "0025-chatgpt-implementation-ownership.md",
        ("Superseded by ADR 0026",),
        "ADR 0025 (superseded)",
    )

    for relative_path in ACTIVE_GOVERNANCE_FILES:
        text = (ROOT / relative_path).read_text(encoding="utf-8")
        if "SOL High" in text:
            errors.append(f"active governance file contains fixed-model routing: {relative_path}")


def case_collision_errors(paths: list[str]) -> list[str]:
    """Return case-insensitive path and file/directory-prefix collisions."""
    normalized = [
        (path, tuple(part.casefold() for part in path.replace("\\", "/").split("/")))
        for path in paths
    ]
    exact_first: dict[tuple[str, ...], str] = {}
    directory_descendant: dict[tuple[str, ...], str] = {}
    collisions: set[tuple[str, str, str]] = set()

    for path, parts in normalized:
        first = exact_first.get(parts)
        if first is None:
            exact_first[parts] = path
        elif first != path:
            collisions.add(("case-folded path", first, path))

        for length in range(1, len(parts)):
            directory_descendant.setdefault(parts[:length], path)

    for path, parts in normalized:
        descendant = directory_descendant.get(parts)
        if descendant is not None and descendant != path:
            collisions.add(("file/directory prefix", path, descendant))

    return [
        f"{kind}: {first} <-> {second}"
        for kind, first, second in sorted(collisions)
    ]


def check_case_collisions(errors: list[str]) -> None:
    raw = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT)
    tracked_paths = [path for path in raw.decode("utf-8").split("\0") if path]
    for collision in case_collision_errors(tracked_paths):
        errors.append(f"case-insensitive tracked-path collision: {collision}")


def workflow_contract_errors(workflows: dict[str, str]) -> list[str]:
    """Return errors when required-check consolidation drifts."""
    errors: list[str] = []
    for filename in HISTORICAL_PR_WORKFLOWS:
        text = workflows.get(filename, "")
        if "workflow_dispatch:" not in text:
            errors.append(f"historical workflow must remain manually dispatchable: {filename}")
        if "pull_request:" in text:
            errors.append(f"historical workflow must not be a permanent PR blocker: {filename}")

    repository_guard = workflows.get("repository-guard.yml", "")
    for marker in (
        "name: Repository Guard",
        "pull_request:",
        "ref: ${{ github.event.pull_request.head.sha || github.sha }}",
        "python scripts/repository_guard.py",
        "python scripts/test_repository_guard.py",
        "python scripts/test_ci_scope.py",
    ):
        if marker not in repository_guard:
            errors.append(f"Repository Guard workflow missing exact-head policy marker: {marker}")

    canonical = workflows.get("canonical-verification.yml", "")
    for marker in (
        "name: Canonical Verification",
        "pull_request:",
        "ref: ${{ github.event.pull_request.head.sha || github.sha }}",
        "py -3 scripts/ci_scope.py",
        "steps.scope.outputs.packaged_windows == 'true'",
        "pnpm verify",
    ):
        if marker not in canonical:
            errors.append(f"Canonical Verification workflow missing marker: {marker}")

    for filename in (
        "m13-windows-installer-beta.yml",
        "m13-controlled-beta-release.yml",
    ):
        text = workflows.get(filename, "")
        if "workflow_dispatch:" not in text or "pull_request:" in text:
            errors.append(f"release/signing workflow must remain an explicit release gate: {filename}")

    return errors


def check_workflow_contract(errors: list[str]) -> None:
    workflow_directory = ROOT / ".github" / "workflows"
    workflows = {
        path.name: path.read_text(encoding="utf-8")
        for path in workflow_directory.glob("*.yml")
    }
    errors.extend(workflow_contract_errors(workflows))


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
    check_workflow_contract(errors)
    check_case_collisions(errors)
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
