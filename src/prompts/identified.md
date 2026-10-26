# Technical Debt Identification

The orchestrator invoked you with this JSON payload:

{{PAYLOAD}}

The payload provides `scope`, `patchPath`, `changedFiles`, `evidenceFile`, `outputDir`, and `filters`.

## PHASE 0: Evidence and Scope (MANDATORY)
1. Read the patch and the evidence file, and treat the payload `changedFiles` as the only scope.
2. The evidence file may reference compiler warnings, test output, and recent runtime logs. Use it as evidence; do not create any diagnostic report.
3. You may only write inside the payload `outputDir`. Source, tests, UX, CI, ADRs, and configuration are read-only for you.

## PHASE 1: Strict Verification
Obtain exact line numbers, actual function or class names, and the directly affected files from the current code. Never invent paths or lines. If a datapoint cannot be verified, say so instead of guessing.

### Matching the filter
`filters.classifications` and `filters.priorities` may be empty. When a list is
not empty, document only debts whose checked classification or priority is in
that list. Both lists apply together. Never change a classification or priority
to make a debt fit the filter. If no debt matches, write no files and state it
in your final message.

## PHASE 2: Writing
For each debt, create one independent Markdown file in English under the output directory, using the repository naming convention or `[number]-[short-name].md`.

### Document Structure

## 0. Classification
Select and briefly justify the type of debt:
* [ ] 🧩 **Code Smell:** duplication, giant methods, confusing names, god classes.
* [ ] 🧱 **Unnecessary Complexity:** over-engineered logic, deep nesting, coupling.
* [ ] 🧪 **Lack of Coverage:** critical modules without tests or insufficient coverage.
* [ ] 📦 **Outdated Library:** outdated, deprecated, or vulnerable dependencies.
* [ ] 🏗️ **Architecture:** design principle violations, poorly distributed responsibility.
* [ ] 📝 **Missing Documentation:** critical code without comments or outdated docs.

Select and briefly justify the priority level:
* [ ] 🔴 Urgent: causing recurring bugs, blocking features, or compromising security or performance.
* [ ] 🟡 Important: hinders development, increases implementation time, or causes confusion.
* [ ] 🔵 Minor: improves long-term maintainability without impacting the current pace.

## 1. Objective
Document and classify the detected debt before it becomes a real problem. It must be clear what is wrong, where it is, and what risk it implies.

## 2. Evidence
### Location
* **File(s):** exact path verified in the code.
* **Line(s) / Block:** exact line range or name of the function, class, or module.

### Problem Description
What is wrong and why it is a problem. Concrete and technical.

### Current Symptoms
* [ ] Recurring errors in QA or bugs.
* [ ] Inflated development time in this area.
* [ ] Difficulty or impossibility to write tests.
* [ ] Frequent conflicts in pull requests.
* [ ] Others: specify.

### Metrics
Only when extractable from code: coverage, complexity or size, library version.

## 3. Impact
### Affected Files
* **Direct:** files involved in the problem.
* **Indirect (Risk):** files that could break if this fails or during a refactor.

### Dependent Modules
What parts of the application consume or depend on the defective code.

### Risk of Inaction
* **Short term:** observable consequence.
* **Medium term:** larger consequence.

## 4. References
Related issues, previous pull requests, and resources. Never reference a ticket file or an ADR number from code snippets.

## GOLDEN RULES (NON-NEGOTIABLE)
1. **ZERO SOLUTIONS:** never propose refactors, new architectures, or complete solutions. Only the finding is documented.
2. **ATOMICITY:** one file equals one specific problem. Multiple debts in the same file become multiple files.
3. **TRUTHFULNESS:** if you cannot verify the exact lines or files with your tools, write "To be verified in IDE" instead of guessing.
4. **READ-ONLY:** never edit source, tests, UX, CI, ADRs, or configuration. Never implement a UX change. If you find a UX improvement, document it as an observation in your final message, not as a code change.
5. **NO DIAGNOSTIC REPORT:** do not create a separate diagnostics artifact. The evidence is an input.
6. **LOCAL ONLY:** these tickets are local artifacts. Do not commit, push, or reference them from Git.

End with a short summary: scope, files written, debts found per priority, and any filter that matched nothing.
