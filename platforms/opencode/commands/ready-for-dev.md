---
description: Generate ready-for-dev tickets and run the development loop
agent: setup
---

Run the orchestrator with the bash tool and a timeout of at least 3600000 ms:

`ai-autopilot run --from approve --to dev --feature <slug> $ARGUMENTS`

The orchestrator generates the tickets, implements them one by one, and merges each pull request only after the required checks pass. Report the output verbatim.
