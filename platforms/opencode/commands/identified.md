---
description: Audit scopes and write local Identified tickets through AutopAI
agent: setup
---

Run the orchestrator with the bash tool and a timeout of at least 3600000 ms:

`autopai identify --repo . --scope branch:<name> --scope pr:<number> $ARGUMENTS`

The auditor is read-only over source and UX. It writes only local tickets under `tickets/identified/` and never creates a diagnostic report. Report the output verbatim and the produced ticket paths.
