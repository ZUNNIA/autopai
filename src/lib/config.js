import path from 'node:path'
import { DEFAULT_PAUSE_AFTER, normalizePauseAfter } from './pauses.js'
import { expandEnv, exists, readJson, assert } from './util.js'

const DEFAULT_TICKET_DIRS = {
  backlog: 'tickets/backlog',
  readyForDev: 'tickets/ready-for-dev',
  identified: 'tickets/identified',
  readyForRefactor: 'tickets/ready-for-refactor',
  ux: 'tickets/ux',
  qa: 'tickets/qa',
  done: 'tickets/done'
}

const DEFAULT_PROTECTED_PATHS = [
  '.github/**',
  'AGENTS.md',
  'autopai.json'
]

const DEFAULTS = {
  runnerOptions: {},
  protectedPaths: DEFAULT_PROTECTED_PATHS,
  baseBranch: 'main',
  releaseBranch: 'main',
  requiredChecks: [],
  ignoredChecks: [],
  restoreCommand: null,
  buildCommand: null,
  testCommand: null,
  smokeCommand: null,
  coverageThreshold: null,
  auditChunkFiles: 40,
  maxAttempts: 3,
  maxMinutes: 240,
  commandTimeoutMinutes: 30,
  sessionTimeoutMinutes: 90,
  checkPollSeconds: 30,
  checkTimeoutMinutes: 30,
  autoMerge: true,
  approvalRequired: true,
  pauseAfter: [...DEFAULT_PAUSE_AFTER],
  prTitle: null,
  runtimeLogs: [],
  commitTypes: ['feat', 'fix', 'refactor', 'perf', 'test', 'docs', 'chore'],
  agents: {
    executor: 'executor',
    planner: 'planner',
    auditor: 'auditor',
    operator: 'autopai'
  },
  models: {
    executor: null,
    planner: null,
    auditor: null,
    operator: null
  }
}

/**
 * Loads and normalizes the per-repository AutopAI configuration.
 */
export async function loadConfig(repoPath) {
  const resolvedRepo = path.resolve(repoPath)
  const configPath = path.join(resolvedRepo, 'autopai.json')
  const raw = await readJson(configPath)
  assert(raw, `Missing autopai.json at ${configPath}. Run /autopai-init first.`)

  const config = { ...DEFAULTS, ...expandEnv(raw) }
  config.repoPath = resolvedRepo
  config.configPath = configPath
  config.ticketDirs = { ...DEFAULT_TICKET_DIRS, ...(config.ticketDirs ?? {}) }
  config.agents = { ...DEFAULTS.agents, ...(config.agents ?? {}) }
  config.models = { ...DEFAULTS.models, ...(config.models ?? {}) }

  if (!config.stateDir) {
    config.stateDir = await exists(path.join(resolvedRepo, 'tickets'))
      ? path.join(resolvedRepo, 'tickets', '.autopai')
      : path.join(resolvedRepo, '.autopai')
  } else {
    config.stateDir = path.resolve(resolvedRepo, config.stateDir)
  }

  config.runtimeLogs = (config.runtimeLogs ?? []).map(pattern => path.resolve(resolvedRepo, pattern))
  config.requiredChecks = asArray(config.requiredChecks)
  config.ignoredChecks = asArray(config.ignoredChecks)
  config.commitTypes = asArray(config.commitTypes)
  config.protectedPaths = asArray(config.protectedPaths)
  config.pauseAfter = normalizePauseAfter(config.pauseAfter)

  assert(typeof config.runner === 'string' && config.runner.trim() !== '', 'runner is required in autopai.json')
  assert(config.protectedPaths.every(item => typeof item === 'string'), 'protectedPaths must be an array of strings')
  assert(config.baseBranch, 'baseBranch is required')
  assert(config.releaseBranch, 'releaseBranch is required')
  validateCommand(config.restoreCommand, 'restoreCommand')
  validateCommand(config.buildCommand, 'buildCommand')
  validateCommand(config.testCommand, 'testCommand')
  validateCommand(config.smokeCommand, 'smokeCommand')
  assert(config.maxAttempts > 0, 'maxAttempts must be greater than zero')
  assert(Number.isInteger(config.auditChunkFiles) && config.auditChunkFiles > 0, 'auditChunkFiles must be a positive integer')

  return config
}

function asArray(value) {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function validateCommand(command, name) {
  if (command == null) return
  assert(Array.isArray(command) && command.length > 0, `${name} must be an array of arguments`)
  assert(command.every(item => typeof item === 'string'), `${name} arguments must be strings`)
}
