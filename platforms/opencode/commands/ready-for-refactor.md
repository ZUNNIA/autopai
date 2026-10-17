---
description: Generate refactor tickets from an Identified document
agent: planner
---

# Ready for Refactor Ticket Generation

The orchestrator may invoke you with a JSON payload:

$ARGUMENTS

When the payload is present, read the Identified tickets and the scope patch or file list it provides, and write tickets under the payload `outputDir`. Stay inside the provided scope. Tickets are local artifacts; never edit source, tests, UX, CI, ADRs, or configuration.

## PHASE 1: Context and Code Analysis (MANDATORY)
Before writing the plan, you must understand the original problem and the current code.
1. Read the source `📌Identified` document provided by the user.
2. Use your reading tools to analyze the current source code files involved.
3. Identify what tests currently exist for that code (if any).
4. **Do not write refactoring code yet.** Your only job in this phase is to create the plan.

## PHASE 2: Plan Generation and Saving
For each main task (or complex sub-task) in the Identified, generate an independent technical ticket.
**OUTPUT INSTRUCTION:** Create an independent Markdown file for each ticket in English and in the path indicated by the user (or by default in `tickets/ready-for-refactor/[feature]/[number-of-ticket]-[ticket-name].md`).

## Front Matter (MANDATORY)
Every ticket starts with this front matter so the orchestrator can order tickets without ticket identifiers in Git:

```yaml
---
id: [unique-short-id]
feature: [feature-slug]
type: refactor
priority: [urgent|important|minor]
depends_on: [id-or-empty-list]
---
```

Never put ticket identifiers or ADR numbers in code snippets, branch names, commit examples, or pull request examples.

## Document Structure

## 0. Classification
Select and briefly justify the type of debt:
* [ ] 🧩 **Code Smell:** (duplication, giant methods, confusing names, god classes).
* [ ] 🧱 **Unnecessary Complexity:** (over-engineered logic, deep nesting, coupling).
* [ ] 🧪 **Lack of Coverage:** (critical modules without tests or insufficient coverage).
* [ ] 📦 **Outdated Library:** (outdated, deprecated, or vulnerable dependencies).
* [ ] 🏗️ **Architecture:** (design principle violations, poorly distributed responsibility).
* [ ] 📝 **Missing Documentation:** (critical code without comments or outdated docs).

Select and briefly justify the priority level:
* [ ] 🔴 Urgent: Technical debt is causing recurring bugs, blocking features, or compromising security/performance.
* [ ] 🟡 Important: Hinders development, increases implementation time, or causes confusion.
* [ ] 🔵 Minor: Improves long-term maintainability but does not impact the current workflow pace.

## 1. Objective
Clearly describe what technical debt will be resolved, how it will be refactored, and what measures will be taken to ensure that current functionality does not break.

## 2. Files
### Files to modify
* [Exact path] - [Brief description of what will be cleaned/restructured]
### Files to delete
* [Exact path] - [Reason why it becomes obsolete]
### New files
* [Exact path] - [Responsibility this new file will assume]

## 3. Refactoring Strategy
Technical description of the chosen approach.
* **Pattern or technique to apply:** (e.g., Extract Class, Strategy Pattern, Strangler Fig).
* **Execution steps:** (Numbered list of logical and atomic steps to get from the current state to the desired state).
* **API/Contract changes:** (If function signatures, interfaces, or endpoints change, detail how).

## 4. Risk Mitigation Plan (CRITICAL)
Since the goal is not to break current functionality, detail how stability will be ensured:
* **Tests to add BEFORE touching code (Characterization Tests):** What current behaviors we must test to have a safety net.
* **Tests to modify after the refactor:** Which existing tests will have to change their assertion or mock due to the new structure.
* **Rollback / Feature Flags Strategy:** How the change will be hidden or reverted if something fails in production (if applicable).

## 5. Acceptance Criteria (Definition of Done)
* [ ] The original problem from the `Identified` document has been completely eliminated.
* [ ] All existing tests pass 100% without modifying their original assertion (unless the test was poorly written).
* [ ] Test coverage remains the same or increases (never decreases).
* [ ] No new unnecessary dependencies have been introduced.
* [ ] The code passes the linter and static quality rules without new warnings.

## 6. Technical Notes and Design Decisions
* **Discarded alternatives:** Brief explanation of why this strategy was chosen over others.
* **Accepted trade-offs:** Temporary complexity assumed to solve the problem in the long term.
* **Performance/Memory impact:** Whether the new structure consumes more/fewer resources.
