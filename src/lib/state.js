import fs from 'node:fs/promises'
import path from 'node:path'
import { atomicWriteJson, isAlive, readJson } from './util.js'

export class StateStore {
  constructor(config) {
    this.config = config
    this.dir = config.stateDir
    this.file = path.join(this.dir, 'state.json')
    this.lockFile = path.join(this.dir, 'run.lock')
  }

  async load() {
    return readJson(this.file)
  }

  async save(state) {
    state.updatedAt = new Date().toISOString()
    await atomicWriteJson(this.file, state)
    return state
  }

  async create(mode, options = {}) {
    const now = new Date().toISOString()
    const state = {
      schemaVersion: 1,
      runId: options.runId ?? createRunId(),
      mode,
      phase: options.phase ?? mode,
      completedPhases: [],
      repo: this.config.repoPath,
      feature: options.feature ?? null,
      branch: options.branch ?? null,
      baseBranch: options.baseBranch ?? this.config.baseBranch,
      releaseBranch: this.config.releaseBranch,
      baseSha: null,
      headSha: null,
      prNumber: null,
      prTitle: null,
      mergeCommit: null,
      scopes: [],
      filters: options.filters ?? { classifications: [], priorities: [] },
      changedFiles: [],
      attempts: 0,
      sessions: [],
      blockers: [],
      failures: [],
      createdAt: now,
      updatedAt: now
    }
    await this.save(state)
    return state
  }

  async isActiveRun() {
    try {
      const lock = JSON.parse(await fs.readFile(this.lockFile, 'utf8'))
      return Boolean(lock.pid && isAlive(lock.pid))
    } catch (error) {
      if (error.code === 'ENOENT') return false
      if (error instanceof SyntaxError) return false
      throw error
    }
  }

  async lock() {
    await fs.mkdir(this.dir, { recursive: true })
    try {
      const raw = await fs.readFile(this.lockFile, 'utf8')
      const lock = JSON.parse(raw)
      if (lock.pid && isAlive(lock.pid)) {
        throw new Error(`Another AutopAI run is active with pid ${lock.pid}. Run status or abort first.`)
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    await fs.writeFile(this.lockFile, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }), 'utf8')
  }

  async unlock() {
    try {
      await fs.unlink(this.lockFile)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
}

export function createRunId() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  return `${stamp}-${process.pid}`
}

/**
 * Returns consistency issues between the top-level merge fields and the merged
 * ticket scopes. A completed dev or refactor run must mirror the last merged
 * scope so consumers never see a completed run without its merge commit.
 */
export function mergeStateIssues(state) {
  if (!state) return []
  const mergedScopes = (state.scopes ?? []).filter(scope => scope?.mergeCommit)
  const last = mergedScopes[mergedScopes.length - 1]
  const issues = []
  if (last && !state.mergeCommit) {
    issues.push(`state.mergeCommit is missing; the last merged scope has ${last.mergeCommit}.`)
  }
  if (last && state.mergeCommit && state.mergeCommit !== last.mergeCommit) {
    issues.push(`state.mergeCommit ${state.mergeCommit} differs from the last merged scope ${last.mergeCommit}.`)
  }
  if (last?.prNumber && !state.prNumber) {
    issues.push(`state.prNumber is missing; the last merged scope has #${last.prNumber}.`)
  }
  return issues
}

/**
 * Backfills missing merge metadata from the last merged scope. Existing values
 * are never overwritten here; status reports a mismatch instead.
 */
export function reconcileMergeState(state) {
  const issues = mergeStateIssues(state)
  const mergedScopes = (state?.scopes ?? []).filter(scope => scope?.mergeCommit)
  const last = mergedScopes[mergedScopes.length - 1]
  let changed = false
  if (last && !state.mergeCommit) {
    state.mergeCommit = last.mergeCommit
    changed = true
  }
  if (last?.prNumber && !state.prNumber) {
    state.prNumber = last.prNumber
    changed = true
  }
  return { changed, issues }
}

export function recordMergeState(state, { prNumber, mergeCommit, scope }) {
  if (!mergeCommit) throw new Error('Cannot record a merge without a merge commit.')
  state.prNumber = prNumber
  state.mergeCommit = mergeCommit
  if (scope) state.scopes = [...(state.scopes ?? []), scope]
  return state
}