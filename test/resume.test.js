import test from 'node:test'
import assert from 'node:assert/strict'
import { nextPhase, pendingScopes } from '../src/lib/resume.js'

test('decides the next action from the stored state', () => {
  assert.deepEqual(nextPhase(null), { action: 'none', reason: 'No AutopAI state found for this repository.' })
  assert.deepEqual(nextPhase({ mode: 'identify', phase: 'identifying' }), { action: 'resume', mode: 'identify' })
  assert.deepEqual(nextPhase({ mode: 'identify', phase: 'identified', feature: 'settings' }), { action: 'promote', feature: 'settings' })
  assert.deepEqual(nextPhase({ mode: 'promote', phase: 'promoting' }), { action: 'resume', mode: 'promote' })
  assert.deepEqual(nextPhase({ mode: 'promote', phase: 'promoted', feature: 'tech-debt' }), { action: 'refactor', feature: 'tech-debt' })
  assert.deepEqual(nextPhase({ mode: 'dev', phase: 'dev' }), { action: 'resume', mode: 'dev' })
  assert.deepEqual(nextPhase({ mode: 'prepare', phase: 'backlog' }), { action: 'resume', mode: 'prepare' })
  assert.deepEqual(nextPhase({ mode: 'adopt', phase: 'adopt' }), { action: 'resume', mode: 'adopt' })
  assert.deepEqual(nextPhase({ mode: 'dev', phase: 'aborted' }), { action: 'resume', mode: 'dev' })
  assert.equal(nextPhase({ mode: 'prepare', phase: 'awaiting_approval' }).action, 'none')
  assert.equal(nextPhase({ mode: 'dev', phase: 'dev-complete' }).action, 'none')
  assert.equal(nextPhase({ mode: 'refactor', phase: 'refactor-complete' }).action, 'none')
  assert.equal(nextPhase({ mode: 'adopt', phase: 'merged' }).action, 'none')
  assert.equal(nextPhase({ mode: 'release', phase: 'released' }).action, 'none')
  assert.equal(nextPhase({ mode: 'release', phase: 'release' }).action, 'none')
  assert.equal(nextPhase({ mode: 'approve', phase: 'approve' }).action, 'none')
  assert.equal(nextPhase({ mode: 'unknown', phase: 'x' }).action, 'none')
})

test('selects audit scopes that are not completed yet', () => {
  const scopes = [{ name: 'pr-298' }, { name: 'pr-297' }, { name: 'pr-296' }]
  assert.deepEqual(pendingScopes(scopes, []).map(scope => scope.name), ['pr-298', 'pr-297', 'pr-296'])
  assert.deepEqual(
    pendingScopes(scopes, ['identify', 'identify:evidence', 'identify:pr-298']).map(scope => scope.name),
    ['pr-297', 'pr-296']
  )
  assert.deepEqual(pendingScopes(null, []), [])
})
