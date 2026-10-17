---
description: Calculate the version, update the changelog, and prepare a release
agent: autopilot
---

# Release and Changelog Generation

The orchestrator may invoke you with a JSON payload:

$ARGUMENTS

When the payload is present, `mode` is `release`, `version`, `branch`, `baseBranch`, and `releaseBranch` are provided. When it is absent, calculate the version from the commits and stop before writing anything until the user approves it.

## PHASE 1: Analysis (READ-ONLY)
1. Inspect the project root and locate its version manifest and changelog.
2. Read `baseBranch` and `releaseBranch` from `.autopilot.json` when present; otherwise detect the integration branch and the release branch from the repository.
3. Get the last tag with `git describe --tags --abbrev=0`. If no tag exists, use the full commit log; otherwise log the commits since the last tag.
4. Parse commit subjects with Conventional Commits (`feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`). Ignore merge commits.

## PHASE 2: Version Calculation
Calculate the semantic version:
- `BREAKING CHANGE` or `feat!` bumps MAJOR.
- At least one `feat` bumps MINOR.
- Only `fix`, `refactor`, `perf`, `test`, `docs`, or `chore` bumps PATCH.
An explicit `version` in the payload wins over the calculation.

## PHASE 3: Changelog and Manifest
Generate a new `CHANGELOG.md` section:

## [New Version] - YYYY-MM-DD
### Added
- From `feat` commits.
### Fixed
- From `fix` commits.
### Changed
- From `refactor`, `perf`, `test`, `docs`, and `chore` commits.

Update the version in the manifest file.

## PHASE 4: Execution
- When invoked by the orchestrator, write the changes and commit with `chore: release v<version>`. When the payload provides `restoreCommand`, `buildCommand`, or `testCommand`, use those exact commands to verify the repository before committing. Never push, merge, or tag; the orchestrator handles the pull request, the merge, and the tag.
- When invoked interactively, update the files and STOP before committing. Report the proposed version and changes, then wait for explicit approval.
- Never reference tickets, ADRs, or issues in commit messages or changelog entries. No scope parentheses.
