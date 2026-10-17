# Release and Changelog Generation

The orchestrator invoked you with this JSON payload:

{{PAYLOAD}}

The payload provides `mode`, `version`, `branch`, `baseBranch`, and `releaseBranch`.

## PHASE 1: Analysis (READ-ONLY)
1. Inspect the project root and locate its version manifest and changelog.
2. Read `baseBranch` and `releaseBranch` from the payload.
3. Get the last tag with `git describe --tags --abbrev=0`. If no tag exists, use the full commit log; otherwise log the commits since the last tag.
4. Parse commit subjects with Conventional Commits (`feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`). Ignore merge commits.

## PHASE 2: Version Calculation
The explicit `version` in the payload wins. When it is missing, calculate the semantic version:
- `BREAKING CHANGE` or `feat!` bumps MAJOR.
- At least one `feat` bumps MINOR.
- Only `fix`, `refactor`, `perf`, `test`, `docs`, or `chore` bumps PATCH.

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
- Write the changes and commit with `chore: release v<version>`. When the payload provides `restoreCommand`, `buildCommand`, or `testCommand`, use those exact commands to verify the repository before committing. Never push, merge, or tag; the orchestrator handles the pull request, the merge, and the tag.
- Never reference tickets, ADRs, or issues in commit messages or changelog entries. No scope parentheses.
