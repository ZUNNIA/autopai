---
description: Generate a brief and a backlog through the autopilot
agent: setup
---

Run the orchestrator with the bash tool and a timeout of at least 3600000 ms:

`ai-autopilot run --from prepare --to prepare --feature <slug> --description "<idea>" $ARGUMENTS`

The orchestrator writes the feature brief and the backlog, then stops for review. Report the output verbatim and the backlog path.
