---
description: Prepare, merge, and tag a release through AutopAI
agent: setup
---

Run AutopAI in release mode.

The user request: $ARGUMENTS

Compose the CLI arguments from the request (see the interpreting rules):

- A version in the request → `--version <x.y.z>`.
- No version → ask for it; you may read the repository version manifest to propose the next semantic version.

Use the bash tool with a timeout of at least 3600000 ms:

`autopai run --repo . --from release --to release <composed arguments>`

The orchestrator updates the version and the changelog, opens the release pull request, waits for the required checks, merges, and tags the release. Report the output verbatim. If the command fails, report the exact error and stop.
