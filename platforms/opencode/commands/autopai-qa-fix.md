---
description: Turn a failed manual QA review into fix tickets and restart dev
agent: autopai
---

Use this command only when the user reports a failed manual QA item.

1. Run `autopai status --repo .` and confirm the current gate is `qa` and `canApprove` is true.
2. Ask for the exact failed QA item if it was not provided.
3. Run:

```text
autopai qa-fix --repo . --message "<failure>"
```

4. Report the CLI output verbatim, including the created fix tickets, the new dev result, and any billing report.
5. Do not pass `--approve qa` and do not start a new feature or brief.
