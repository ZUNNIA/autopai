---
description: Continue the last AutopAI run until the next human gate
agent: autopai
---

Run with the bash tool and a timeout of at least 14400000 ms:

`autopai resume --repo . $ARGUMENTS`

If the run is paused at a human gate, report the gate, the artifacts to review, and the exact approval command. A generic "continue" is **not** approval: never pass `--approve` unless the user explicitly approves that gate by name. If the user says only "continue", report the gate and ask.

Compose the arguments from the request:

- "approve the backlog and continue" → `--approve backlog`.
- "approve the plan" or "approve ready-for-dev" → `--approve plan`.
- "approve QA" → `--approve qa`.
- "approve the findings" → `--approve findings`.
- "approve the refactor tickets" → `--approve promotion`.
- "approve the refactor" → `--approve refactor`.
- "continue without stopping" or "run everything" → `--auto`, only after confirming.
- "stop only at ..." → `--pause-after <gates>`.

The gates are `backlog`, `plan`, `qa`, `findings`, `promotion`, and `refactor`. The default pause list is `backlog`, `plan`, and `qa`. Approving one gate does not approve the next: the run stops at the next configured gate. Report the CLI output verbatim. If the command fails, report the exact error and stop.
