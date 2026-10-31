import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeCommitMessage } from '../src/lib/commit-message.js'

test('removes a commit body that only restates the subject', () => {
  const message = 'refactor: gen panel context section\n\nGen panel context section.'
  assert.deepEqual(normalizeCommitMessage(message), {
    message: 'refactor: gen panel context section',
    changed: true
  })
})

test('keeps a commit body that adds concrete detail', () => {
  const message = [
    'refactor: gen panel context section',
    '',
    'Move the editor into its own view model and forward the existing bindings without changing the UI surface.'
  ].join('\n')
  assert.equal(normalizeCommitMessage(message).changed, false)
  assert.equal(normalizeCommitMessage(message).message, message)
})

test('keeps a subject-only commit unchanged', () => {
  assert.equal(normalizeCommitMessage('fix: preserve the selected model').changed, false)
})

test('ignores the conventional type prefix when comparing subject and body', () => {
  const message = 'refactor: gen panel context section\n\nrefactor: Gen panel context section.'
  assert.equal(normalizeCommitMessage(message).message, 'refactor: gen panel context section')
})
