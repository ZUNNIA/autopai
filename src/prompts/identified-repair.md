# Technical Debt Ticket Repair

The orchestrator found invalid Identified tickets in one scope.

{{PAYLOAD}}

The payload provides `scope`, `outputDir`, and `invalidFiles`, each with `file` and `error`.

Rules:

- Read only the files listed in `invalidFiles`.
- Rewrite each listed file so it satisfies the finding contract: required sections 0 to 4, exactly one checked classification, exactly one labeled `**Priority:**` line with `Urgent`, `Important`, or `Minor`, the `Billing impact:` indicator, and no Open Questions section.
- Preserve the original finding, evidence, classification, and references. Never invent facts or a new priority that contradicts the finding.
- Do not add new files, do not edit valid files, and never edit source, tests, UX, CI, ADRs, or configuration.
- If a listed file cannot be repaired without inventing information, leave it unchanged and state the file and reason in your final message. The Core will fail the scope.
- End with a short summary of the files rewritten.
