#!/usr/bin/env python3
"""Negative coverage for the repository guard's M14 slice validation.

The guard previously pinned the literal `Current slice: **G0`, which made it
fail on main the moment the milestone legitimately advanced. Relaxing it to the
bare `G` prefix would have accepted `G7`, `GARBAGE`, or a truncated line, so the
accepted values are matched explicitly — and that matcher is only trustworthy if
it is proven to reject the states it claims to reject.
"""

from __future__ import annotations

from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))

from repository_guard import current_slice_error  # noqa: E402

FAILURES: list[str] = []


def accepts(label: str, text: str) -> None:
    if current_slice_error(text) is not None:
        FAILURES.append(f"expected accepted ({label}): {text!r}")


def rejects(label: str, text: str) -> None:
    if current_slice_error(text) is None:
        FAILURES.append(f"expected rejected ({label}): {text!r}")


# Every legitimate M14 slice must pass, so advancing G0 -> G6 never turns main
# red the way the original hard-coded literal did.
for index in range(0, 7):
    accepts(
        f"slice G{index}",
        f"- Current slice: **G{index} — some described slice**\n",
    )

accepts(
    "real CURRENT.md line",
    "- Current slice: **G1 — text-heavy and high-point-count scaling evidence**\n",
)
accepts(
    "surrounded by other content",
    "# Status\n\n- Active issue: #30\n- Current slice: **G3 — adapter**\n- Other: x\n",
)

# Out of range, malformed, missing, and truncated states must all fail.
rejects("missing entirely", "# Status\n\n- Active issue: #30\n")
rejects("out of range G7", "- Current slice: **G7 — invented slice**\n")
rejects("out of range G9", "- Current slice: **G9 — invented slice**\n")
rejects("non-numeric GARBAGE", "- Current slice: **GARBAGE**\n")
rejects("bare prefix", "- Current slice: **G**\n")
rejects("truncated after letter", "- Current slice: **G1**\n")
rejects("no bold marker", "- Current slice: G1 — text-heavy\n")
rejects("wrong milestone letter", "- Current slice: **M1 — text-heavy**\n")
rejects("not a list item", "Current slice: **G1 — text-heavy**\n")
rejects("empty document", "")

if FAILURES:
    print("Repository guard slice-validation tests failed:")
    for failure in FAILURES:
        print(f"- {failure}")
    raise SystemExit(1)

print(
    "Repository guard regression tests passed: every M14 slice G0-G6 is accepted, "
    "and missing, out-of-range, malformed, and truncated slice lines are rejected."
)
