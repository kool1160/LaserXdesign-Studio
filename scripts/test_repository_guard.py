#!/usr/bin/env python3
"""Negative coverage for the repository guard's M14 gate validation.

The guard must allow legitimate G0 -> G6 advancement without accepting invented,
malformed, missing, or truncated gate identifiers. Descriptive wording and agent
assignments may evolve independently from the bounded gate identifier.
"""

from __future__ import annotations

from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))

from repository_guard import current_gate_error  # noqa: E402

FAILURES: list[str] = []


def accepts(label: str, text: str) -> None:
    if current_gate_error(text) is not None:
        FAILURES.append(f"expected accepted ({label}): {text!r}")


def rejects(label: str, text: str) -> None:
    if current_gate_error(text) is None:
        FAILURES.append(f"expected rejected ({label}): {text!r}")


# Every legitimate M14 gate passes, so advancing G0 -> G6 never turns main red.
for index in range(0, 7):
    accepts(
        f"gate G{index}",
        f"- Current gate: **G{index} — some described gate**\n",
    )

accepts(
    "real CURRENT.md line",
    "- Current gate: **G4 — Lazy desktop integration**\n",
)
accepts(
    "surrounded by other content",
    "# Status\n\n- Active issue: #30\n- Current gate: **G3 — adapter**\n- Other: x\n",
)

# Out-of-range, malformed, missing, and truncated states must fail.
rejects("missing entirely", "# Status\n\n- Active issue: #30\n")
rejects("out of range G7", "- Current gate: **G7 — invented gate**\n")
rejects("out of range G9", "- Current gate: **G9 — invented gate**\n")
rejects("non-numeric GARBAGE", "- Current gate: **GARBAGE**\n")
rejects("bare prefix", "- Current gate: **G**\n")
rejects("truncated after identifier", "- Current gate: **G1**\n")
rejects("no bold marker", "- Current gate: G1 — text-heavy\n")
rejects("wrong milestone letter", "- Current gate: **M1 — text-heavy**\n")
rejects("legacy slice wording", "- Current slice: **G1 — text-heavy**\n")
rejects("not a list item", "Current gate: **G1 — text-heavy**\n")
rejects("empty document", "")

if FAILURES:
    print("Repository guard gate-validation tests failed:")
    for failure in FAILURES:
        print(f"- {failure}")
    raise SystemExit(1)

print(
    "Repository guard regression tests passed: every M14 gate G0-G6 is accepted, "
    "and missing, out-of-range, malformed, legacy, and truncated gate lines are rejected."
)
