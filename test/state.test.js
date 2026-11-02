import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { StateStore, mergeStateIssues, reconcileMergeState, recordMergeState } from '../src/lib/state.js'

test('creates, saves, and reloads state atomically', async () => {
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-state-'))
  const store = new StateStore({ stateDir })
  const state = await store.create('adopt', { branch: 'feat/example', baseBranch: 'develop' })
  assert.equal(state.mode, 'adopt')
  assert.equal(state.branch, 'feat/example')

  state.phase = 'merged'
  await store.save(state)

  const reloaded = await store.load()
  assert.equal(reloaded.phase, 'merged')
  assert.equal(reloaded.baseBranch, 'develop')
})

test('locks and unlocks a run', async () => {
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-lock-'))
  const store = new StateStore({ stateDir })
  await store.lock()
  await assert.rejects(() => store.lock(), /active/)
  await store.unlock()
  await store.lock()
  await store.unlock()
})

test('detects a stale run lock as inactive', async () => {
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-stale-lock-'))
  const store = new StateStore({ stateDir })
  await fs.writeFile(store.lockFile, JSON.stringify({ pid: 999999, startedAt: new Date().toISOString() }), 'utf8')
  assert.equal(await store.isActiveRun(), false)
  await store.unlock()
})

test('records merge metadata and backfills it from the last merged scope', () => {
  const state = {
    prNumber: null,
    mergeCommit: null,
    scopes: [{ prNumber: 469, mergeCommit: 'ad6aa8a' }]
  }
  assert.equal(mergeStateIssues(state).length, 2)
  const reconciled = reconcileMergeState(state)
  assert.equal(reconciled.changed, true)
  assert.equal(state.prNumber, 469)
  assert.equal(state.mergeCommit, 'ad6aa8a')
  assert.deepEqual(mergeStateIssues(state), [])
})

test('reports a mismatched merge commit without overwriting it', () => {
  const state = {
    prNumber: 469,
    mergeCommit: 'other',
    scopes: [{ prNumber: 469, mergeCommit: 'ad6aa8a' }]
  }
  assert.match(mergeStateIssues(state)[0], /differs/)
  const reconciled = reconcileMergeState(state)
  assert.equal(reconciled.changed, false)
  assert.equal(state.mergeCommit, 'other')
})

test('rejects recording a merge without a commit', () => {
  assert.throws(
    () => recordMergeState({ scopes: [] }, { prNumber: 469, mergeCommit: null }),
    /without a merge commit/
  )
})