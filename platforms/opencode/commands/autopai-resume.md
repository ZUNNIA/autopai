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
- "fix the failures and continue", "arregla los fallos y continúa", or a request to repair failed tickets → `--fix`. The orchestrator reuses each failed ticket branch, retries the local gates, and runs one executor fix attempt before recording the failure and continuing.
- "continue", "resume", or "keep going" → no flags. It resumes the interrupted phase, reuses existing ticket branches, and retries local gates once.

A failed ticket is not a human gate: do not pass `--approve` for it. If the run stopped because tickets failed, report the failed tickets and their branches, then tell the user to run `/autopai-resume` for a plain retry or `/autopai-resume` with a fix request. The examples are illustrative; understand the intent and do not require a fixed phrase.

The gates are `backlog`, `plan`, `qa`, `findings`, `promotion`, and `refactor`. The default pause list is `backlog`, `plan`, and `qa`. Approving one gate does not approve the next: the run stops at the next configured gate. Report the CLI output verbatim. If the command fails, report the exact error and stop.
