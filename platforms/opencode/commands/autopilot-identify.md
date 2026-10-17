---
description: Audit one or more scopes and write local Identified tickets
agent: setup
---

Run the external autopilot in identify mode.

Use the bash tool with a timeout of at least 3600000 ms:

`node "{{AUTOPILOT_HOME}}/src/cli.js" identify --repo . $ARGUMENTS`

Scopes are passed as `--scope branch:<name>`, `--scope pr:<number>`, or `--scope dir:<path>`. The auditor is read-only over source and UX; it writes only local tickets under `tickets/identified/` and never creates a diagnostic report.

Report the CLI output verbatim and the produced ticket paths. If the command fails, report the exact error and stop.
