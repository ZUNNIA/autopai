---
description: Adopt an existing branch and drive it to a green merge
agent: setup
---

Run the external autopilot in adopt mode.

Use the bash tool with a timeout of at least 3600000 ms:

`node "{{AUTOPILOT_HOME}}/src/cli.js" adopt --repo . $ARGUMENTS`

The command finishes the current or given branch: it fixes policy violations, runs local gates, pushes, opens the pull request, waits for the required CI checks, and merges only when they pass. It never force-pushes and never merges with failing checks.

Report the CLI output verbatim. If the command fails, report the exact error and stop.
