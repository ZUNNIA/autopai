---
description: Discuss a feature and, after explicit confirmation, generate its brief and backlog
agent: autopai
---

Start or continue the feature discussion. This command has two stages and never skips the discussion.

The user request: $ARGUMENTS

## Stage 1: discuss

- A feature idea, a design question, or a request to explore a feature starts a discussion. Do not run the CLI.
- If the user asks for an opinion or says not to generate, discuss and stop.
- Read the repository only when needed. Do not write files or state.
- Discuss the problem, target user, desired behavior, scope, non-goals, providers and models, canonical parameters, persistence, UX, acceptance criteria, dependencies and risks.
- Ask as many questions as the plan needs. Group them by topic and ask only questions whose answers change the plan. There is no fixed limit. Ask them in the conversation; never write them into the brief or backlog.
- Propose a short kebab-case feature name for the `--feature` option.
- End each discussion round with a concise agreed summary and the open points. Do not run prepare.

## Stage 2: generate

Run prepare only when the user explicitly asks to generate, formalize or prepare the brief and backlog, or explicitly confirms the discussed summary. Do not infer generation from a wish to implement the feature or from a general description.

- If no agreed summary exists, ask for the idea and stay in Stage 1.
- Summarize problem, scope, decisions, non-goals and acceptance in a concise `--description`.
- Use the agreed short feature name with `--feature <slug>`. If none is agreed, propose one and use it after confirmation. Do not let the description become an 80-character slug.
- Use the bash tool with a timeout of at least 14400000 ms:

`autopai run --repo . --from prepare --to prepare <composed arguments>`

Report the CLI output verbatim, the backlog path, the retained brief and backlog session titles and ids, and any `plannerMessages` questions. The orchestrator writes the brief and the backlog and stops at the backlog gate; both review sessions stay open.

For a change request while the backlog awaits review, run `autopai revise --repo . --message "<change>"`. It continues the retained backlog session without loading a prompt from `src/prompts` or creating a new session. Do not tell the user to paste the change, do not run prepare again, and do not edit tickets yourself. Report the planner output and any open questions. The orchestrator deletes the two sessions only after the backlog approval succeeds.

Never approve the backlog on the user's behalf. The next step is a human decision: review the brief and backlog, then run `/autopai-resume --approve backlog` to generate the ready-for-dev plan.
