---
description: Abort the current AutopAI run
agent: autopai
---

Abort the current AutopAI run only after the user explicitly confirms.

1. Run `autopai status --repo .` and report the current mode, phase, gate, and failures.
2. Confirm that the user wants to stop the run.
3. Run:

```text
autopai abort --repo .
```

4. Report the CLI output verbatim. Abort marks the local state as aborted and releases the lock; it does not touch the repository or the remote.
