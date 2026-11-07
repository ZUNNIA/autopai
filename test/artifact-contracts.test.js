import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateBacklogText,
  validateBriefText,
  validateFindingText,
  validateQaFixText,
  validateReadyForDevText,
  validateReadyForRefactorText,
  validateUxProposalText
} from '../src/lib/artifact-contracts.js'

const billingNone = 'Billing impact: none'

test('validates the brief contract', () => {
  assert.deepEqual(validateBriefText(brief()), { file: '<memory>', kind: 'brief' })
  assert.throws(() => validateBriefText(brief().replace('## Scope', '## Missing')), /missing required section "## Scope"/)
})

test('validates the backlog contract', () => {
  assert.deepEqual(validateBacklogText(backlog()), { file: '<memory>', kind: 'backlog' })
  assert.throws(() => validateBacklogText(backlog().replace('#### Subtasks:', '#### Tasks:')), /Subtasks/)
})

test('validates findings that declare classification, priority, and billing', () => {
  assert.deepEqual(validateFindingText(finding()), { file: '<memory>', kind: 'identified' })
  assert.throws(() => validateFindingText(finding().replace('* [x] **Code Smell:**', '* [ ] **Code Smell:**')), /classification/)
})

test('validates ready-for-dev, ready-for-refactor, and QA fix front matter', () => {
  assert.deepEqual(validateReadyForDevText(devTicket()), { file: '<memory>', kind: 'ready-for-dev' })
  assert.deepEqual(validateReadyForDevText(qaTicket()), { file: '<memory>', kind: 'qa-fix' })
  assert.deepEqual(validateReadyForRefactorText(refactorTicket()), { file: '<memory>', kind: 'ready-for-refactor' })
  assert.deepEqual(validateQaFixText(qaTicket()), { file: '<memory>', kind: 'qa-fix' })

  assert.throws(() => validateReadyForDevText(devTicket().replace('depends_on: []\n', '')), /depends_on/)
  assert.throws(() => validateReadyForRefactorText(refactorTicket().replace('type: refactor', 'type: feat')), /type: refactor/)
  assert.throws(() => validateQaFixText(qaTicket().replace('type: fix', 'type: feat')), /type: fix/)
})

test('validates the UX proposal contract', () => {
  assert.deepEqual(validateUxProposalText(uxProposal()), { file: '<memory>', kind: 'ux' })
  assert.throws(() => validateUxProposalText(uxProposal().replace('## Alternatives', '## Open Questions')), /forbidden/)
})

function brief() {
  return [
    '# Feature Brief: Demo',
    '',
    '## Problem',
    'Problem.',
    '',
    '## Scope',
    'Scope.',
    '',
    '## Non-goals',
    'None.',
    '',
    '## Constraints',
    'None.',
    '',
    '## Acceptance Criteria',
    'Works.',
    '',
    '## External References',
    'N/A'
  ].join('\n')
}

function backlog() {
  return [
    '# Backlog',
    '',
    billingNone,
    '',
    '## 0. Classification',
    '* [x] **Important:** extra functionality.',
    '',
    '## 1. Objective',
    'Objective.',
    '',
    '## 2. Work Organization',
    '### 1: Demo',
    '**External API/Service Links:** N/A - Internal logic only',
    '#### Subtasks:',
    '* **1A)** Do it.',
    '  * *External API/Service Links:* N/A - Internal logic only',
    '',
    '## 3. Golden Rules for a Backlog',
    'Rules.'
  ].join('\n')
}

function finding() {
  return [
    '# Finding',
    '',
    billingNone,
    '',
    '## 0. Classification',
    '* [x] **Code Smell:** duplication.',
    '* [x] **Important:** costs time.',
    '',
    '## 1. Objective',
    'Objective.',
    '',
    '## 2. Evidence',
    'Evidence.',
    '',
    '## 3. Impact',
    'Impact.',
    '',
    '## 4. References',
    'None.'
  ].join('\n')
}

function devTicket() {
  return [
    '---',
    'id: demo',
    'feature: demo',
    'type: feat',
    'priority: important',
    'billing: none',
    'depends_on: []',
    '---',
    '',
    '# Demo',
    '',
    '## 0. Classification',
    '* [x] **Important:** extra functionality.',
    '',
    '## 1. Objective',
    'Objective.',
    '',
    '## 2. Files',
    'None.',
    '',
    '## 3. Implementation',
    'Implementation.',
    '',
    '## 4. Acceptance Criteria',
    'Works.',
    '',
    '## 5. Technical Notes',
    'None.',
    '',
    '## 6. Manual Verification',
    'None.'
  ].join('\n')
}

function refactorTicket() {
  return [
    '---',
    'id: demo',
    'feature: tech-debt',
    'type: refactor',
    'classification: code-smell',
    'priority: important',
    'billing: none',
    'depends_on: []',
    '---',
    '',
    '# Demo',
    '',
    '## 0. Classification',
    '* [x] **Code Smell:** duplication.',
    '* [x] **Important:** costs time.',
    '',
    '## 1. Objective',
    'Objective.',
    '',
    '## 2. Files',
    'None.',
    '',
    '## 3. Refactoring Strategy',
    'Strategy.',
    '',
    '## 4. Risk Mitigation Plan',
    'Plan.',
    '',
    '## 5. Acceptance Criteria',
    'Works.',
    '',
    '## 6. Technical Notes and Design Decisions',
    'None.'
  ].join('\n')
}

function qaTicket() {
  return [
    '---',
    'id: demo-fix',
    'feature: demo',
    'type: fix',
    'priority: important',
    'billing: none',
    'depends_on: []',
    '---',
    '',
    '# Demo',
    '',
    '## 0. Classification',
    '* [x] **Important:** broken behavior.',
    '',
    '## 1. QA Failure',
    'Failure.',
    '',
    '## 2. Files',
    'None.',
    '',
    '## 3. Implementation',
    'Implementation.',
    '',
    '## 4. Acceptance Criteria',
    'Works.',
    '',
    '## 5. Manual Verification',
    'None.'
  ].join('\n')
}

function uxProposal() {
  return [
    '# UX Proposal: Demo',
    '',
    '## Context',
    'Context.',
    '',
    '## Observation',
    'Observation.',
    '',
    '## Impact',
    'Impact.',
    '',
    '## Proposal',
    'Proposal.',
    '',
    '## Alternatives',
    'Alternative.'
  ].join('\n')
}
