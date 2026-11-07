import fs from 'node:fs/promises'
import path from 'node:path'
import { DEFAULT_TICKET_DIRS, DEFAULTS } from './config-schema.js'
import { atomicWriteJson, exists } from './util.js'

const SAFE_DEFAULTS = [
  'runnerOptions',
  'protectedPaths',
  'requiredChecks',
  'ignoredChecks',
  'restoreCommand',
  'buildCommand',
  'testCommand',
  'smokeCommand',
  'coverageThreshold',
  'auditChunkFiles',
  'localGateRetries',
  'continueOnFailure',
  'maxAttempts',
  'maxMinutes',
  'commandTimeoutMinutes',
  'sessionTimeoutMinutes',
  'checkPollSeconds',
  'checkTimeoutMinutes',
  'billingCurrency',
  'pauseAfter',
  'prTitle',
  'runtimeLogs',
  'commitTypes',
  'agents',
  'models'
]

const DEPRECATED = new Set(['autoMerge', 'approvalRequired'])

/**
 * Applies only additive, schema-safe defaults. Repository-derived values such
 * as branches, commands, checks, coverage, and runner configuration are never
 * invented; the model or the founder must provide them explicitly.
 */
export async function reconcileConfig(repoPath, { apply = false } = {}) {
  const repo = path.resolve(repoPath)
  const file = path.join(repo, 'autopai.json')
  if (!await exists(file)) {
    throw new Error(`No autopai.json found at ${file}. Run /autopai-init to create it first.`)
  }
  let raw
  try {
    raw = JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''))
  } catch (error) {
    throw new Error(`Could not parse ${file}: ${error.message}`)
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${file} must contain a JSON object.`)
  }

  const added = []
  const preserved = []
  const unknown = []
  const next = { ...raw }

  for (const key of SAFE_DEFAULTS) {
    if (DEPRECATED.has(key)) continue
    if (!(key in next)) {
      next[key] = structuredClone(DEFAULTS[key])
      added.push(key)
    } else {
      preserved.push(key)
    }
  }

  if (!('ticketDirs' in next)) {
    next.ticketDirs = structuredClone(DEFAULT_TICKET_DIRS)
    added.push('ticketDirs')
  } else {
    preserved.push('ticketDirs')
  }

  if (!('stateDir' in next)) {
    next.stateDir = await exists(path.join(repo, 'tickets')) ? 'tickets/.autopai' : '.autopai'
    added.push('stateDir')
  } else {
    preserved.push('stateDir')
  }

  for (const key of Object.keys(raw)) {
    if (DEPRECATED.has(key) || key === 'runner' || key === 'baseBranch' || key === 'releaseBranch') continue
    if (!SAFE_DEFAULTS.includes(key) && key !== 'ticketDirs' && key !== 'stateDir') unknown.push(key)
  }

  if (apply && added.length > 0) await atomicWriteJson(file, next)
  return {
    repoPath: repo,
    configPath: file,
    applied: apply,
    changed: added.length > 0,
    added,
    preserved,
    unknown,
    config: next
  }
}
