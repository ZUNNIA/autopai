---
description: Run a custom AutopAI phase range
agent: autopai
---

Run AutopAI with a custom phase range.

Use the bash tool with a timeout of at least 14400000 ms:

`autopai run --repo . $ARGUMENTS`

Examples:

- `--from prepare --to prepare --description "<idea>"`
- `--from approve --to dev`
- `--from identify --to promote`
- `--from identify --to identify --scope branch:<name>`
- `--from refactor --to refactor`
- `--from release --to release --version 1.2.3`
- `--from adopt --to adopt --branch <name>`

The feature and scope arguments are optional: prepare, approve, and dev resolve them from the previous run state or the latest ticket directory, and identify audits the scopes recorded by the last run when no scope is given. Refactor drains the ready-for-refactor queue unless `--feature` filters it by front matter. Report the CLI output verbatim. If the command fails, report the exact error and stop.
