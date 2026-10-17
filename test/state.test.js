import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { StateStore } from '../src/lib/state.js'

test('creates, saves, and reloads state atomically', async () => {
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'autopilot-state-'))
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
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'autopilot-lock-'))
  const store = new StateStore({ stateDir })
  await store.lock()
  await assert.rejects(() => store.lock(), /active/)
  await store.unlock()
  await store.lock()
  await store.unlock()
})
