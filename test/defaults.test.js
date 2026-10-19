import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { featureFromDescription, lastMergedScopes, latestFeatureDir, resolveFeature, scopesFromState } from '../src/lib/defaults.js'

test('derives a feature slug from a description', () => {
  assert.equal(featureFromDescription('Add a settings panel!'), 'add-a-settings-panel')
  assert.equal(featureFromDescription(''), null)
  assert.equal(featureFromDescription(undefined), null)
})

test('resolves the feature from explicit options, state, or the latest directory', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-defaults-'))
  const backlog = path.join(repo, 'tickets', 'backlog')
  await fs.mkdir(path.join(backlog, 'older'), { recursive: true })
  await fs.mkdir(path.join(backlog, 'newer'), { recursive: true })
  await fs.utimes(path.join(backlog, 'older'), new Date('2026-01-01T00:00:00Z'), new Date('2026-01-01T00:00:00Z'))
  await fs.utimes(path.join(backlog, 'newer'), new Date('2026-06-01T00:00:00Z'), new Date('2026-06-01T00:00:00Z'))

  const config = { repoPath: repo }
  const dirs = [path.join('tickets', 'backlog')]

  assert.equal(await resolveFeature({ config, options: { feature: 'explicit' }, state: null, dirs }), 'explicit')
  assert.equal(await resolveFeature({ config, options: {}, state: { feature: 'older' }, dirs }), 'older')
  assert.equal(await resolveFeature({ config, options: {}, state: { feature: 'missing' }, dirs }), 'newer')
  assert.equal(await resolveFeature({ config, options: {}, state: null, dirs }), 'newer')
  assert.equal(await latestFeatureDir(config, dirs), 'newer')
  await assert.rejects(() => resolveFeature({ config, options: {}, state: null, dirs: ['tickets/ready-for-dev'] }), /--feature/)
})

test('derives audit scopes from the previous run state', () => {
  assert.deepEqual(scopesFromState(null), [])
  assert.deepEqual(scopesFromState({ mode: 'prepare' }), [])
  assert.deepEqual(scopesFromState({ mode: 'dev', scopes: [{ prNumber: 12 }, { prNumber: 12 }, { prNumber: 15 }] }), ['pr:12', 'pr:15'])
  assert.deepEqual(scopesFromState({ mode: 'adopt', prNumber: 7 }), ['pr:7'])
  assert.deepEqual(scopesFromState({ mode: 'identify', scopes: [{ kind: 'pr', name: 'pr-296' }] }), ['pr:296'])
  assert.deepEqual(scopesFromState({ mode: 'dev', scopes: [{ name: 'local-branch' }] }), [])
})

test('turns merged pull requests into scopes, most recent first', () => {
  const prs = [
    { number: 10, mergedAt: '2026-01-01T00:00:00Z' },
    { number: 12, mergedAt: '2026-03-01T00:00:00Z' },
    { number: 11, mergedAt: '2026-02-01T00:00:00Z' }
  ]
  assert.deepEqual(lastMergedScopes(prs, 2), ['pr:12', 'pr:11'])
  assert.deepEqual(lastMergedScopes(prs, 5), ['pr:12', 'pr:11', 'pr:10'])
  assert.deepEqual(lastMergedScopes([], 2), [])
  assert.deepEqual(lastMergedScopes(null, 2), [])
})
