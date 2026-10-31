# Policies

## Git artifacts

- Branch names: `<type>/<kebab-case-slug>`, capped at 32 characters. No ticket identifiers.
- The slug is the short semantic ticket name with source PR and finding ordinals removed, truncated at whole words.
- Commit subjects and pull request titles: `<type>: <subject>`. No scope parentheses.
- Allowed types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`.
- No source PR numbers, ticket paths, ADR numbers, or issue references in branches, commits, pull requests, or merge commits.
- A commit body must contain two to four sentences that add information beyond the subject. It never repeats, restates, or paraphrases the subject.
- Pull request and merge bodies may contain any useful detail. Bullet points, numbered lists, and list markers are forbidden in all message bodies.
- Merge commit subject is the pull request title. The body summarizes the actual change from the pull request summary or commit subjects. It never contains branch-into-base boilerplate, CI status, coverage, or ticket/ADR/issue references.
- The default GitHub merge message is forbidden.

## Billing reports

- Every generated backlog, Identified finding, ready-for-dev ticket, ready-for-refactor ticket, and QA fix ticket declares `billing: none|increase|unknown` or `Billing impact: none|increase|unknown`.
- A detailed `## Billing impact` section with an `Estimate` is required only for `increase` or `unknown`; `none` means no report.
- Estimates cover product runtime and CI/testing costs in the project `billingCurrency`.
- Estimates are approximate and include drivers, assumptions, and confidence. `Unknown` is valid; guessing is not.
- The chat reports billing impact only for `increase` or `unknown`.

## CI failures

- GitHub Actions billing, spending-limit, runner, permission, or not-started annotations are infrastructure failures. They are never fixed with source changes.
- The orchestrator writes an infrastructure blocker with the exact failed check and annotation before any re-run or executor diagnosis.
- Every non-ignored check must pass. An empty `requiredChecks` does not disable CI; only an exact `ignoredChecks` entry excludes a check.
- Ignoring a real check removes a merge protection. Use the exact job name reported by `gh pr checks`, confirm the waiver explicitly, and remove it after the temporary period.

## Local artifacts

- Tickets, briefs, findings, UX proposals, and audit evidence stay local. Never commit, push, or reference them from Git.
- No diagnostic reports. Audit evidence is an input to the auditor, not a deliverable.
- Generated artifacts are written in English. No language detection.

## Permissions

- **executor**: may edit source and tests, commit, run build and tests. It may not push, merge, rebase, force-push, or run `gh`.
- **planner**: may write only under the configured backlog, ready-for-dev, and ready-for-refactor directories. Read-only over source.
- **auditor**: may write only under the configured identified and UX directories. Read-only over source and UX.
- **operator** (agent `autopai`): may edit only `autopai.json`, `.gitignore`, and the architecture decision records (`tickets/adr/**` or `docs/adr/**`).
- The orchestrator pushes, opens pull requests, and merges after the required checks pass.
- Promotion is a planner duty: the `promote` phase turns Identified findings into ready-for-refactor tickets. The auditor never promotes its own findings.

## Quality

- Tests may be changed, added, or removed. The CI build, test suite, and coverage threshold are the only quality gates.
- Refactors preserve the user-visible behavior unless the finding documents a UX defect.
- After the dev loop, the orchestrator collects the Manual Verification sections of the done tickets into `tickets/qa/<feature>.md` so the human runs only what automation cannot cover.
- Protected paths cannot be edited by the executor: tickets, ADRs, CI workflows, `autopai.json`, repository `AGENTS.md`, and coding tool configuration.
- New compiler warnings fail the build when the repository treats warnings as errors.

## Security

- `autopai.json` never contains secrets, tokens, or personal absolute paths.
- Runtime logs stay local. The audit uses them as evidence without publishing them.
- The executor never runs `gh`.
