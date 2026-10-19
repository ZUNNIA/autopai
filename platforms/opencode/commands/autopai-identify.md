---
description: Audit recent work and generate ready-for-refactor tickets
agent: setup
---

Run AutopAI in identify mode, then promote the findings into ready-for-refactor tickets.

The user request: $ARGUMENTS

Compose the CLI arguments from the request (see the interpreting rules):

- "the last N branches/PRs merged" → `--last N`.
- A specific pull request → `--scope pr:<n>`; a branch → `--scope branch:<name>`; a directory → `--scope dir:<path>`.
- Nothing → no scope arguments: the orchestrator audits the pull requests of the last run.

Confirm the resolved scopes when the interpretation is not obvious.

Use the bash tool with a timeout of at least 3600000 ms:

`autopai run --repo . --from identify --to promote <composed arguments>`

The auditor writes local findings under `tickets/identified/`, and the planner turns every finding into a ticket under `tickets/ready-for-refactor/`. The auditor never edits source and never creates a diagnostic report. Report the CLI output verbatim and the produced ticket paths. If the command fails, report the exact error and stop.
