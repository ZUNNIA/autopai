---
description: Prepare, merge, and tag a release through AutopAI
agent: setup
---

Run AutopAI in release mode.

Use the bash tool with a timeout of at least 3600000 ms:

`autopai run --repo . --from release --to release --version <x.y.z> $ARGUMENTS`

The version is required. The orchestrator updates the version and the changelog, opens the release pull request, waits for the required checks, merges, and tags the release. Report the output verbatim. If the command fails, report the exact error and stop.
