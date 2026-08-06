#!/usr/bin/env python3
"""Negative coverage for LaserX repository source-of-truth guards."""

from __future__ import annotations

from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))

from repository_guard import (  # noqa: E402
    CONTRACT_REQUIREMENTS,
    ROOT,
    current_slice_error,
    missing_terms,
)

FAILURES: list[str] = []


def accepts_slice(label: str, text: str) -> None:
    if current_slice_error(text) is not None:
        FAILURES.append(f"expected accepted slice ({label}): {text!r}")


def rejects_slice(label: str, text: str) -> None:
    if current_slice_error(text) is None:
        FAILURES.append(f"expected rejected slice ({label}): {text!r}")


# Every legitimate M15 slice must pass, so advancing G0 -> G6 does not turn
# main red. Out-of-range, malformed, missing, and truncated states must fail.
for index in range(0, 7):
    accepts_slice(
        f"slice G{index}",
        f"- Current slice: **G{index} — some described slice**\n",
    )

accepts_slice(
    "surrounded by other content",
    "# Status\n\n- Active issue: #45\n- Current slice: **G3 — adapter**\n- Other: x\n",
)

rejects_slice("missing entirely", "# Status\n\n- Active issue: #45\n")
rejects_slice("out of range G7", "- Current slice: **G7 — invented slice**\n")
rejects_slice("out of range G9", "- Current slice: **G9 — invented slice**\n")
rejects_slice("non-numeric GARBAGE", "- Current slice: **GARBAGE**\n")
rejects_slice("bare prefix", "- Current slice: **G**\n")
rejects_slice("truncated after letter", "- Current slice: **G1**\n")
rejects_slice("no bold marker", "- Current slice: G1 — text-heavy\n")
rejects_slice("wrong milestone letter", "- Current slice: **M1 — text-heavy**\n")
rejects_slice("not a list item", "Current slice: **G1 — text-heavy**\n")
rejects_slice("empty document", "")


# Prove every current contract is present and load-bearing: removing any one
# configured marker from its real source must make that contract fail.
for relative_path, terms, label in CONTRACT_REQUIREMENTS:
    text = (ROOT / relative_path).read_text(encoding="utf-8")
    absent = missing_terms(text, terms)
    if absent:
        FAILURES.append(f"real {label} is missing configured markers: {absent!r}")
        continue
    for term in terms:
        without_term = text.replace(term, "")
        if term not in missing_terms(without_term, terms):
            FAILURES.append(f"removing marker from {label} was not detected: {term!r}")


# The former active-assignment shape must not satisfy either current execution
# truth or the historical Claude file's explicit held-notice contract.
stale_claude_plan = """# Claude Execution Plan

Claude is the active implementation agent.
ChatGPT is the acceptance authority.
"""
for relative_path, terms, label in CONTRACT_REQUIREMENTS:
    if relative_path in {"docs/SOL_EXECUTION_PLAN.md", "docs/CLAUDE_EXECUTION_PLAN.md"}:
        if not missing_terms(stale_claude_plan, terms):
            FAILURES.append(f"stale Claude assignment unexpectedly satisfies {label}")


if FAILURES:
    print("Repository guard regression tests failed:")
    for failure in FAILURES:
        print(f"- {failure}")
    raise SystemExit(1)

print(
    "Repository guard regression tests passed: M15 G0-G6 slice validation and "
    "all current SOL High/planning-review/M15 contract markers are load-bearing."
)
