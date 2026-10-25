---
description: Execute ready-for-refactor tickets through AutopAI
agent: autopai
---

Run AutopAI in refactor mode.

The user request: $ARGUMENTS

Starting refactor explicitly approves the promotion gate. If the user has not reviewed the ready-for-refactor tickets, stop and ask them to review them first.

Compose the CLI arguments from the request (see the interpreting rules):

- A named feature or refactor batch → `--feature <slug>` (filters by the ticket front matter).
- Nothing → no arguments: the orchestrator drains the ready-for-refactor queue.

Use the bash tool with a timeout of at least 14400000 ms:

`autopai run --repo . --from refactor --to refactor <composed arguments>`

The orchestrator implements each ticket in order and merges each pull request only after the required checks pass. Report the output verbatim. If the command fails, report the exact error and stop.
