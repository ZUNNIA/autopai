import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { archiveBlockers } from '../src/lib/blockers.js'
import {
  fromRepoRelative,
  portableState,
  toRepoRelative
} from '../src/lib/portable-paths.js'
import { StateStore } from '../src/lib/state.js'

test('portable paths convert repository files without leaking absolute paths', async t => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-portable-'))
  const stateDir = path.join(repo, 'tickets', '.autopai')
  t.after(() => fs.rm(repo, { recursive: true, force: true }))

  const patch = path.join(stateDir, 'artifacts', 'run-1', 'branch.patch')
  const ticket = path.join(repo, 'tickets', 'identified', 'scope', '001-debt.md')
  const blocker = path.join(stateDir, 'needs-human', 'blocker.json')
  const state = {
    repo,
    scopes: [{ name: 'scope', patch, tickets: [ticket] }],
    blockers: [blocker]
  }

  assert.equal(toRepoRelative(repo, patch), 'tickets/.autopai/artifacts/run-1/branch.patch')
  assert.equal(fromRepoRelative(repo, 'tickets/identified/scope/001-debt.md'), ticket)
  const portable = portableState(state, repo)
  assert.equal(portable.repo, '.')
  assert.equal(portable.scopes[0].patch, 'tickets/.autopai/artifacts/run-1/branch.patch')
  assert.equal(portable.scopes[0].tickets[0], 'tickets/identified/scope/001-debt.md')
  assert.equal(portable.blockers[0], 'tickets/.autopai/needs-human/blocker.json')
})

test('state files persist relative paths and blocker archives resolve them', async t => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-portable-state-'))
  const config = {
    repoPath: repo,
    stateDir: path.join(repo, 'tickets', '.autopai'),
    baseBranch: 'develop',
    releaseBranch: 'main'
  }
  t.after(() => fs.rm(repo, { recursive: true, force: true }))

  const store = new StateStore(config)
  const state = await store.create('identify', { feature: 'debt' })
  const patch = path.join(config.stateDir, 'artifacts', state.runId, 'scope.patch')
  const ticket = path.join(repo, 'tickets', 'identified', 'debt', '001-finding.md')
  const blocker = path.join(config.stateDir, 'needs-human', 'blocked.json')
  state.scopes = [{ name: 'debt', patch, tickets: [ticket] }]
  state.blockers = [blocker]
  await store.save(state)

  const saved = JSON.parse(await fs.readFile(path.join(config.stateDir, 'state.json'), 'utf8'))
  assert.equal(saved.repo, '.')
  assert.equal(saved.scopes[0].patch, 'tickets/.autopai/artifacts/' + state.runId + '/scope.patch')
  assert.equal(saved.scopes[0].tickets[0], 'tickets/identified/debt/001-finding.md')
  assert.equal(saved.blockers[0], 'tickets/.autopai/needs-human/blocked.json')

  await fs.mkdir(path.dirname(blocker), { recursive: true })
  await fs.writeFile(blocker, '{}', 'utf8')
  const archived = await archiveBlockers({
    blockers: [saved.blockers[0]],
    artifactsDir: path.join(config.stateDir, 'artifacts', state.runId),
    repoPath: repo
  })
  assert.equal(archived.length, 1)
  assert.equal(await fs.stat(blocker).then(() => true, () => false), false)
})
