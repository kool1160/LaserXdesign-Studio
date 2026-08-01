# Current Project Status

## Active gate

**M10 — Prompt and Image-to-Sign AI Pipeline**

M09 merged through PR #25 in merge commit
`dc0114d79dda84d938efb1b8366265a0a04a5235` after final review of exact feature
head `2e7214c1805555f7ab330e1497c34bab72b8de54`. Issue #10 is closed as completed.
M10 is now the only active implementation milestone; Issue #11 is the active
delivery gate.

Start M10 from current `main` in a new working directory and branch
`feat/m10-ai-generation`. Do not reuse the M09 feature branch or worktree.

Before implementation, read:

1. `AGENTS.md`
2. `docs/OPERATOR_PROTOCOL.md`
3. `docs/status/CURRENT.md`
4. `docs/milestones/M10-ai-generation.md`
5. `docs/decisions/0017-openai-first-provider-neutral-ai.md`
6. `docs/ARCHITECTURE.md`
7. `docs/CUTABILITY_RULES.md`
8. `docs/FILE_FORMATS.md`
9. `docs/TESTING.md`

## M09 completion record

- [x] PR #25 reviewed and merged.
- [x] Issue #10 closed as completed.
- [x] Final reviewed head: `2e7214c1805555f7ab330e1497c34bab72b8de54`.
- [x] Merge commit: `dc0114d79dda84d938efb1b8366265a0a04a5235`.
- [x] Repository Guard run `30681725236` passed on the final head.
- [x] M04, M05, M06, M07, M08, and M09 exact-head runs `30681725253`,
  `30681725256`, `30681725235`, `30681725233`, `30681725240`, and
  `30681725239` passed.
- [x] The final reviewed suite records 230 unit/integration tests and 25 packaged
  Windows Electron E2E scenarios.
- [x] Preview-first sign generators, exact mounting holes, seven outer shapes,
  sign-assembly tabs/slots, baseline/arc text, schema-v7 saved templates,
  licensing/provenance audits, one-command editable acceptance, standard M08
  analysis, export, save/reopen, and undo are complete and reviewed.
- [x] Standard whole-design M08 semantics remain intact across layers; only
  explicit object scopes narrow analysis.
- [x] No M10 AI, CAM, G-code, DWG, or machine-control work was included in M09.

## M10 user-visible outcome

A user can describe a sign or provide a reference image, choose from concepts,
and receive editable normalized geometry that passes the same wording,
normalization, and cutability checks as manual work.

## Launch connection model

- OpenAI is the first provider behind a provider-neutral adapter.
- The user supplies their own OpenAI API access and is billed directly by OpenAI.
- LaserX opens the official OpenAI Platform setup/billing flow and accepts a
  dedicated LaserX API key.
- The credential is stored only in the operating-system credential vault and
  used only from Electron main.
- LaserX does not embed a shared API key or resell AI credits at launch.
- Future delegated OpenAI/ChatGPT authorization may replace manual key setup
  without changing the generation pipeline.
- All non-AI workflows remain fully usable while disconnected.

## Allowed M10 work

- provider-neutral request/result and credential-acquisition interfaces;
- OpenAI-first user-owned API billing;
- secure connect, test, replace, disconnect, invalid-key, no-credit, rate-limit,
  offline, cancellation, and retry states;
- prompt fields for wording, dimensions, style, process, detail, bridges, holes,
  layers, and backing plate;
- reference-image consent and bounded attachment handling;
- multiple non-mutating concept previews;
- structured-vector output where available and M07 raster-trace fallback;
- normalization, wording verification, editable object conversion, and mandatory
  M08 cutability analysis before acceptance;
- privacy, provenance, cost/usage transparency, mocked-provider tests, and safe
  failure preserving the open project.

## Explicitly excluded

Do not implement protected-logo replication, autonomous export, hidden provider
selection, unnecessary full-project disclosure, a shared distributed API key,
LaserX-managed credit resale at launch, AI dependency for normal editing, CAM,
G-code, DWG, or machine control.

## M10 exit rule

Do not advance to M11 until every acceptance test and exit item in
`docs/milestones/M10-ai-generation.md` passes, the M10 pull request is reviewed,
required Windows CI is green, the pull request is merged, Issue #11 is closed,
and this file records the verified merge commit.
