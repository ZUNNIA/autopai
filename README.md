# ai-autopilot

Portable, CI-gated development orchestrator for agentic coding tools. It coordinates work through resumable phases, keeps state in local files, and owns every Git write: branches, commit validation, pushes, pull requests, CI waits, and merges.

The orchestrator is language and repository agnostic. Every build, test, and check comes from a `.autopilot.json` that the AI generates inside each target repository.

## Requirements

- Node.js 20 or newer.
- Git and GitHub CLI (`gh`) authenticated.
- OpenCode CLI on `PATH` for the native platform files.

## Repository layout

```text
src/                         Node orchestrator
test/                        Unit tests
spec/                        Architecture, policies, config schema, platform guide
platforms/opencode/agents/   Agent definitions with path-scoped permissions
platforms/opencode/commands/ Command prompts
AGENTS.md                    Global rules for the coding tool
BOOTSTRAP_PROMPT.md          Self-contained prompt to recreate this system in another tool
scripts/build-bootstrap.mjs  Regenerates BOOTSTRAP_PROMPT.md from the sources
```

## Setup

1. Clone this repository anywhere on the machine.
2. Install dependencies:

```text
npm ci
```

3. Make the orchestrator available as a global command:

```text
npm link
```

The `ai-autopilot` command now points at this clone. Run `npm link` again after moving the clone.

4. Install the OpenCode platform files. Copy or link:

- `platforms/opencode/agents/*` into `~/.config/opencode/agents/`.
- `platforms/opencode/commands/*` into `~/.config/opencode/commands/`.
- `AGENTS.md` into `~/.config/opencode/AGENTS.md`, or merge it with the existing file.

## Usage in a target repository

1. Open the target repository in the coding tool.
2. Run `/autopilot-init`. The setup agent inspects the repository and writes `.autopilot.json`. No language or framework is assumed.
3. Review `.autopilot.json`.
4. Run the phase you need:

- `/autopilot-adopt --branch <name>` finishes an existing branch through push, pull request, CI, and merge.
- `/autopilot-run --from prepare --to prepare --feature <slug> --description "<idea>"` generates a brief and a backlog, then stops for review.
- `/autopilot-run --from approve --to dev --feature <slug>` generates tickets and runs the development loop.
- `/autopilot-identify --scope branch:<name> --scope pr:<number>` audits scopes and writes local findings.
- `/autopilot-run --from refactor --to refactor --feature <slug>` executes refactor tickets.
- `/autopilot-run --from release --to release --version <x.y.z>` prepares and merges a release.
- `/autopilot-status` shows the current run.

CLI equivalents:

```text
ai-autopilot adopt --repo . --branch <name>
ai-autopilot identify --repo . --scope branch:<name> --scope pr:<number>
ai-autopilot status --repo .
ai-autopilot resume --repo .
```

Every command supports `--dry-run` where it makes sense. A run can start at any phase and stop at any phase.

## Policies

- Tickets, briefs, findings, and evidence are local. Git artifacts never reference them.
- Branch names are `<type>/<kebab-case-slug>`. Commit subjects and pull request titles are `<type>: <subject>` with no scope parentheses.
- No ADR numbers or issue references in code, branches, commits, pull requests, or merges.
- The executor may commit but never push, merge, rebase, or force-push. The orchestrator owns those operations and merges only after the required checks pass.
- Tests may be changed freely. The CI build, test suite, and coverage threshold are the quality gates.
- No diagnostic reports. Audit evidence stays local.
- Generated artifacts are written in English. No language detection.

## Migrating to another tool

Read `BOOTSTRAP_PROMPT.md` and `spec/PLATFORMS.md`. The orchestrator is the portable piece; the agent and command files are platform glue.

## Development

```text
npm test
npm run build-bootstrap
npm run check-bootstrap
```

## License

MIT. See `LICENSE`.
