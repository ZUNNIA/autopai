# Platform adaptation

The orchestrator only needs two things from a coding tool: a non-interactive session that accepts a prompt, and a permission model that keeps the executor away from Git writes and protected paths. Everything else is platform glue.

## OpenCode (native)

- Orchestrator: the `ai-autopilot` command, installed with `npm link` from this repository.
- Agents: `platforms/opencode/agents/*.md`, installed in `~/.config/opencode/agents/`.
- Commands: `platforms/opencode/commands/*.md`, installed in `~/.config/opencode/commands/`.
- Session: `opencode run --command <name> --auto --dir <repo> "<json>"`.
- Permissions: path-scoped `edit` rules and command patterns under `bash`.
- Global rules: the repository `AGENTS.md`.

## Codex (adaptation guide)

Do not assume feature parity. Recreate the roles with the current Codex capabilities:

- Global and project rules: `AGENTS.md`, shared through the repository.
- Reusable instructions: Codex skills. Custom prompts existed but are deprecated in favor of skills, so build the work-item instructions as skills and keep the orchestrator as the owner of the prompt payloads.
- Non-interactive sessions: `codex exec` streams results to stdout or JSONL and can resume sessions. Use it the same way the orchestrator uses `opencode run`.
- Approvals and sandbox: `--ask-for-approval` and `--sandbox` keep the executor inside the workspace. The orchestrator still performs every push, pull request, and merge.
- Command blocking: Codex exec policy rules can pre-approve, prompt, or block commands. Use them to forbid `git push`, `git merge`, and `gh pr merge` in the executor session.
- Configuration layers: `~/.codex/config.toml` and per-profile files. Keep repository-specific values in `.autopilot.json`, not in the global config.

## Another tool (checklist)

1. Identify the non-interactive session command and its working directory, model, and approval flags.
2. Map the four roles to the tool's agent or skill mechanism.
3. Recreate the protected-path rules with the tool's permission model when it has one. When it does not, rely on the orchestrator diff verification.
4. Keep the orchestrator as the only component allowed to push, open pull requests, and merge.
5. Confirm the tool can run from a prompt payload that is supplied by the orchestrator and not registered inside the tool.
6. Run the verification checklist in `BOOTSTRAP_PROMPT.md` before trusting the port.
