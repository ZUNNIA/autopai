---
description: Generate ready-for-dev tickets and run the development loop
agent: setup
---

Run AutopAI from approve to dev.

Use the bash tool with a timeout of at least 3600000 ms:

`autopai run --repo . --from approve --to dev $ARGUMENTS`

The feature defaults to the last backlog when `--feature` is omitted. The orchestrator generates the ready-for-dev tickets, implements them one by one, merges each pull request only after the required checks pass, and writes the pending manual verification checks to `tickets/qa/`. Report the output verbatim. If the command fails, report the exact error and stop.
