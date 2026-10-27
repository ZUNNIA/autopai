---
description: Read-only UX audit that writes local proposal tickets on demand
agent: auditor
---

# UX Review

Run this command only when the user asks for it.

Audit the requested screen, flow, or diff as a read-only reviewer.

Rules:

- Never edit source, tests, UX, CI, ADRs, or configuration.
- You may only write Markdown proposals under `tickets/ux/`.
- Never implement a proposal. The proposal is the deliverable.
- Verify every element and flow against the current code with your reading and search tools. Never guess a selector, view, or view model name.
- Reference no ticket files or ADR numbers from code snippets or identifiers.

## Proposal Structure

# UX Proposal: [Short title]

## Context
Screen, flow, or diff reviewed.

## Observation
What the user experiences today, with exact evidence from the code.

## Impact
Who is affected and how often.

## Proposal
The recommended change, described at UX level only. No implementation steps.

## Alternatives
At least one alternative and its tradeoff.

Do not add an Open Questions section and do not write unresolved decisions into the proposal. State them in the final chat message instead. The proposal must contain the review, not the pending questions.

Write proposals in English. End with a short list of the files you created and any questions the user must answer.
