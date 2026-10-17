---
description: Resume the last autopilot run
agent: setup
---

Run with the bash tool and a timeout of at least 3600000 ms:

`node "{{AUTOPILOT_HOME}}/src/cli.js" resume --repo . $ARGUMENTS`

Report the CLI output verbatim. If the command fails, report the exact error and stop.
