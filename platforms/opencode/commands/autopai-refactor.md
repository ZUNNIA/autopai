---
description: Execute ready-for-refactor tickets through AutopAI
agent: autopai
---

Run AutopAI in refactor mode.

The user request: $ARGUMENTS

Starting refactor explicitly approves the promotion gate. If the user has not reviewed the ready-for-refactor tickets, stop and ask them to review them first.

Compose the CLI arguments from the request (see the interpreting rules):

- A named feature or refactor batch → `--feature <slug>` (filters by the ticket front matter).
- A debt classification → `--classification <name>`. Accepted names: `code-smell`, `unnecessary-complexity`, `lack-of-coverage`, `outdated-library`, `architecture`, `missing-documentation`.
- A priority or importance → `--priority <name>`: `urgent`, `important`, or `minor`.
- A restriction phrase combines the two flags. Multiple values are comma-separated and mean OR; classification and priority combine with AND. For example, "only lack-of-coverage tickets" → `--classification lack-of-coverage`; "missing documentation with minor priority" → `--classification missing-documentation --priority minor`; "only urgent tickets" → `--priority urgent`.
- Never map a classification or priority to `--feature`: all tech-debt tickets usually share the `tech-debt` feature.
- "Resolve all the technical debt", "clear the refactor queue", or nothing → no filter arguments: the orchestrator drains the ready-for-refactor queue.
- "Fix the failures and continue" when a run stopped on failed tickets → use `/autopai-resume --fix` instead; it reuses the failed branches and retries the gates.

The filter only selects pending tickets. If none matches, report zero; do not drain the rest. If a selected ticket depends on a pending ticket outside the filter, the run stops and lists the dependency; tell the user to include it or remove the filter. Filters persist through `/autopai-resume`.

Use the bash tool with a timeout of at least 14400000 ms:

`autopai run --repo . --from refactor --to refactor <composed arguments>`

The orchestrator implements each selected ticket in order, reuses an existing ticket branch when it already has commits, retries local gates once, and merges each pull request only after the required checks pass. If a ticket still fails, it records the failure and continues with independent tickets. Report the output verbatim. If the command fails, report the exact error and stop.
