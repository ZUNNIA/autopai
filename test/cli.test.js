import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCliArgs } from '../src/lib/util.js'

test('collects repeated classification and priority flags', () => {
  const { command, options } = parseCliArgs([
    'identify',
    '--classification', 'code-smell',
    '--classification=architecture',
    '--priority', 'urgent,important'
  ])
  assert.equal(command, 'identify')
  assert.deepEqual(options.classification, ['code-smell', 'architecture'])
  assert.deepEqual(options.priority, ['urgent,important'])
})

test('keeps unknown options for the phase instead of dropping them', () => {
  const { options } = parseCliArgs(['refactor', '--future-option', 'value'])
  assert.equal(options.futureOption, 'value')
})
