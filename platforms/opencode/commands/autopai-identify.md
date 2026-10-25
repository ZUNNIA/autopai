---
description: Audit recent work and generate ready-for-refactor tickets
agent: autopai
---

Run AutopAI in identify mode, then promote the findings into ready-for-refactor tickets.

The user request: $ARGUMENTS

Compose the CLI arguments from the request (see the interpreting rules):

- "the last N branches/PRs merged" → `--last N`.
- A specific pull request → `--scope pr:<n>`; a branch → `--scope branch:<name>`.
- A folder → `--scope dir:<path>`; the whole project → `--scope dir:.`.
- Nothing → no scope arguments: the orchestrator audits the pull requests of the last run.

Directory audits are chunked automatically (ignored paths are skipped and large trees split into bounded sessions). Confirm the resolved scopes when the interpretation is not obvious.

Starting identify explicitly approves the manual QA gate. If the user has not reviewed `tickets/qa/<feature>.md`, stop and ask them to review it first.

Use the bash tool with a timeout of at least 14400000 ms:

`autopai run --repo . --from identify --to promote <composed arguments>`

The auditor writes local findings under `tickets/identified/`, and the planner turns every finding into a ticket under `tickets/ready-for-refactor/`. The auditor never edits source and never creates a diagnostic report. Report the CLI output verbatim and the produced ticket paths. If the command fails, report the exact error and stop.

If the `findings` gate is configured, the command stops after the audit; continue with `/autopai-resume --approve findings`. If the `promotion` gate is configured, review the ready-for-refactor tickets and continue with `/autopai-resume --approve promotion`. If the promotion is interrupted after some chunks (network loss or timeout), continue with `autopai promote --repo . --feature <feature> --chunk <name>` or `autopai resume`: completed chunks are skipped and identify is never repeated.
