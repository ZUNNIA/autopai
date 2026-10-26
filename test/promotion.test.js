import test from 'node:test'
import assert from 'node:assert/strict'
import { selectPromotionGroups, stateFindingGroups } from '../src/lib/promotion.js'

test('keeps an empty filtered identify from falling back to old findings', () => {
  const state = {
    mode: 'identify',
    scopes: [{ name: 'pr-1', tickets: [] }, { name: 'pr-2', tickets: ['a.md', 'b.txt'] }]
  }
  assert.deepEqual(stateFindingGroups(state), [
    { name: 'pr-1', findings: [] },
    { name: 'pr-2', findings: ['a.md'] }
  ])
  assert.equal(stateFindingGroups({ mode: 'refactor', scopes: [{ name: 'x', tickets: [] }] }), null)
  assert.equal(stateFindingGroups({ mode: 'identify', scopes: [] }), null)
  assert.equal(stateFindingGroups({}), null)
})

test('selects pending promotion chunks and skips completed ones', () => {
  const groups = [{ name: 'pr-298' }, { name: 'pr-297' }, { name: 'pr-296' }]

  assert.deepEqual(selectPromotionGroups(groups).map(group => group.name), ['pr-298', 'pr-297', 'pr-296'])
  assert.deepEqual(
    selectPromotionGroups(groups, { completedPhases: ['identify', 'promote:pr-298'] }).map(group => group.name),
    ['pr-297', 'pr-296']
  )
  assert.deepEqual(selectPromotionGroups(groups, { chunk: 'pr-296' }).map(group => group.name), ['pr-296'])
  assert.deepEqual(selectPromotionGroups(groups, { chunk: 'pr-296', completedPhases: ['promote:pr-296'] }), [])
  assert.throws(() => selectPromotionGroups(groups, { chunk: 'pr-999' }), /Unknown promotion chunk/)
  assert.throws(() => selectPromotionGroups(groups, { chunk: true }), /requires a chunk name/)
})
