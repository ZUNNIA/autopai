# Ready for Refactor Ticket Generation

The orchestrator invoked you with this JSON payload:

{{PAYLOAD}}

Read the Identified tickets and the scope patch or file list the payload provides, and write tickets under the payload `outputDir`. Stay inside the provided scope. Tickets are local artifacts; never edit source, tests, UX, CI, ADRs, or configuration.

## PHASE 1: Context and Code Analysis (MANDATORY)
Before writing the plan, understand the original problem and the current code.
1. Read the Identified documents in scope.
2. Analyze the current source code files involved.
3. Identify what tests currently exist for that code, if any.
4. Do not write refactoring code yet. Your only job in this phase is to create the plan.

## PHASE 2: Plan Generation and Saving
For each main task, or complex subtask, in the Identified documents, generate an independent technical ticket.
**OUTPUT INSTRUCTION:** Create one Markdown file per ticket in English under `outputDir`, or by default in `tickets/ready-for-refactor/[feature]/[number-of-ticket]-[ticket-name].md`.

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
* [ ] 🧩 **Code Smell:** duplication, giant methods, confusing names, god classes.
* [ ] 🧱 **Unnecessary Complexity:** over-engineered logic, deep nesting, coupling.
* [ ] 🧪 **Lack of Coverage:** critical modules without tests or insufficient coverage.
* [ ] 📦 **Outdated Library:** outdated, deprecated, or vulnerable dependencies.
* [ ] 🏗️ **Architecture:** design principle violations, poorly distributed responsibility.
* [ ] 📝 **Missing Documentation:** critical code without comments or outdated docs.

Select and briefly justify the priority level:
* [ ] 🔴 Urgent: Technical debt is causing recurring bugs, blocking features, or compromising security or performance.
* [ ] 🟡 Important: Hinders development, increases implementation time, or causes confusion.
* [ ] 🔵 Minor: Improves long-term maintainability but does not impact the current workflow pace.

## 1. Objective
Clearly describe what technical debt will be resolved, how it will be refactored, and what measures will be taken to ensure that current functionality does not break.

## 2. Files
### Files to modify
* [Exact path] - [Brief description of what will be cleaned or restructured]
### Files to delete
* [Exact path] - [Reason why it becomes obsolete]
### New files
* [Exact path] - [Responsibility this new file will assume]

## 3. Refactoring Strategy
Technical description of the chosen approach.
* **Pattern or technique to apply:** for example Extract Class, Strategy Pattern, Strangler Fig.
* **Execution steps:** ordered list of logical and atomic steps from the current state to the desired state.
* **API/Contract changes:** if function signatures, interfaces, or endpoints change, detail how.

## 4. Risk Mitigation Plan (CRITICAL)
Since the goal is not to break current functionality, detail how stability will be ensured:
* **Tests to add before touching code (Characterization Tests):** current behaviors that must be covered as a safety net.
* **Tests to modify after the refactor:** existing tests that must change their assertion or mock due to the new structure.
* **Rollback or Feature Flags Strategy:** how the change will be hidden or reverted if something fails in production, when applicable.

## 5. Acceptance Criteria (Definition of Done)
* [ ] The original problem from the Identified document has been completely eliminated.
* [ ] All existing tests pass without modifying their original assertion, unless the test was poorly written.
* [ ] Test coverage remains the same or increases, never decreases.
* [ ] No new unnecessary dependencies have been introduced.
* [ ] The code passes the linter and static quality rules without new warnings.

## 6. Technical Notes and Design Decisions
* **Discarded alternatives:** brief explanation of why this strategy was chosen over others.
* **Accepted trade-offs:** temporary complexity assumed to solve the problem in the long term.
* **Performance/Memory impact:** whether the new structure consumes more or fewer resources.
