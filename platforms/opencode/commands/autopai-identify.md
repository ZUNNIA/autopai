---
description: Audit the last implementation and generate ready-for-refactor tickets
agent: setup
---

Run AutopAI in identify mode, then promote the findings into ready-for-refactor tickets.

Use the bash tool with a timeout of at least 3600000 ms:

`autopai run --repo . --from identify --to promote $ARGUMENTS`

Scopes default to the pull requests of the last dev, refactor, or adopt run; pass `--scope branch:<name>`, `--scope pr:<number>`, or `--scope dir:<path>` to audit something else. The auditor writes local findings under `tickets/identified/`, and the planner turns every finding into a ticket under `tickets/ready-for-refactor/`. The auditor never edits source and never creates a diagnostic report. Report the CLI output verbatim and the produced ticket paths. If the command fails, report the exact error and stop.
