---
description: Run a custom AutopAI phase range
agent: autopai
---

Run AutopAI with a custom phase range.

Use the bash tool with a timeout of at least 14400000 ms:

`autopai run --repo . $ARGUMENTS`

Examples:

- `--from prepare --to prepare --description "<idea>"`
- `--from prepare --to refactor`
- `--from approve --to dev`
- `--from identify --to identify --scope branch:<name> --classification code-smell --priority urgent`
- `--from refactor --to refactor --classification lack-of-coverage`
- `--from refactor --to refactor --classification missing-documentation --priority minor`
- `--from release --to release --version 1.2.3`
- `--from adopt --to adopt --branch <name>`
- `--from prepare --to refactor --auto`
- `--from prepare --to refactor --pause-after backlog,qa`

The phase range starts at the phase the user chose. Starting a phase explicitly approves the gate before it; the gates after it still apply. A run that reaches a pause exits successfully and reports the gate; it does not approve it. To approve, run `/autopai-resume --approve <gate>`.

The default pause list is `backlog`, `plan`, and `qa`. `--auto` skips every human pause. `--pause-after` overrides the list for this run. The automatic gates (local commands, CI, policy) always run.

A failed ticket is recorded and the loop continues with independent tickets. Its branch is reused on the next run. Add `--fix` to run one executor repair attempt for a local gate failure before recording it. The run stops with the failure summary; tell the user to run `/autopai-resume --fix` to repair or `/autopai-resume` to retry.

The feature and scope arguments are optional: prepare, approve, and dev resolve them from the previous run state or the latest ticket directory, and identify audits the scopes recorded by the last run when no scope is given. Refactor drains the ready-for-refactor queue unless `--feature` filters it by front matter. `--classification` and `--priority` restrict the debt audit, its promotion, and the pending refactor queue; they accept comma-separated values and combine with AND. If none matches, report zero. If a selected ticket depends on a pending ticket outside the filter, report the dependency error. Report the CLI output verbatim. If the command fails, report the exact error and stop.
