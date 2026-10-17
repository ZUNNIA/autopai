---
description: Execute ready-for-refactor tickets through AutopAI
agent: setup
---

Run the orchestrator with the bash tool and a timeout of at least 3600000 ms:

`autopai run --from refactor --to refactor --feature <slug> $ARGUMENTS`

The orchestrator reads the local refactor tickets, implements them in order, and merges each pull request only after the required checks pass. Report the output verbatim.
