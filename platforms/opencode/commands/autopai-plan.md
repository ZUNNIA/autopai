---
description: Plan a feature from this conversation or a short description
agent: setup
---

Run AutopAI in prepare mode.

The user request: $ARGUMENTS

Compose the CLI arguments from the request (see the interpreting rules):

- An idea described in the request → use it as the description.
- A reference to this conversation ("what we just discussed") → summarize the agreed feature (problem, scope, decisions) into a concise description.
- Neither → ask for the idea.

Use the bash tool with a timeout of at least 3600000 ms:

`autopai run --repo . --from prepare --to prepare <composed arguments>`

Do not pass `--feature` unless the user named one; the orchestrator derives the slug from the description. The orchestrator writes the brief and the backlog and stops for human review. Report the output verbatim and the backlog path. If the command fails, report the exact error and stop.
