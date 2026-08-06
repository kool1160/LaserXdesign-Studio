# LaserX Chat Authority

## Purpose

This file prevents a ChatGPT conversation, project, custom GPT, coding session, or other connected agent from mutating LaserX merely because it can access GitHub and recognizes a LaserX command.

## Designated authority

The **LaserX Design Studio primary operations chat** is the only chat authorized to perform planning/review-side GitHub writes for LaserX.

Authorized there only:

- `Lock that into LaserX`;
- posting acceptance findings or repair instructions;
- changing milestone or gate status;
- marking a pull request ready;
- merging or closing a pull request;
- closing or activating an issue;
- `Advance LaserX`;
- changing governance, ownership, or execution routing.

The Codex implementation session is separately authorized only for the one bounded `Continue LaserX` task recorded in `docs/status/CURRENT.md`. Codex may push its implementation branch and draft PR evidence, but it may not merge, advance, close the active issue, change the active gate, or rewrite ownership authority.

## Cross-chat write prohibition

Every other ChatGPT conversation, ChatGPT Project, custom GPT, Claude/Fable/Anthropic conversation, general assistant chat, audit chat, or unrelated software-project chat is **read-only for LaserX**, even when:

- the owner types a valid LaserX command there;
- the chat can access the GitHub connector;
- the chat finds a `READY` review or a valid next command;
- the owner replies `yes`, `do it`, `advance`, or similar;
- the chat previously discussed LaserX;
- the chat believes it is helping recover a stalled process.

An unauthorized chat must not merge, mark ready, close, activate, edit status, post governance decisions, rerun or alter required gates, or otherwise mutate LaserX. It must answer:

> LaserX write authority belongs to the LaserX Design Studio primary operations chat. Return there and issue the command.

Read-only inspection and explanation are allowed. Mutation is not.

## Fail-closed rule

Chat identity cannot be proven from repository data alone. Therefore, when a conversation is uncertain whether it is the designated LaserX primary operations chat, it must assume it is **not authorized** and remain read-only.

A valid command plus repository state is not sufficient authorization. The conversation context itself must be the designated LaserX primary operations project.

## Owner recovery

If the primary operations chat is lost or intentionally replaced, the owner must explicitly establish a new primary operations chat and then record that transfer in this file and `docs/status/CURRENT.md` from the replacement chat before any advancement or governance mutation occurs.

## Current lock

As of 2026-08-06, no transfer has been authorized. The LaserX Design Studio primary operations chat remains the sole planning/review write authority.