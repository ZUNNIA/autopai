---
description: Discuss a feature and, after explicit confirmation, generate its brief and backlog
agent: autopai
---

Start or continue the feature discussion. This command has two stages and never skips the discussion.

The user request: $ARGUMENTS

## Stage 1: discuss

- A feature idea, a question, or "quiero implementar..." starts a discussion. Do not run the CLI.
- If the user asks for an opinion or says not to generate, discuss and stop.
- Read the repository only when needed. Do not write files or state.
- Discuss the problem, target user, desired behavior, scope, non-goals, providers and models, canonical parameters, persistence, UX, acceptance criteria, dependencies and risks.
- Ask at most five highest-leverage questions in the first round and wait for the answers. Follow up only with questions whose answers change the plan. Do not dump a wall of questions.
- Propose a short kebab-case feature name for the `--feature` option.
- End each discussion round with a concise agreed summary and the open points. Do not run prepare.

## Stage 2: generate

Run prepare only when the user explicitly asks to generate, formalize or prepare the brief and backlog, or explicitly confirms the summary. Examples: "genera el brief y el backlog", "formaliza la feature", "prepara el plan", "adelante con el backlog".

- If no agreed summary exists, ask for the idea and stay in Stage 1.
- Summarize problem, scope, decisions, non-goals and acceptance in a concise `--description`.
- Use the agreed short feature name with `--feature <slug>`. If none is agreed, propose one and use it after confirmation. Do not let the description become an 80-character slug.
- Use the bash tool with a timeout of at least 14400000 ms:

`autopai run --repo . --from prepare --to prepare <composed arguments>`

Report the CLI output verbatim and the backlog path. The orchestrator writes the brief and the backlog and stops at the backlog gate.

Never approve the backlog on the user's behalf. The next step is a human decision: review the brief and backlog, then run `/autopai-resume --approve backlog` to generate the ready-for-dev plan.
