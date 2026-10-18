---
description: Generate a feature brief and a backlog through AutopAI
agent: setup
---

Run AutopAI in prepare mode.

Use the bash tool with a timeout of at least 3600000 ms:

`autopai run --repo . --from prepare --to prepare $ARGUMENTS`

The feature slug defaults to a slug of the description when `--feature` is omitted. The orchestrator writes the brief and the backlog and stops for human review. Report the output verbatim and the backlog path. If the command fails, report the exact error and stop.
