---
description: Prepare, merge, and tag a release through AutopAI
agent: autopai
---

Run AutopAI in release mode.

The user request: $ARGUMENTS

This command only prepares and ships a release. If the request is not a release, stop before running anything and name the right command: use `/autopai-refactor` to resolve technical debt or drain the ready-for-refactor queue, `/autopai-identify` to audit, and `/autopai-resume` to continue a stopped run. Do not ask for a version when the request is not a release, and do not switch to another phase from this command without the user's explicit confirmation.

Compose the CLI arguments from the request (see the interpreting rules):

- A version in the request → `--version <x.y.z>`.
- A release intent without a version → ask for it; you may read the repository version manifest to propose the next semantic version.
- Anything else → stop and redirect; never run release.

Use the bash tool with a timeout of at least 14400000 ms:

`autopai run --repo . --from release --to release <composed arguments>`

The orchestrator updates the version and the changelog, opens the release pull request, waits for the required checks, merges, and tags the release. Report the output verbatim. If the command fails, report the exact error and stop.
