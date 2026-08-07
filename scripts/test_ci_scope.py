#!/usr/bin/env python3
"""Regression tests for canonical CI scope classification."""

from __future__ import annotations

from ci_scope import is_governance_path, normalize_path, requires_packaged_windows


def assert_equal(actual: object, expected: object, label: str) -> None:
    if actual != expected:
        raise AssertionError(f"{label}: expected {expected!r}, got {actual!r}")


assert_equal(normalize_path(r"docs\status\CURRENT.md"), "docs/status/CURRENT.md", "Windows path")

for path in (
    "AGENTS.md",
    "README.md",
    "docs/CHAT_AUTHORITY.md",
    ".github/workflows/canonical-verification.yml",
    "scripts/repository_guard.py",
    "scripts/test_ci_scope.py",
):
    assert_equal(is_governance_path(path), True, f"governance path {path}")

for path in (
    "package.json",
    "pnpm-lock.yaml",
    "apps/desktop/src/App.tsx",
    "packages/domain/src/index.ts",
    "scripts/release-policy-audit.mjs",
    "fixtures/svg/24-inch.svg",
):
    assert_equal(is_governance_path(path), False, f"product path {path}")

assert_equal(
    requires_packaged_windows(["AGENTS.md", "docs/CHAT_AUTHORITY.md"]),
    False,
    "governance-only diff",
)
assert_equal(
    requires_packaged_windows(["docs/TESTING.md", "apps/desktop/src/App.tsx"]),
    True,
    "mixed product diff",
)
assert_equal(requires_packaged_windows([]), True, "unknown diff fails closed")

print("CI scope regression tests passed: governance-only skips packaging; product and unknown diffs require it.")
