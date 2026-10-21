# Platform adaptation

The orchestrator only needs two things from a coding tool: a non-interactive session that accepts a prompt, and a permission model that keeps the executor away from Git writes and protected paths. Everything else is platform glue.

## Runner interface

The core never imports a concrete coding tool. It calls `runSession` from `src/lib/session.js`, which loads a core-owned prompt from `src/prompts/` and resolves the runner declared in `autopai.json`. `runner` is required; the installation provides the bundled `opencode` runner.

A runner module exports `runSession({ config, agent, promptText, title, logFile, role })` and maps the call to its CLI. Adding a tool means adding `src/runners/<name>.js` and one entry to the map in `src/runners/index.js`. The prompts, phases, state, policy, and merge logic stay unchanged.

## Bundled platform

The repository includes one bundled platform as a reference implementation:

- Agents: `platforms/opencode/agents/*.md`, installed in `~/.config/opencode/agents/`. The executor, planner, and auditor use `mode: all` with `hidden: true`, so the CLI can invoke them by name while the tool selector shows only the operator agent (`autopai`).
- Commands: `platforms/opencode/commands/*.md`, installed in `~/.config/opencode/commands/`. These are manual wrappers that call `autopai`.
- Natural language: the command files let the operator agent translate a request in any language into the deterministic flags, confirming ambiguous interpretations before running.
- Session: `opencode run --agent <agent> --auto --dir <repo>`. The rendered prompt travels through stdin (a copy is written next to the session log for debugging), so the command line never carries it and large payloads cannot overflow the OS argument limit.
- Session cleanup: after each run the runner deletes the opencode session it created, because the full transcript already lives in the run artifacts. The title carries a random per-run token and only an unambiguous match is deleted; if the match is not unique, nothing is deleted. Set `runnerOptions.keepSessions` to true to keep the sessions in the tool history.
- Permissions: path-scoped `edit` rules and command patterns under `bash`.
- Global rules: the repository `AGENTS.md`.

## Adding another tool

Do not assume feature parity. Recreate the roles with the capabilities of the target tool:

1. Find the non-interactive session command and its working directory, model, and approval or sandbox flags.
2. Map the four roles (`executor`, `planner`, `auditor`, `operator`) to the tool's agent, skill, or system-prompt mechanism.
3. Recreate the protected-path rules with the tool's permission model when it has one. When it does not, rely on the orchestrator diff verification.
4. Block `git push`, `git merge`, rebase, force-push, and the Git host merge command in the executor session.
5. Confirm the tool accepts a prompt supplied by the orchestrator at session start. It must not require prompts registered inside the tool.
6. Run the verification checklist in `BOOTSTRAP_PROMPT.md` before trusting the port.
