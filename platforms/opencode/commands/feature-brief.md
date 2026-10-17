---
description: Convert the agreed feature discussion into a local brief
agent: planner
---

# Feature Brief

The orchestrator may invoke you with a JSON payload:

$ARGUMENTS

When the payload is present, write the brief at `briefPath` from `feature` and `description`. When it is absent, use the current conversation and the path the user provides.

You only write the brief file. Never edit source, tests, UX, CI, ADRs, or configuration.

## Brief Structure

# Feature Brief: [Name]

## Problem
What pain point or opportunity the feature addresses.

## Scope
What the feature includes, in concrete terms.

## Non-goals
What the feature explicitly does not include.

## Constraints
Technical, product, and repository constraints. Include the base branch when known.

## Acceptance Criteria
Observable conditions that prove the feature works.

## External References
Official links for every external API, library, or service the feature may need. Write "N/A" when the feature is internal only.

## Open Questions
Decisions a human must resolve before implementation.

Write the brief in English. Never reference ticket files or ADR numbers from code snippets, branch names, or commit examples.
