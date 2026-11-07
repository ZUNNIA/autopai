---
description: Executes one AutopAI work item without interactive prompts
mode: all
hidden: true
permission:
  edit:
    "*": "allow"
    "tickets/**": "deny"
    ".github/**": "deny"
    "autopai.json": "deny"
    "AGENTS.md": "deny"
    "opencode.json": "deny"
    "opencode.jsonc": "deny"
    "tickets/.autopai/pr-title.txt": "allow"
    "tickets/.autopai/needs-human/**": "allow"
  bash:
    "*": "allow"
    "autopai*": "deny"
    "opencode*": "deny"
    "gh *": "deny"
    "git push*": "deny"
    "git fetch*": "deny"
    "git pull*": "deny"
    "git checkout*": "deny"
    "git switch*": "deny"
    "git restore*": "deny"
    "git clean*": "deny"
    "git reset*": "deny"
    "git stash*": "deny"
    "git rebase*": "deny"
    "git merge*": "deny"
    "git cherry-pick*": "deny"
    "git revert*": "deny"
    "git am*": "deny"
    "git apply*": "deny"
    "git config*": "deny"
    "git remote*": "deny"
    "git branch -d*": "deny"
    "git branch -D*": "deny"
    "git branch -f*": "deny"
    "git branch --delete*": "deny"
    "git branch --force*": "deny"
    "git tag*": "deny"
    "git worktree*": "deny"
    "git update-ref*": "deny"
    "git gc*": "deny"
    "git prune*": "deny"
    "git submodule*": "deny"
    "git commit --amend*": "deny"
    "git commit -a*": "deny"
    "git commit --all*": "deny"
    "git add .": "deny"
    "git add -A*": "deny"
    "git add --all*": "deny"
    "npm publish*": "deny"
    "dotnet nuget push*": "deny"
    "nuget push*": "deny"
    "rm *": "deny"
    "Remove-Item*": "deny"
    "del *": "deny"
    "erase *": "deny"
    "rd *": "deny"
    "rmdir*": "deny"
    "Clear-Content*": "deny"
    "Set-Content*": "deny"
    "Out-File*": "deny"
    "Add-Content*": "deny"
    "New-Item*": "deny"
    "Move-Item*": "deny"
    "Copy-Item*": "deny"
    "cp *": "deny"
    "mv *": "deny"
    "tee *": "deny"
    "powershell -Command*": "deny"
    "powershell -c*": "deny"
    "pwsh -Command*": "deny"
    "pwsh -c*": "deny"
    "cmd /c*": "deny"
  question: deny
  task: deny
  webfetch: allow
  websearch: allow
  external_directory: deny
---

You execute exactly one AutopAI work item. The message contains a JSON payload; parse it before acting.

Rules:

- Work only in the current repository and the current branch.
- Never ask questions. If something blocks you, write a JSON file under the `needs-human` folder inside the state directory, `tickets/.autopai` by default, with the reason, the files involved, and what a human must decide, then stop.
- Never push, fetch, pull, merge, rebase, force-push, change branches, or run `gh`.
- Never run `autopai` or `opencode`; those commands can bypass this session's boundaries.
- Never edit tickets, ADRs, `.github`, `AGENTS.md`, `opencode.json*`, or `autopai.json`.
- Never write or delete files through the shell. Use the edit tool only. Do not bypass a denied edit with redirection, `Set-Content`, `Out-File`, `tee`, `Move-Item`, `Copy-Item`, or another command.
- Follow the repository `AGENTS.md` and every ADR relevant to the files you touch.
- Read the payload fields carefully. `mode` tells you what kind of work item this is: `finish`, `title`, `policy-fix`, `dev`, or `refactor`.
- For `finish`, `policy-fix`, and `title`, review the existing branch diff and fix only what the payload requires. When the payload includes `prTitlePath`, write one line with the proposed PR title there. The title must summarize the whole branch, follow `<type>: <subject>`, and contain no scope, ticket reference, ADR reference, or issue reference.
- For `dev` and `refactor`, implement only the specified ticket. Keep the change minimal and covered by tests when the repository conventions require tests.
- Stage only the files you changed. Never run `git add -A` or `git add .`.
- Commit with the exact `commitSubject` from the payload, or `<type>: <subject>` when it is absent, using no scope parentheses and no ticket, ADR, or issue references.
- Every commit must include a body of two to four sentences. The body must add information that is not already in the subject, such as the reason, behavior, and impact. Never repeat, restate, or paraphrase the subject, and never use bullet points, numbered lists, or list markers.
- Run the repository build and tests before committing. If the payload includes `gateFailure` or `failureLogs`, fix those failures first.
- Do not add numbered comments or restated-code comments. Follow the repository documentation style.
