---
description: Discuss a feature and, after explicit confirmation, generate its brief and backlog
agent: autopai
---

Start or continue the feature discussion. This command has two stages and never skips the discussion.

The user request: $ARGUMENTS

## Stage 1: discuss

- A feature idea, a design question, or a request to explore a feature starts a discussion. Do not run prepare or any generation CLI; `plan propose` only records the agreed summary.
- If the user asks for an opinion or says not to generate, discuss and stop.
- Read the repository only when needed. Do not write files or state.
- Discuss the problem, target user, desired behavior, scope, non-goals, providers and models, canonical parameters, persistence, UX, acceptance criteria, dependencies and risks.
- Ask as many questions as the plan needs. Group them by topic and ask only questions whose answers change the plan. There is no fixed limit. Ask them in the conversation; never write them into the brief or backlog.
- Propose a short kebab-case feature name for the `--feature` option.
- End each discussion round with a concise agreed summary and the open points.
- When the founder accepts the summary, record it without generating artifacts:

`autopai plan propose --repo . --feature <slug> --description "<agreed summary>"`

## Stage 2: generate

Run prepare only when the user explicitly asks to generate, formalize or prepare the brief and backlog, or explicitly confirms the discussed summary. Do not infer generation from a wish to implement the feature or from a general description.

- If no agreed summary or proposal exists, ask for the idea and stay in Stage 1.
- Use the agreed short feature name with `--feature <slug>`. If none is agreed, propose one and use it after confirmation.
- Generate only after explicit confirmation, using the proposal recorded in Stage 1:

`autopai plan generate --repo . --feature <slug> --confirm`

The CLI refuses generation without `--confirm` or without a matching proposal. It runs prepare, stops at the backlog gate, and clears the proposal after the artifacts are written.

Report the CLI output verbatim, the backlog path, the retained brief and backlog session titles and ids, any `plannerMessages` questions, and any `billingReports` with billing `increase` or `unknown`. The orchestrator writes the brief and the backlog and stops at the backlog gate; both review sessions stay open.

For a change request while the backlog awaits review, run `autopai revise --repo . --message "<change>"` or use `--message-file <path>` for multi-line text. It continues the retained backlog session without loading a prompt from `src/prompts` or creating a new session. Do not tell the user to paste the change, do not run prepare again, and do not edit tickets yourself. Report the planner output and any open questions. The orchestrator deletes the two sessions only after the backlog approval succeeds.

If the run is already paused at the plan gate and the user requests a change to the ready-for-dev tickets, run `autopai revise-plan --repo . [--feature <slug>] [--ticket <id>] [--message "<change>"|--message-file <path>]`. Use `--message-file` for multi-line text. It edits the existing plan in place, validates it, and stays at the plan gate. With `--ticket`, only that ticket may change. Use `--include-summary` only after the founder explicitly authorizes reconciling the current feature's brief and backlog; it cannot be combined with `--ticket` and the core validates those documents. Do not regenerate the whole plan with `approve`, do not edit tickets yourself, and never approve the plan.

Never approve the backlog on the user's behalf. The next step is a human decision: review the brief and backlog, then run `/autopai-resume --approve backlog` to generate the ready-for-dev plan.
