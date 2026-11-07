---
description: Turn identified findings into ready-for-refactor tickets
agent: autopai
---

Promote the findings from the last audit.

Compose the CLI arguments from the request:

- A feature or refactor batch -> `--feature <slug>`.
- A debt classification -> `--classification <name>`.
- A priority -> `--priority <name>`.
- No restriction -> no filter arguments.

Run:

```text
autopai promote --repo . <composed arguments>
```

Promotion writes local ready-for-refactor tickets; it does not create branches, commits, pull requests, or source changes. It uses the findings from the last audit. If there are no findings, report that and offer to run identify first. Do not run identify automatically unless the user asks for an audit.
