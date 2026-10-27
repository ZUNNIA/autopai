import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  mergePrepareSession,
  prepareSessionRecord,
  prepareSessionsToDelete,
  prepareSessionTitleMatches,
  recoverPrepareReview,
  recoverPrepareSessions
} from '../src/lib/prepare-review.js'
import { cleanupPrepareSessions } from '../src/phases/pipeline.js'

test('recovers the newest brief and backlog sessions for the feature', () => {
  const sessions = [
    { id: 'brief-old', title: 'AutopAI brief settings [aaaaaaaa]', directory: 'C:\\repo', created: 100 },
    { id: 'brief-new', title: 'AutopAI brief settings [bbbbbbbb]', directory: 'C:\\repo', created: 300 },
    { id: 'backlog', title: 'AutopAI backlog settings [cccccccc]', directory: 'C:\\repo', created: 200 },
    { id: 'other-feature', title: 'AutopAI backlog settings-extra [dddddddd]', directory: 'C:\\repo', created: 400 },
    { id: 'other-repo', title: 'AutopAI backlog settings [eeeeeeee]', directory: 'C:\\other', created: 500 }
  ]

  const recovered = recoverPrepareSessions(sessions, { feature: 'settings', repoPath: 'C:\\repo' })
  assert.deepEqual(recovered.map(session => session.kind).sort(), ['backlog', 'brief'])
  assert.equal(recovered.find(session => session.kind === 'brief').id, 'brief-new')
  assert.equal(recovered.find(session => session.kind === 'backlog').id, 'backlog')
})

test('accepts only the exact feature prefix and token form', () => {
  assert.equal(prepareSessionTitleMatches('AutopAI backlog settings [a1b2c3d4]', 'backlog', 'settings'), true)
  assert.equal(prepareSessionTitleMatches('AutopAI backlog settings', 'backlog', 'settings'), true)
  assert.equal(prepareSessionTitleMatches('AutopAI backlog settings-extra [a1b2c3d4]', 'backlog', 'settings'), false)
  assert.equal(prepareSessionTitleMatches('AutopAI brief settings [a1b2c3d4]', 'backlog', 'settings'), false)
})

test('merges retained sessions without duplicating the same conversation', () => {
  const first = prepareSessionRecord({
    kind: 'brief',
    feature: 'settings',
    session: { id: 'brief-1', title: 'AutopAI brief settings [a1b2c3d4]' }
  })
  const backlog = prepareSessionRecord({
    kind: 'backlog',
    feature: 'settings',
    session: { id: 'backlog-1', title: 'AutopAI backlog settings [a1b2c3d4]' }
  })

  const once = mergePrepareSession([], first)
  const twice = mergePrepareSession(once, { ...first, id: 'brief-1' })
  const both = mergePrepareSession(twice, backlog)
  assert.equal(twice.length, 1)
  assert.equal(both.length, 2)
  assert.deepEqual(prepareSessionsToDelete({ sessions: both }).map(session => session.kind), ['brief', 'backlog'])
})

test('recovers an interrupted review without approving or running a session', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-review-'))
  const config = {
    repoPath: repo,
    ticketDirs: { backlog: 'tickets/backlog' }
  }
  const backlogDir = path.join(repo, config.ticketDirs.backlog, 'settings')
  await fs.mkdir(backlogDir, { recursive: true })
  await fs.writeFile(path.join(backlogDir, 'brief.md'), '# Brief\n', 'utf8')
  await fs.writeFile(path.join(backlogDir, 'backlog.md'), '# Backlog\n', 'utf8')

  const state = {
    mode: 'prepare',
    phase: 'backlog',
    feature: 'settings',
    completedPhases: [],
    sessions: []
  }
  const stateStore = {
    load: async () => state,
    save: async value => Object.assign(state, value)
  }
  const messages = []
  const recovered = await recoverPrepareReview({
    config,
    stateStore,
    log: message => messages.push(message),
    sessions: [
      { id: 'backlog-1', title: 'AutopAI backlog settings [a1b2c3d4]', directory: repo, created: 200 }
    ]
  })

  assert.equal(recovered.phase, 'awaiting_approval')
  assert.equal(state.phase, 'awaiting_approval')
  assert.deepEqual(state.completedPhases, ['prepare', 'backlog'])
  assert.equal(state.sessions.length, 1)
  assert.equal(state.sessions[0].kind, 'backlog')
  assert.equal(state.sessions[0].id, 'backlog-1')
  assert.match(messages.join('\n'), /no prompt was re-run/)
})

test('cleanup deletes only prepare sessions and reports retained ones', async () => {
  const state = {
    sessions: [
      { kind: 'brief', id: 'brief-1', title: 'AutopAI brief settings [a1b2c3d4]' },
      { kind: 'backlog', id: 'backlog-1', title: 'AutopAI backlog settings [a1b2c3d4]' },
      { kind: 'dev', id: 'dev-1', title: 'AutopAI dev t1 [a1b2c3d4]' }
    ]
  }
  const calls = []
  const messages = []
  const result = await cleanupPrepareSessions({
    config: {},
    state,
    log: message => messages.push(message),
    removeSession: async ({ session }) => {
      calls.push(session.kind)
      return session.kind === 'brief'
        ? { deleted: true, reason: null }
        : { deleted: false, reason: 'keepSessions is enabled' }
    }
  })

  assert.deepEqual(calls, ['brief', 'backlog'])
  assert.deepEqual(result, { deleted: [state.sessions[0]], retained: 1 })
  assert.match(messages.join('\n'), /Deleted retained session/)
  assert.match(messages.join('\n'), /keepSessions is enabled/)
})
