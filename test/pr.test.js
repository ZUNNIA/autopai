import test from 'node:test'
import assert from 'node:assert/strict'
import { mergedPrMatchesHead } from '../src/lib/pr.js'

test('reuses a merged pull request only when the branch head still matches', () => {
  assert.equal(mergedPrMatchesHead({ headRefOid: 'abc' }, 'abc'), true)
  assert.equal(mergedPrMatchesHead({ headRefOid: 'abc' }, 'def'), false)
  assert.equal(mergedPrMatchesHead({}, 'abc'), false)
  assert.equal(mergedPrMatchesHead({ headRefOid: 'abc' }, null), false)
})
