# Platform adaptation

The orchestrator only needs two things from a coding tool: a non-interactive session that accepts a prompt, and a permission model that keeps the executor away from Git writes and protected paths. Everything else is platform glue. The built-in `command` runner covers any CLI whose prompt can travel through stdin, a file, or an argument, so most tools need configuration instead of a new JavaScript module.

## Runner interface

The core never imports a concrete coding tool. It calls `runSession` from `src/lib/session.js`, which loads a core-owned prompt from `src/prompts/` and resolves the runner declared in `autopai.json`. `runner` is required. The installation provides `opencode` and the generic `command` runner.

A runner module exports `runSession({ config, agent, promptText, title, logFile, role })` and maps the call to its CLI. Most tools should use `runner: "command"` and configure the invocation in `runnerOptions`. A new module in `src/runners/<name>.js` is only needed when the tool requires a protocol that argv templates cannot express. The prompts, phases, state, policy, and merge logic stay unchanged.

## Generic command runner

The `command` runner maps every session to argv arrays and never uses a shell. Prompts can travel through stdin, a file path, or a direct argument.

```json
{
  "runner": "command",
  "runnerOptions": {
    "run": ["my-tool", "run", "--agent", "{agent}", "--model", "{model}", "--title", "{title}"],
    "prompt": "stdin",
    "continue": ["my-tool", "run", "--session", "{sessionId}"],
    "list": ["my-tool", "sessions", "--json"],
    "delete": ["my-tool", "sessions", "delete", "{sessionId}"],
    "env": {}
  }
}
```

- `prompt`: `stdin` (default), `file`, or `argument`.
- `file` requires `{promptFile}` in the run and continue commands.
- `argument` requires `{prompt}` in the run and continue commands.
- Available placeholders: `{agent}`, `{model}`, `{title}`, `{repo}`, `{role}`, `{promptFile}`, `{prompt}`, `{sessionId}`.
- An exact `{model}` argument is dropped together with its preceding flag when no model is configured.
- `list` must print a JSON array or an object with a `sessions` array. Each item can use `id`, `title`, `directory`, and `created` or `createdAt`.
- `continue` and `delete` are optional. Without them, retained-session review and cleanup report that the runner does not support them.
- `stdout` and `stderr` are always captured into the session log; the exit code is preserved.

## Bundled platform

The repository includes one bundled platform as a reference implementation:

- Agents: `platforms/opencode/agents/*.md`, installed in `~/.config/opencode/agents/`. The executor, planner, and auditor use `mode: all` with `hidden: true`, so the CLI can invoke them by name while the tool selector shows only the operator agent (`autopai`).
- Commands: `platforms/opencode/commands/*.md`, installed in `~/.config/opencode/commands/`. These are manual wrappers that call `autopai`.
- Natural language: the command files let the operator agent translate a request in any language into the deterministic flags, confirming ambiguous interpretations before running.
- Session: `opencode run --agent <agent> --auto --dir <repo>`. The rendered prompt travels through stdin (a copy is written next to the session log for debugging), so the command line never carries it and large payloads cannot overflow the OS argument limit.
- Session retention: the brief and backlog sessions are retained after their runs and recorded in `state.sessions`, so the user can ask for changes in the same conversation without reloading the core prompt. Other sessions are deleted after each run, because the full transcript already lives in the run artifacts. The title carries a random per-run token and only an unambiguous match is deleted; if the match is not unique, nothing is deleted. After a successful backlog approval, the retained prepare sessions are deleted; a failed approval leaves them in place. Set `runnerOptions.keepSessions` to true to keep every session and opt out of the cleanup.
- Review recovery: a runner may expose `listSessions`, `deleteSession`, and `continueSession`. They reconnect an interrupted prepare to its existing conversations, apply review changes in place, and clean them up after approval. `continueSession` sends a raw user message through `opencode run --session` and never loads a core prompt or creates a new session. A runner without those methods still recovers the artifacts, but cannot list, continue, or delete the conversations.
- Permissions: path-scoped `edit` rules and command patterns under `bash`.
- Global rules: the repository `AGENTS.md`.

## Adding another tool

Do not assume feature parity. Prefer the generic `command` runner and configure the roles with the capabilities of the target tool:

1. Find the non-interactive session command and its working directory, model, and approval or sandbox flags.
2. Configure `runnerOptions.run`, and optionally `continue`, `list`, and `delete`. Choose `stdin`, `file`, or `argument` for the prompt transport.
3. Recreate the four roles (`executor`, `planner`, `auditor`, `operator`) with the tool's agent, skill, or system-prompt mechanism and point `autopai.json` at their names.
4. Recreate the protected-path rules with the tool's permission model when it has one. When it does not, rely on the orchestrator diff verification.
5. Block `git push`, `git merge`, rebase, force-push, and the Git host merge command in the executor session.
6. Confirm the tool accepts a prompt supplied by the orchestrator at session start. It must not require prompts registered inside the tool.
7. Add a `src/runners/<tool>.js` module only when the CLI needs custom output parsing or a protocol the command templates cannot express.
8. Run the verification checklist in `BOOTSTRAP_PROMPT.md` before trusting the port.
