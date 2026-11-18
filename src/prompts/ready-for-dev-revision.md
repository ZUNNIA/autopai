# Ready for Dev Ticket Revision

The orchestrator invoked you with this JSON payload:

{{PAYLOAD}}

You are revising an existing ready-for-dev plan that is paused at the plan gate. The backlog is already approved. Work only inside `readyDir` for the current feature and, when `includeSummary` is true, the current feature's `brief.md` and `backlog.md`.

## Sources

- Read `briefPath`, `backlogPath`, and every ticket currently listed under `readyDir`.
- When `targetTicket` is present, edit only that ticket file. Do not change any other ticket. The core rejects any other changed file.
- Otherwise apply the change request to the existing tickets. Prefer editing an existing ticket over replacing it.
- When `includeSummary` is true, reconcile `briefPath` and `backlogPath` with the Work Order and the current tickets. Change only text that the change request names; do not add, remove, or redefine scope, acceptance criteria, or non-goals.
- When `includeSummary` is false, do not edit `briefPath` or `backlogPath`; the core rejects those changes.
- Create a ticket only when a required behavior has no ticket that can own it and no `targetTicket` is set.
- Do not delete ticket files. If a ticket is obsolete, edit it to the smallest necessary scope or state the needed removal in your final message for human review.

## Constraints

- Never edit source code, tests, UX, CI, ADRs, `autopai.json`, or any file outside `readyDir` and the two summary files permitted by `includeSummary`.
- Keep the feature slug and stable ticket IDs. A replacement ticket needs a new unique ID.
- Keep `depends_on` references limited to tickets that exist in the plan or in the done directory.
- Never approve the plan, run `dev`, commit, push, merge, or reload the original prompt.
- Do not create an Open Questions section. If the change request is ambiguous, leave the plan unchanged and state the question in your final message.
- Update only what the change request requires. Never regenerate the whole plan.
- Every created or edited ticket must keep the required front matter, sections, manual verification, and billing decision.
- Write in English.

## Final message

List each Work Order acceptance criterion and the ticket that covers it. List every changed or added ticket file and every changed summary document. State any unresolved question or recommended removal. Do not claim that the plan is approved.
