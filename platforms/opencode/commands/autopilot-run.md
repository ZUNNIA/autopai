---
description: Run a custom autopilot phase range
agent: setup
---

Run the external autopilot with a custom phase range.

Use the bash tool with a timeout of at least 3600000 ms:

`node "{{AUTOPILOT_HOME}}/src/cli.js" run --repo . $ARGUMENTS`

Examples:

- `--from prepare --to prepare --feature <slug> --description "<idea>"`
- `--from approve --to dev --feature <slug>`
- `--from identify --to identify --scope branch:<name>`
- `--from refactor --to refactor --feature <slug>`
- `--from release --to release --version 1.2.3`
- `--from adopt --to adopt --branch <name>`

Report the CLI output verbatim. If the command fails, report the exact error and stop.
