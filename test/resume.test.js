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

test('respects the configured human gates', () => {
  const backlog = nextPhase({ mode: 'prepare', phase: 'awaiting_approval' }, ['backlog'])
  assert.equal(backlog.action, 'none')
  assert.match(backlog.reason, /--approve backlog/)

  const plan = nextPhase({ mode: 'approve', phase: 'approved', feature: 'settings' }, ['plan'])
  assert.equal(plan.action, 'none')
  assert.match(plan.reason, /--approve plan/)

  const qa = nextPhase({ mode: 'dev', phase: 'dev-complete' }, ['qa'])
  assert.equal(qa.action, 'none')
  assert.match(qa.reason, /--approve qa/)

  const findings = nextPhase({ mode: 'identify', phase: 'identified', feature: 'settings' }, ['findings'])
  assert.equal(findings.action, 'none')
  assert.match(findings.reason, /--approve findings/)

  const promotion = nextPhase({ mode: 'promote', phase: 'promoted', feature: 'tech-debt' }, ['promotion'])
  assert.equal(promotion.action, 'none')
  assert.match(promotion.reason, /--approve promotion/)

  const refactor = nextPhase({ mode: 'refactor', phase: 'refactor-complete' }, ['refactor'])
  assert.equal(refactor.action, 'none')
  assert.match(refactor.reason, /--approve refactor/)
})

test('advances through gates that are not configured to pause', () => {
  assert.deepEqual(nextPhase({ mode: 'prepare', phase: 'awaiting_approval', feature: 'settings' }, []), { action: 'approve', feature: 'settings' })
  assert.deepEqual(nextPhase({ mode: 'approve', phase: 'approved', feature: 'settings' }, []), { action: 'dev', feature: 'settings' })
  assert.deepEqual(nextPhase({ mode: 'dev', phase: 'dev-complete' }, []), { action: 'identify', feature: null })
  assert.deepEqual(nextPhase({ mode: 'identify', phase: 'identified', feature: 'settings' }, []), { action: 'promote', feature: 'settings' })
  assert.deepEqual(nextPhase({ mode: 'promote', phase: 'promoted', feature: 'tech-debt' }, []), { action: 'refactor', feature: 'tech-debt' })

  const complete = nextPhase({ mode: 'refactor', phase: 'refactor-complete' }, [])
  assert.equal(complete.action, 'none')
  assert.match(complete.reason, /Refactoring is complete/)

  assert.deepEqual(nextPhase({ mode: 'prepare', phase: 'awaiting_approval' }, ['qa']), { action: 'approve', feature: null })
  const dev = nextPhase({ mode: 'dev', phase: 'dev-complete' }, ['qa'])
  assert.equal(dev.action, 'none')
  assert.match(dev.reason, /manual QA/)
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
