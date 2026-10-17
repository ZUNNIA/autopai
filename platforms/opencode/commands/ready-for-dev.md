---
description: Generate Ready-for-Dev tickets from a backlog
agent: planner
---

# "Ready for Dev" Ticket Generation

The orchestrator may invoke you with a JSON payload:

$ARGUMENTS

When the payload is present, read the backlog under `backlogDir` and write tickets under `outputDir` using the `feature` slug. Tickets are local artifacts; never edit source, tests, UX, CI, ADRs, or configuration.

## PHASE 1: Analysis and Context (MANDATORY)
Before writing any tickets, you must understand the current project context.
1. Read the Backlog provided by the user.
2. Use your file-reading tools to explore the project's current structure. Identify the existing architecture, code patterns, and conventions.
3. Do not assume file or class names; verify them in the codebase.

## PHASE 2: Ticket Generation
For each main task (or complex sub-task) in the Backlog, generate an independent technical ticket.
**OUTPUT INSTRUCTION:** Create an independent Markdown file for each ticket in English and in the path indicated by the user (or by default in `tickets/ready-for-dev/[feature]/[number-of-ticket]-[ticket-name].md`).

## Front Matter (MANDATORY)
Every ticket starts with this front matter so the orchestrator can order tickets without ticket identifiers in Git:

```yaml
---
id: [unique-short-id]
feature: [feature-slug]
type: [feat|fix|refactor|perf|test|docs|chore]
priority: [urgent|important|minor]
depends_on: [id-or-empty-list]
---
```

Never put ticket identifiers or ADR numbers in code snippets, branch names, commit examples, or pull request examples.

## Structure of each Ticket

## 0. Classification
Select and briefly justify the priority level:
* [ ] 🔴 Urgent: Core functionality.
* [ ] 🟡 Important: Extra functionality.
* [ ] 🔵 Minor: Visual/UX improvements.

## 1. Objective
What is to be built or solved, in one or two clear sentences.

## 2. Files
### New files
* List of new files to be created (with their full paths).
### Modified files
* List of existing files to be touched (with their full paths). *Verify that they exist in the project.*

## 3. Implementation (Technical Specification)
Detailed technical description of how it should work. It must be so clear that a junior developer (or an AI) can code it without asking questions.
* **Interfaces / Types:** Define the necessary data structures, interfaces, or types.
* **Classes / Functions:** Suggested names, signatures, and responsibilities.
* **Main Flow:** Step-by-step execution logic for the happy path.
* **Validations and Thresholds:** Which data is validated and what the limits are.
* **Edge cases:** How it behaves in extreme situations or error scenarios.

## 4. Acceptance Criteria (Definition of Done)
Technical and functional conditions that must be met to close the ticket.
* The code compiles without errors or critical warnings.
* Unit tests have been written for the new logic.
* The UI (if applicable) respects the design across all breakpoints/states.
* There are no console.log statements, print statements, or commented-out code.

## 5. Technical Notes
Important details for implementation:
* **Dependencies/Libraries:** Which external packages are required (and versions if applicable).
* **Design decisions:** Why this approach was chosen over another.
* **Error handling:** How and where errors should be caught and thrown.
* **Architecture Impact:** If this implementation introduces a new framework, database, or core pattern, you MUST trigger the `adr.md` workflow to document the decision before proceeding.
