# QA Fix Ticket Generation

The orchestrator invoked you with this JSON payload:

{{PAYLOAD}}

Read the QA checklist at `qaFile` and the user's reported failure. Write one or more independent fix tickets under `outputDir` for `feature`. This is a QA correction for the current feature, not a new brief or backlog. Do not edit source, tests, UX, CI, ADRs, or configuration.

## Requirements

- Every ticket must be valid Markdown with the required front matter.
- Use `type: fix`.
- Keep the scope limited to the reported QA failure. Do not re-plan the whole feature.
- Verify file paths and existing behavior against the repository; never guess.
- Include a reproduction, expected behavior, acceptance criteria, automated tests, and manual verification.
- If the fix needs an external API, library, or service, include official documentation links.
- Do not write open questions into the tickets. If a decision is missing, state the question in your final message and create no incomplete ticket.
- Do not reference ticket files or ADR numbers from code snippets, branch names, or commit examples.

## Front Matter

```yaml
---
id: [unique-short-id]
feature: [feature-slug]
type: fix
priority: [urgent|important|minor]
billing: [none|increase|unknown]
depends_on: [id-or-empty-list]
---
```

## Ticket Structure

## 0. Classification
Select and briefly justify the priority:
* [ ] Urgent: core behavior broken.
* [ ] Important: expected behavior is missing or unreliable.
* [ ] Minor: visual or wording issue.

## 1. QA Failure
- **Reported failure:** Quote or summarize the user's QA failure.
- **Expected behavior:** What the user should see.
- **Actual behavior:** What happened, with exact evidence from the code or QA checklist.
- **Reproduction:** Minimum steps and preconditions.

## 2. Files
### New files
### Modified files

## 3. Implementation
The technical change needed to fix the QA failure, including interfaces, functions, validations and edge cases.

## 4. Acceptance Criteria
- The reported QA failure is reproduced by a test before the fix.
- The test passes after the fix.
- Existing behavior covered by the QA checklist still works.
- The build and test commands pass.
- No console.log, print statements, or commented-out code.

## 5. Manual Verification
Exact QA steps to repeat after the fix, with expected results. Write "None" only when automated tests fully cover the behavior.

## 6. Billing impact
Set front-matter `billing` to `none`, `increase`, or `unknown`. Estimate product runtime and CI/testing costs in the payload `billingCurrency`. Add this section only when billing is `increase` or `unknown`; it must include an `Estimate` line, one-time and recurring costs, drivers, assumptions and confidence. If billing does not increase, use `none` and omit this section. When billing is `increase` or `unknown`, include one line with the estimate and confidence in your final message.

Save each ticket in English under `outputDir` using a numbered kebab-case file name.
