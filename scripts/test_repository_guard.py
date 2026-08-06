#!/usr/bin/env python3
"""Negative coverage for LaserX repository source-of-truth guards."""

from __future__ import annotations

from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))

from repository_guard import (  # noqa: E402
    CONTRACT_REQUIREMENTS,
    ROOT,
    case_collision_errors,
    current_slice_error,
    missing_terms,
    workflow_contract_errors,
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
    if relative_path in {"docs/CODEX_EXECUTION_PLAN.md", "docs/CLAUDE_EXECUTION_PLAN.md"}:
        if not missing_terms(stale_claude_plan, terms):
            FAILURES.append(f"stale Claude assignment unexpectedly satisfies {label}")


# Case-collision enforcement is consolidated into Repository Guard. Prove
# ordinary paths pass while case-folded and file/directory-prefix collisions fail.
if case_collision_errors(["docs/A.md", "packages/domain/src/index.ts"]):
    FAILURES.append("ordinary distinct paths unexpectedly collide")
if not case_collision_errors(["docs/Guide.md", "DOCS/guide.md"]):
    FAILURES.append("case-folded path collision was not detected")
if not case_collision_errors(["tools/cache", "TOOLS/CACHE/item.json"]):
    FAILURES.append("file/directory-prefix collision was not detected")


# Prove workflow consolidation is load-bearing against reactivating a completed
# milestone workflow or weakening either current exact-head path.
workflow_directory = ROOT / ".github" / "workflows"
workflows = {
    path.name: path.read_text(encoding="utf-8")
    for path in workflow_directory.glob("*.yml")
}
real_workflow_errors = workflow_contract_errors(workflows)
if real_workflow_errors:
    FAILURES.extend(f"real workflow contract: {error}" for error in real_workflow_errors)

mutations = (
    (
        "reactivated historical PR workflow",
        "m08-cutability.yml",
        "\n  pull_request:\n" + workflows["m08-cutability.yml"],
    ),
    (
        "removed exact-head guard checkout",
        "repository-guard.yml",
        workflows["repository-guard.yml"].replace(
            "ref: ${{ github.event.pull_request.head.sha || github.sha }}", "ref: main"
        ),
    ),
    (
        "removed canonical scope classifier",
        "canonical-verification.yml",
        workflows["canonical-verification.yml"].replace(
            "py -3 scripts/ci_scope.py", "Write-Output skipped"
        ),
    ),
)
for label, filename, mutated_text in mutations:
    mutated = dict(workflows)
    mutated[filename] = mutated_text
    if not workflow_contract_errors(mutated):
        FAILURES.append(f"workflow mutation unexpectedly passed: {label}")


if FAILURES:
    print("Repository guard regression tests failed:")
    for failure in FAILURES:
        print(f"- {failure}")
    raise SystemExit(1)

print(
    "Repository guard regression tests passed: M15 G0-G6 slice validation and "
    "all Codex/primary-chat/M15/CI contract markers are load-bearing."
)
