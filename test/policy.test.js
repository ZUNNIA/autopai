import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateBranchName,
  validateCommitMessage,
  validatePrBody,
  validatePrTitle,
  scanAddedLines
} from '../src/lib/policy.js'

test('accepts a conventional branch name', () => {
  assert.equal(validateBranchName('feat/ux-improvements').length, 0)
})

test('rejects ticket-like branch segments', () => {
  assert.ok(validateBranchName('feat/123').length > 0)
  assert.ok(validateBranchName('fix/ABC-123').length > 0)
})

test('accepts a conventional commit subject without scope', () => {
  assert.equal(validateCommitMessage('feat: add the model parameters panel').length, 0)
})

test('rejects scoped commit subjects', () => {
  const violations = validateCommitMessage('feat(panel): add the model parameters panel')
  assert.ok(violations.some(item => item.code === 'commit-scope'))
})

test('rejects ticket and ADR references in commit messages', () => {
  assert.ok(validateCommitMessage('fix: close tickets/001-thing').length > 0)
  assert.ok(validateCommitMessage('fix: remove ADR-029 reference').length > 0)
  assert.ok(validateCommitMessage('fix: close #123').length > 0)
})

test('rejects scoped PR titles', () => {
  const violations = validatePrTitle('docs(audit): record findings')
  assert.ok(violations.some(item => item.code === 'pr-title-scope'))
})

test('rejects bullet and numbered lists in pull request bodies', () => {
  assert.ok(validatePrBody('## Summary\n- First change\n- Second change').some(item => item.code === 'pr-body-list'))
  assert.ok(validatePrBody('## Summary\n1. First change\n2. Second change').some(item => item.code === 'pr-body-list'))
  assert.equal(validatePrBody('## Summary\nFirst change. Second change.').length, 0)
})

test('scans added code for ticket and ADR references', () => {
  const diff = [
    '+++ b/Models/Thing.cs',
    '@@ -1,1 +1,2 @@',
    '+// see ADR-029 for the fallback value',
    '+// see tickets/ready-for-dev/001-thing.md'
  ].join('\n')
  const violations = scanAddedLines(diff)
  assert.equal(violations.length, 2)
})

test('does not flag hexadecimal colors as issue references', () => {
  const diff = [
    '+++ b/Resources/Styles/Styles.axaml',
    '@@ -1,1 +1,2 @@',
    '+<Setter Property="Background" Value="#0AFFFFFF"/>'
  ].join('\n')
  assert.equal(scanAddedLines(diff).length, 0)
})
