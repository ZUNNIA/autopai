# Policies

## Git artifacts

- Branch names: `<type>/<kebab-case-slug>`. No ticket identifiers.
- Commit subjects and pull request titles: `<type>: <subject>`. No scope parentheses.
- Allowed types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`.
- No ticket paths, ADR numbers, or issue references in branches, commits, pull requests, or merge commits.
- Merge commit subject is the pull request title. The body describes the outcome and the CI result.
- The default GitHub merge message is forbidden.

## Local artifacts

- Tickets, briefs, findings, UX proposals, and audit evidence stay local. Never commit, push, or reference them from Git.
- No diagnostic reports. Audit evidence is an input to the auditor, not a deliverable.
- Generated artifacts are written in English. No language detection.

## Permissions

- **executor**: may edit source and tests, commit, run build and tests. It may not push, merge, rebase, force-push, or run `gh`.
- **planner**: may write only under the configured backlog, ready-for-dev, and ready-for-refactor directories. Read-only over source.
- **auditor**: may write only under the configured identified and UX directories. Read-only over source and UX.
- **setup**: may edit only `.autopilot.json` and `.gitignore`.
- The orchestrator pushes, opens pull requests, and merges after the required checks pass.

## Quality

- Tests may be changed, added, or removed. The CI build, test suite, and coverage threshold are the only quality gates.
- Protected paths cannot be edited by the executor: tickets, ADRs, CI workflows, `.autopilot.json`, repository `AGENTS.md`, and coding tool configuration.
- New compiler warnings fail the build when the repository treats warnings as errors.

## Security

- `.autopilot.json` never contains secrets, tokens, or personal absolute paths.
- Runtime logs stay local. The audit uses them as evidence without publishing them.
- The executor never runs `gh`.
