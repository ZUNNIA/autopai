---
description: Generate a technical backlog from a feature request
agent: planner
---

# Technical Backlog Generation

The orchestrator may invoke you with a JSON payload:

$ARGUMENTS

When the payload is present, read the brief at `briefPath` and write the backlog under `outputDir` using the `feature` slug. When it is absent, use the user's request and the agreed path.

You never edit source, tests, UX, CI, ADRs, or configuration. Tickets are local artifacts.

## PHASE 1: Research (MANDATORY)
Before writing a single line of the backlog, you must research the topic requested by the user.
1. Conduct in-depth research to find and read **exclusively** official documentation, technical blogs from the creators, or official repositories.
2. **Specifically gather official links to any external APIs, libraries, or third-party services** that will be needed for the implementation.
3. Do not use your internal memory if there is any doubt.

## PHASE 2: Backlog Generation
Once the research is complete, create a markdown file with the backlog following this structure exactly. Save the file in English in the path the user indicates, in the payload `outputDir`, or by default in `tickets/backlog/[feature-name]/backlog.md`.

Never cite ticket files or ADR numbers from code snippets or branch examples inside the backlog. Open questions that a human must resolve belong in a final "Open questions" section.

### Document Structure

## 0. Classification
Select and briefly justify the priority level:
* [ ] 🔴 Urgent: Core functionality.
* [ ] 🟡 Important: Extra functionality.
* [ ] 🔵 Minor: Visual/UX improvements.

## 1. Objective
* **Problem to solve (Problema a resolver):** What pain point does the user or business have?
* **Proposed solution (Solución propuesta):** Clear description of the main functionality.
* **Expected value (Valor esperado):** What metric or benefit does it provide?

## 2. Work Organization
The backlog is divided into main tasks (large blocks) and subtasks (concrete actions).

### 1: [Large Block Name]
* **Description:** What will be done and why.
* **Files/Modules affected:** List of files. *(Note: If the exact files are not known at this planning stage, indicate the module or general area, e.g., "Rendering queue system").*
* **Dependencies:** What other tasks must be completed first (e.g., "Depends on 1A").
* **External API/Service Links:** One or more links to the official documentation of external APIs or third-party services required for this task.
* **Acceptance Criteria:** How we will know this is finished (technical conditions, validations, tests).

#### Subtasks:
* **1A)** [Concrete action 1]
  * *External API/Service Links:* [URLs to relevant official docs]
* **1B)** [Concrete action 2]
  * *External API/Service Links:* [URLs to relevant official docs]
* **1C)** [Concrete action 3]
  * *External API/Service Links:* [URLs to relevant official docs]

*(Repeat the structure for Task 2, Task 3, etc., numbering their subtasks as 2A, 2B...)*

## 3. Golden Rules for a Backlog
* Each main task must be a clearly understandable block.
* Each subtask must be an atomic and concrete action (e.g., "Create X interface," not "Implement X").
* **MANDATORY:** Every task and/or subtask MUST include one or more links to the official documentation of external APIs or third-party services involved. If a task does not use any external service, explicitly state "N/A - Internal logic only".
* If a task depends on another, it must be explicitly indicated.
* If a task requires validations or tests, they must be explicitly described in the Acceptance Criteria.
