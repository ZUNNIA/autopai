---
description: Execute ready-for-refactor tickets through AutopAI
agent: setup
---

Run AutopAI in refactor mode.

The user request: $ARGUMENTS

Compose the CLI arguments from the request (see the interpreting rules):

- A named feature or refactor batch → `--feature <slug>`.
- Nothing → no arguments: the orchestrator uses the last ready-for-refactor directory.

Use the bash tool with a timeout of at least 3600000 ms:

`autopai run --repo . --from refactor --to refactor <composed arguments>`

The orchestrator implements each ticket in order and merges each pull request only after the required checks pass. Report the output verbatim. If the command fails, report the exact error and stop.
