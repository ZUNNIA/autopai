---
description: Continue the last AutopAI run until the next human gate
agent: autopai
---

Before composing the command, run `autopai status --repo .` and read its `gate`. If `gate` is null, do not pass `--approve`; report the phase, failures, and blockers instead. A failed ticket or a blocker is not a human gate: use a plain `autopai resume` retry after the blocker is resolved.

If the user reports a failed manual QA item while the gate is `qa`, do not use `resume` or `--approve qa`; use `autopai qa-fix --message "<failure>"` to create fix tickets and restart dev.

Run with the bash tool and a timeout of at least 14400000 ms:

`autopai resume --repo . $ARGUMENTS`

If the run is paused at a human gate, report the gate, the artifacts to review, and the exact approval command. A generic "continue" is **not** approval: never pass `--approve` unless the user explicitly approves that gate by name and the status reports it. If the user says only "continue", report the gate and ask.

Compose the arguments from the request:

- "approve the backlog and continue" → `--approve backlog`. After the ready-for-dev generation succeeds, the orchestrator deletes the retained brief and backlog sessions; if it fails, keep them for review.
- "approve the plan" or "approve ready-for-dev" → `--approve plan`.
- "approve QA" → `--approve qa` only when the QA passed. If the user reports a QA failure, do not approve; the operator uses `autopai qa-fix --message "<failure>"` to create fix tickets and restart dev.
- "approve the findings" → `--approve findings`.
- "approve the refactor tickets" → `--approve promotion`.
- "approve the refactor" → `--approve refactor`.
- "continue without stopping" or "run everything" → `--auto`, only after confirming.
- "stop only at ..." → `--pause-after <gates>`.
- "fix the failures and continue" or a request to repair failed tickets → `--fix`. The orchestrator reuses each failed ticket branch, retries the local gates, and runs one executor fix attempt before recording the failure and continuing.
- "continue", "resume", or "keep going" → no flags. It resumes the interrupted phase, reuses existing ticket branches, and retries local gates once.
- A debt filter from the identify, promotion, or failed refactor is stored in the run state. `resume` keeps it, so do not pass classification or priority again and do not silently widen the run to every pending ticket.

A failed ticket is not a human gate: do not pass `--approve` for it. If the run stopped because tickets failed, report the failed tickets and their branches, then tell the user to run `/autopai-resume` for a plain retry or `/autopai-resume` with a fix request. The examples are illustrative; understand the intent and do not require a fixed phrase.

The gates are `backlog`, `plan`, `qa`, `findings`, `promotion`, and `refactor`. The default pause list is `backlog`, `plan`, and `qa`. Approving one gate does not approve the next: the run stops at the next configured gate. Report the CLI output verbatim. If the command fails, report the exact error and stop.
