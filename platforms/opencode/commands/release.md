---
description: Prepare, merge, and tag a release through the autopilot
agent: setup
---

Run the orchestrator with the bash tool and a timeout of at least 3600000 ms:

`ai-autopilot run --from release --to release --version <x.y.z> $ARGUMENTS`

The orchestrator updates the version and the changelog, opens the release pull request, waits for the required checks, merges, and tags the release. Report the output verbatim.
