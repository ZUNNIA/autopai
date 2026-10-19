---
description: Adopt a branch and drive it to a green merge
agent: setup
---

Run AutopAI in adopt mode.

The user request: $ARGUMENTS

Compose the CLI arguments from the request (see the interpreting rules):

- A branch name → `--branch <name>`.
- "my current branch" or nothing → no arguments: the orchestrator adopts the current branch.

Use the bash tool with a timeout of at least 3600000 ms:

`autopai adopt --repo . <composed arguments>`

The command finishes the branch: it fixes policy violations, runs local gates, pushes, opens the pull request, waits for the required CI checks, and merges only when they pass. It never force-pushes and never merges with failing checks.

Report the CLI output verbatim. If the command fails, report the exact error and stop.
