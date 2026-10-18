---
description: Execute ready-for-refactor tickets through AutopAI
agent: setup
---

Run AutopAI in refactor mode.

Use the bash tool with a timeout of at least 3600000 ms:

`autopai run --repo . --from refactor --to refactor $ARGUMENTS`

The feature defaults to the last ready-for-refactor directory when `--feature` is omitted. The orchestrator implements each ticket in order and merges each pull request only after the required checks pass. Report the output verbatim. If the command fails, report the exact error and stop.
