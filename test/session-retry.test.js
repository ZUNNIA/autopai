import test from 'node:test'
import assert from 'node:assert/strict'
import { sessionRetryDelayMs, shouldRetrySession } from '../src/lib/session-retry.js'

test('recognizes a transient provider-capacity failure', () => {
  const result = {
    code: 1,
    stderr: 'Error: Upstream request failed: [ttft_admission_refused] the cell is at capacity; retry shortly (after 19 s)'
  }
  assert.equal(shouldRetrySession(result), true)
  assert.equal(shouldRetrySession({ code: 0, stderr: result.stderr }), false)
  assert.equal(shouldRetrySession({ code: 1, stderr: 'permission denied' }), false)
})

test('uses the provider retry delay with a margin and a cap', () => {
  assert.equal(sessionRetryDelayMs({ stderr: 'retry shortly (after 19 s)' }), 20000)
  assert.equal(sessionRetryDelayMs({ stderr: 'retry shortly' }), 20000)
  assert.equal(sessionRetryDelayMs({ stderr: 'retry shortly (after 0 s)' }), 1000)
  assert.equal(sessionRetryDelayMs({ stderr: 'retry shortly (after 999 s)' }), 120000)
})
