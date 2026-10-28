---
description: Create or update an architecture decision record
agent: autopai
---

Create or update an Architecture Decision Record.

The user request: $ARGUMENTS

Steps:

1. Read the context that triggers the decision: a blocker under `tickets/.autopai/needs-human/`, a ready-for-dev ticket, or the user's request and this conversation.
2. Identify the technical problem and analyze at least two alternatives, including "do nothing" or "keep the current standard".
3. If the decision is not already stated, present the alternatives and ask which one to record.
4. Write the ADR to the repository ADR directory (the repository `AGENTS.md` states the convention; `tickets/adr/` by default), incrementing the highest existing number (`004-short-name.md`).
5. Run `autopai status --repo .` and report the mode, phase, gate, blockers, and failures. Do not approve a gate, start a phase, or run resume from this command. If the user also asked to continue, give the exact next command. For a blocked dev run, that is a plain `/autopai-resume` after the blocker is resolved; never pass `--approve plan` when the plan was already approved.

Document structure:

## 1. Title, Status & Category
* Title, Status (Proposed | Accepted | Deprecated | Superseded), Category with a one-sentence justification.

## 2. Context
* The problem and the constraints.

## 3. Options Considered
* Each option with its pros and cons.

## 4. Decision
* The chosen path and why it beat the alternatives.

## 5. Consequences
* Positive impact, negative impact or risks, and action items.

Rules:

- Never delete an accepted ADR. To change a decision, create a new ADR and mark the old one as superseded by the new one.
- One ADR, one decision. No code in the ADR.
- Do not reference ticket files or ADR numbers from code, commits, branches, or pull requests.
- Report the created or updated file paths when done.
