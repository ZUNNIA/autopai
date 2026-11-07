---
description: Inspect or repair build diagnostics
agent: autopai
---

Inspect compiler and restore diagnostics for the repository.

For a read-only report:

```text
autopai diagnostics --repo .
```

Use `--severity info` only when the user explicitly asks for info messages.

For a repair, confirm the request first and run:

```text
autopai diagnostics --repo . --severity error,warning --fix
```

The repair creates a dedicated diagnostics branch, asks one executor to fix the selected diagnostics, and adopts the branch through the normal gates and pull request flow. Report the CLI output verbatim, including any remaining diagnostics and the branch or pull request. Do not commit, push, or merge manually.
