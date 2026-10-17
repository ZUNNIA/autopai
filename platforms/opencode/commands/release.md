---
description: Prepare, merge, and tag a release through AutopAI
agent: setup
---

Run the orchestrator with the bash tool and a timeout of at least 3600000 ms:

`autopai run --from release --to release --version <x.y.z> $ARGUMENTS`

The orchestrator updates the version and the changelog, opens the release pull request, waits for the required checks, merges, and tags the release. Report the output verbatim.
