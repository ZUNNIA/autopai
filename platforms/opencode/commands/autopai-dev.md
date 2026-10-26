---
description: Implement the approved ready-for-dev tickets
agent: autopai
---

Run AutopAI in dev mode.

The user request: $ARGUMENTS

Compose the CLI arguments from the request (see the interpreting rules):

- A named backlog or feature → `--feature <slug>`.
- Nothing → no arguments: the orchestrator uses the last ready-for-dev directory.

Use the bash tool with a timeout of at least 14400000 ms:

`autopai run --repo . --from dev --to dev <composed arguments>`

The ready-for-dev tickets must exist. If the plan has not been generated yet, tell the user to approve the backlog first with `/autopai-resume --approve backlog`. Starting dev is the explicit approval of the ready-for-dev plan gate. The orchestrator implements the tickets one by one, reuses an existing ticket branch when it already has commits, retries local gates once, merges each pull request only after the required checks pass, and writes the pending manual verification checks to `tickets/qa/`. If a ticket still fails, it records the failure, continues with independent tickets, and reports the failed branches. Tell the user to run `/autopai-resume --fix` for a repair attempt or `/autopai-resume` to retry. Report the output verbatim. If the command fails, report the exact error and stop.
