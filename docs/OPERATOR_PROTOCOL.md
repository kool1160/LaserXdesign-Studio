# LaserX Design Studio Operator Protocol

## Purpose

This protocol keeps the owner out of the copy-and-paste loop while preserving bounded implementation, exact evidence, review discipline, and explicit milestone advancement.

The durable workflow is:

1. discuss product intent with the owner;
2. record accepted decisions in GitHub;
3. let ChatGPT inspect, implement, verify, and integrate bounded work inside the active gate;
4. use focused exact-head verification for routine PRs;
5. perform deep senior audits at important risk-bearing turning points;
6. use an independent verifier for critical trust, manufacturing, security, release, or safety boundaries;
7. return compact status to the owner when a decision or milestone checkpoint is actually needed.

Issue #44, Issue #37, ADR 0025, and `docs/status/CURRENT.md` are mandatory context for post-M13 work.

## Roles

| Role | Responsibility |
| --- | --- |
| Owner | Defines product direction, pricing philosophy, milestone order, major scope changes, and advancement. |
| ChatGPT | Senior software engineer, active implementation lead, orchestrator, focused exact-head verifier, and routine integrator. |
| Independent verifier | Reviews critical work not authored by that verifier. May be Claude, Codex, another capable model, a human, or a combination. |
| Claude | Held by default; available for explicitly assigned independent review, repair, comparison, or specialist work. |
| Codex | Held by default under the same explicit-assignment boundary. |
| GitHub | Stores the durable plan, code, evidence, findings, CI, and milestone state. |

ChatGPT must distinguish implementation evidence from acceptance judgment and must not treat its own earlier summary, or another agent's report, as proof without re-reading the exact GitHub head.

## Authoritative reading order

1. explicit owner instruction;
2. `AGENTS.md`;
3. ADR 0025 and `docs/status/CURRENT.md` for the active implementation assignment;
4. Issues #44 and #37;
5. `docs/OPERATOR_PROTOCOL.md`;
6. `docs/WORKSTREAM_OWNERSHIP.md`;
7. active milestone document;
8. active issue;
9. active PR, findings, and exact-head CI.

Old chats, stale PR bodies, old branches, experiment branches, local handoffs, and temporary worktrees are not current truth.

# Review depth

## Routine implementation verification

Routine changes inside the owner-approved active gate do not require a heavyweight senior audit or a separate owner command for every PR.

Before merging routine work, ChatGPT must:

1. inspect the complete focused diff;
2. verify the exact current head;
3. run or inspect the required tests and CI;
4. confirm the change remains inside the active gate;
5. confirm no unresolved blocking finding remains;
6. record exact-head evidence in GitHub;
7. merge with an expected-head guard.

Routine work includes narrow documentation, test-only strengthening, localized refactors with unchanged contracts, accepted-architecture UI implementation, and bounded bug repairs with regression tests.

## Senior turning-point audit

A deep senior audit is required for:

- ADR or architecture acceptance;
- cross-package public contracts;
- major integration slices;
- worker, cache, cancellation, concurrency, or performance strategy;
- milestone-defining user workflows;
- major runtime dependencies or bundling boundaries;
- repairs for false success, data loss, silent incorrect output, or resource leakage;
- evidence that materially changes the roadmap;
- completion of a risk-bearing gate;
- milestone exit;
- private or public release candidates.

A senior audit inspects the exact head, full relevant diff, neighboring architecture, tests, CI, issue and milestone acceptance, scope drift, product direction, limitations, and whether claims match the code.

## Critical independent checkpoint

A separate verifier is required for:

- schema or migration changes;
- canonical units, geometry, cutability, physical-layer truth, or manufacturing exports;
- filesystem, IPC, credentials, signing, updating, installation, or privileged boundaries;
- capture evidence claimed as proof;
- AI credential/provider security;
- licensing, payment, or public distribution enforcement;
- machine control, hardware, simulator, operator review, or safety;
- disputed evidence or explicit owner request.

Independent means the verifier did not author the load-bearing implementation being approved.

# Command reference

## `Plan LaserX: <idea>`

Discuss product behavior, workflow, scope, priority, business model, manufacturing rules, architecture, or sequencing without starting implementation.

## `Lock that into LaserX`

Write an accepted decision to the smallest authoritative GitHub location: issue, milestone, requirements, ADR, ownership document, status, or PR finding.

## `Continue LaserX`

Use with ChatGPT while `CURRENT.md` assigns ChatGPT as implementation lead.

ChatGPT must:

1. inspect all authoritative sources and live GitHub state;
2. identify the active milestone, issue, bounded sub-slice, and open work;
3. resolve blocking findings or CI failures first;
4. otherwise implement the next technically correct bounded work;
5. add tests and behavior-linked documentation;
6. keep branches, PRs, issues, and status synchronized;
7. perform routine exact-head verification and merge routine PRs inside the active gate when safe;
8. stop and report to the owner at a senior checkpoint, independent checkpoint, blocked decision, or milestone-advancement boundary.

`Continue LaserX` never authorizes:

- later-milestone scope;
- speculative future infrastructure;
- wholesale experiment merge;
- silent issue closure;
- product-direction changes without the owner;
- milestone advancement without owner authorization;
- accepting a stale handoff as proof.

## `Repair LaserX`

Inspect the active code, PR, findings, and CI, then repair only the unresolved bounded defects. Repair does not authorize broader scope.

## `Check LaserX`

Perform a deep senior audit against the exact current head. This command may be used by the owner at any time and is mandatory at the senior turning points defined above.

The audit inspects:

- active milestone and issue acceptance;
- exact head and complete relevant diff;
- source, tests, fixtures, migrations, ADRs, and documentation;
- findings and whether repairs truly close them;
- required CI on the final head or reviewed merge ref;
- scope and product-direction drift;
- whether claims and evidence match live code.

The verdict is normally:

```text
LaserX M## PR #__ — READY | REPAIR | BLOCKED
Head: <full SHA>
CI: green | failing | running
Finding: none | <brief blocking reason>
Next: continue implementation | independent verification | owner decision | milestone advancement
```

## `Verify LaserX Independently`

Assign a verifier who did not author the load-bearing implementation. The assignment and exact target head must be recorded in GitHub.

## `Advance LaserX`

Valid only after a senior `READY` verdict, required independent verification where applicable, and explicit owner authorization.

Before advancing, ChatGPT verifies:

1. reviewed head is unchanged;
2. required checks are green;
3. no blocking finding remains;
4. active gate or milestone acceptance is satisfied;
5. the owner authorized advancement.

Then ChatGPT may merge any remaining checkpoint PR, close the active gate or issue when appropriate, record exact merge evidence, and activate only the next owner-approved gate or milestone.

## `Status LaserX`

Read-only live status: active milestone, issue, sub-slice, open PR/head, CI, blockers, ownership, audit class, and next valid action.

## `Hold LaserX`

Pause new implementation. Do not merge, advance, create new production branches, or start parallel scope until explicitly resumed.

# Normal operating loop

```text
Owner: Plan LaserX: <idea>
ChatGPT: discuss and settle direction
Owner: Lock that into LaserX
ChatGPT: record the decision

Owner: Continue LaserX
ChatGPT: implement and integrate routine work inside the active gate

At a senior turning point:
ChatGPT: perform or report the deep exact-head audit

At a critical boundary:
ChatGPT: assign independent verification

At milestone advancement:
Owner: Advance LaserX
ChatGPT: verify, record, and activate only the approved next milestone
```

## Slice policy

A milestone may contain multiple capabilities, and a sub-slice may contain multiple routine PRs. Split work when one PR would combine unrelated architectures, risky migrations, or independently testable workflows. Do not split work into empty infrastructure with no testable value.

M14's active G4 sub-slices are recorded in ADR 0025, `docs/CLAUDE_EXECUTION_PLAN.md`, and `docs/status/CURRENT.md`.

## State names

| State | Meaning | Normal action |
| --- | --- | --- |
| `PLANNING` | Product behavior or architecture is being decided. | Record owner decision. |
| `IMPLEMENTING` | ChatGPT is building approved work. | Continue routine delivery. |
| `REPAIRING` | Blocking findings or CI are being corrected. | Repair and verify. |
| `CHECKPOINT_REVIEW` | A senior turning-point audit is required. | `Check LaserX`. |
| `INDEPENDENT_REVIEW` | Separation of duties is required. | Assign independent verifier. |
| `READY` | Checkpoint accepted and required evidence is green. | Continue active gate or request advancement. |
| `BLOCKED` | Human decision, external dependency, or failure prevents progress. | Owner decision or bounded repair. |
| `HELD` | Work or an agent is intentionally paused. | Explicit resume or assignment. |

## Final rules

- GitHub is the project record; chat is not.
- ChatGPT implements and orchestrates while `CURRENT.md` says so.
- Routine changes receive focused exact-head verification, not full project audits.
- Deep audits happen at architecture, integration, truth, security, milestone, and release turning points.
- Claude and Codex enter only through explicit recorded assignment.
- The owner does not courier routine implementation reports or approve every small PR.
- The owner retains product direction and milestone advancement.
- No agent invents the roadmap.
- No milestone advances merely because code exists.
- No experiment branch is merged wholesale.
