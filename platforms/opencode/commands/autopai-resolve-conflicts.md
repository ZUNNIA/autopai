---
description: Resolve a pull request merge conflict with one executor session
agent: autopai
---

Resolve an explicit conflicting pull request.

1. Ask for the pull request number if it was not provided.
2. Run:

```text
autopai resolve-conflicts --repo . --pr <number>
```

3. Report the CLI output verbatim and identify the branch, base, and files involved.
4. Review the result with the user before any Git write. The command merges the base into the branch and runs one executor resolution session, but it does not commit, push, or merge.
5. Do not use `--fix` for a merge conflict and do not perform the follow-up Git operations yourself.
