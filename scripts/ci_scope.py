#!/usr/bin/env python3
"""Select the canonical PR verification scope, failing closed to Windows."""

from __future__ import annotations

import os
from pathlib import Path, PurePosixPath
import subprocess
import sys


GOVERNANCE_ROOT_FILES = {
    "AGENTS.md",
    "agent.md",
    "README.md",
}
GOVERNANCE_SCRIPT_FILES = {
    "scripts/ci_scope.py",
    "scripts/repository_guard.py",
    "scripts/test_ci_scope.py",
    "scripts/test_repository_guard.py",
}
GOVERNANCE_PREFIXES = ("docs/", ".github/")


def normalize_path(path: str) -> str:
    normalized = PurePosixPath(path.replace("\\", "/")).as_posix()
    while normalized.startswith("./"):
        normalized = normalized[2:]
    return normalized


def is_governance_path(path: str) -> bool:
    normalized = normalize_path(path)
    return (
        normalized in GOVERNANCE_ROOT_FILES
        or normalized in GOVERNANCE_SCRIPT_FILES
        or normalized.startswith(GOVERNANCE_PREFIXES)
    )


def requires_packaged_windows(paths: list[str]) -> bool:
    """Unknown, empty, or product-impacting diffs require the full suite."""
    normalized = [normalize_path(path) for path in paths if path.strip()]
    return not normalized or any(not is_governance_path(path) for path in normalized)


def changed_paths(base_sha: str, head_sha: str) -> list[str]:
    if not base_sha or not head_sha:
        return []
    completed = subprocess.run(
        ["git", "diff", "--name-only", f"{base_sha}...{head_sha}"],
        check=True,
        capture_output=True,
        text=True,
    )
    return [line for line in completed.stdout.splitlines() if line.strip()]


def write_output(required: bool) -> None:
    value = "true" if required else "false"
    output_path = os.environ.get("GITHUB_OUTPUT")
    if output_path:
        with Path(output_path).open("a", encoding="utf-8") as output:
            output.write(f"packaged_windows={value}\n")
    print(f"packaged_windows={value}")


def main() -> int:
    base_sha = os.environ.get("LASERX_BASE_SHA", "").strip()
    head_sha = os.environ.get("LASERX_HEAD_SHA", "").strip()

    try:
        paths = changed_paths(base_sha, head_sha)
    except (OSError, subprocess.CalledProcessError) as error:
        print(f"Could not classify exact-head diff; requiring packaged Windows: {error}")
        write_output(True)
        return 0

    if paths:
        print("Changed paths:")
        for path in paths:
            print(f"- {path}")
    else:
        print("No trustworthy pull-request diff was available; using fail-closed scope.")

    write_output(requires_packaged_windows(paths))
    return 0


if __name__ == "__main__":
    sys.exit(main())
