import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_PAUSE_AFTER,
  GATES,
  currentGate,
  gateAfterPhase,
  gateLabel,
  normalizeApprovedGate,
  normalizePauseAfter,
  phaseAfterGate
} from '../src/lib/pauses.js'

test('normalizes the pause list and rejects unknown gates', () => {
  assert.deepEqual(normalizePauseAfter(undefined), DEFAULT_PAUSE_AFTER)
  assert.deepEqual(normalizePauseAfter(null), DEFAULT_PAUSE_AFTER)
  assert.deepEqual(normalizePauseAfter([]), [])
  assert.deepEqual(normalizePauseAfter(''), [])
  assert.deepEqual(normalizePauseAfter('backlog, plan, backlog'), ['backlog', 'plan'])
  assert.deepEqual(normalizePauseAfter(['qa', 'findings']), ['qa', 'findings'])
  assert.throws(() => normalizePauseAfter('nope'), /Invalid pause gate/)
})

test('validates a single explicit approval gate', () => {
  assert.equal(normalizeApprovedGate('backlog'), 'backlog')
  assert.throws(() => normalizeApprovedGate('backlog,plan'), /exactly one gate/)
  assert.throws(() => normalizeApprovedGate(''), /exactly one gate/)
  assert.throws(() => normalizeApprovedGate('nope'), /Invalid pause gate/)
})

test('maps completed states and phases to gates', () => {
  assert.deepEqual(GATES, ['backlog', 'plan', 'qa', 'findings', 'promotion', 'refactor'])
  assert.equal(currentGate({ mode: 'prepare', phase: 'awaiting_approval' }), 'backlog')
  assert.equal(currentGate({ mode: 'approve', phase: 'approved' }), 'plan')
  assert.equal(currentGate({ mode: 'dev', phase: 'dev-complete' }), 'qa')
  assert.equal(currentGate({ mode: 'identify', phase: 'identified' }), 'findings')
  assert.equal(currentGate({ mode: 'promote', phase: 'promoted' }), 'promotion')
  assert.equal(currentGate({ mode: 'refactor', phase: 'refactor-complete' }), 'refactor')
  assert.equal(currentGate({ mode: 'dev', phase: 'dev' }), null)
  assert.equal(currentGate(null), null)

  assert.equal(gateAfterPhase('prepare'), 'backlog')
  assert.equal(gateAfterPhase('approve'), 'plan')
  assert.equal(gateAfterPhase('dev'), 'qa')
  assert.equal(gateAfterPhase('release'), null)
  assert.equal(phaseAfterGate('backlog'), 'approve')
  assert.equal(phaseAfterGate('plan'), 'dev')
  assert.equal(phaseAfterGate('qa'), 'identify')
  assert.equal(phaseAfterGate('findings'), 'promote')
  assert.equal(phaseAfterGate('promotion'), 'refactor')
  assert.equal(phaseAfterGate('refactor'), null)
  assert.equal(gateLabel('qa'), 'manual QA')
  assert.equal(gateLabel('unknown'), 'unknown')
})
